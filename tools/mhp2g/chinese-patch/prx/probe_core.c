#include "probe_core.h"
#include <string.h>

static uint32_t word(const unsigned char *p) {
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}
static void increment(volatile uint32_t *n) { if (*n != UINT32_MAX) ++*n; }
uint32_t probe_crc32(const unsigned char *p, size_t n) {
    uint32_t crc = ~0u;
    while (n--) {
        crc ^= *p++;
        for (unsigned int i = 0; i < 8; ++i)
            crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}
int probe_parse(ProbeConfig *out, const unsigned char *p, size_t n,
                uint32_t table, uint32_t index, uint32_t mode) {
    if (!p || n < 30 || n > 28 + PROBE_MAX_TEXT * 2 || memcmp(p, "HPR1", 4)) return 0;
    uint32_t a = word(p + 16), b = word(p + 20);
    if (word(p+4) > 1 || word(p+4) != mode || word(p+8) != table || word(p+12) != index ||
        !a || a >= PROBE_MAX_TEXT || !b || b >= PROBE_MAX_TEXT || n != 30u+a+b) return 0;
    if (probe_crc32(p+28, n-28) != word(p+24) || p[28+a] || p[29+a+b] ||
        memchr(p+28, 0, a) || memchr(p+29+a, 0, b)) return 0;
    for (uint32_t i = 0; i < b; ++i) if (p[29+a+i] < 32 || p[29+a+i] > 126) return 0;
    ProbeConfig next = {0};
    next.mode = mode; next.table = table; next.index = index;
    next.original_length = a; next.replacement_length = b;
    memcpy(next.original, p+28, a+1); memcpy(next.replacement, p+29+a, b+1);
    *out = next;
    return 1;
}
int probe_source_ready(const unsigned char *base, size_t size, uint32_t tables, const ProbeConfig *c) {
    if (!base || size < 4) return -1;
    if (word(base) != tables) return 0;
    if (c->table >= tables || c->index > 0xffffu || size < 12 || c->table > (size-12)/4) return -1;
    uint32_t table = word(base+8+4*c->table);
    size_t entry = (size_t)c->index * 4, length = c->original_length + 1;
    if (table > size || entry > size-table || size-table-entry < 4) return -1;
    uint32_t offset = word(base+table+entry);
    if (offset > size-table || length > size-table-offset) return -1;
    return memcmp(base+table+offset, c->original, length) ? -1 : 1;
}
const char *probe_query(const ProbeConfig *c, uint32_t table, uint32_t index,
                       const char *result, const unsigned char *base, size_t size,
                       volatile ProbeCounters *counts, int enabled) {
    increment(&counts->calls);
    if (table != c->table || (index & 0xffffu) != c->index) return result;
    increment(&counts->selected);
    uintptr_t address = (uintptr_t)result, start = (uintptr_t)base;
    size_t length = c->original_length + 1;
    if (!result || address < start || address-start > size || length > size-(address-start)) {
        increment(&counts->mismatch); increment(&counts->invalid); return result;
    }
    if (memcmp(result, c->original, length)) { increment(&counts->mismatch); return result; }
    if (c->mode && enabled) { increment(&counts->replaced); return c->replacement; }
    return result;
}
