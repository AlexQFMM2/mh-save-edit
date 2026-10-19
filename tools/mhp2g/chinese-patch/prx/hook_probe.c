#include "hook_probe.h"
#include <pspkernel.h>
#include <pspintrman.h>
#include <pspiofilemgr.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define PROBE_FILE "ms0:/PSP/PLUGINS/mhp2g_zh_cn/hook-probe.bin"
#define QUERY_ADDRESS 0x088513ccu
#define TABLE_BASE 0x089c7510u
#define TABLE_BYTES 536576u
#define MAX_TEXT 256u

/* Verified only against ULJM05500/1.01 BOOT SHA-256
 * 3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846.
 * The first two instructions are independent of PC and safe to relocate.
 */
static const uint32_t prologue[] = {
    0x27bdffe0, 0xafbf000c, 0xafb10008, 0x00c08821,
    0x0e2144eb, 0xafb00004, 0x00408021, 0x3223ffff
};
static uint32_t trampoline[4] __attribute__((aligned(16)));
static char original[MAX_TEXT], replacement[MAX_TEXT];
static uint32_t mode, selected_table, selected_index;
static volatile uint32_t total_calls, selected_calls, replaced_calls, mismatch_calls;
typedef const char *(*TextQuery)(void *, unsigned int, unsigned int);

static uint32_t crc32(const unsigned char *p, unsigned int n) {
    uint32_t crc = ~0u;
    while (n--) {
        crc ^= *p++;
        for (unsigned int i = 0; i < 8; ++i)
            crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}

static int load_config(void) {
    unsigned char bytes[28 + MAX_TEXT * 2];
    SceUID file = sceIoOpen(PROBE_FILE, PSP_O_RDONLY, 0);
    if (file < 0) return 0;
    unsigned int used = 0;
    while (used < sizeof(bytes)) {
        int n = sceIoRead(file, bytes + used, sizeof(bytes) - used);
        if (n < 0) { sceIoClose(file); return 0; }
        if (!n) break;
        used += n;
    }
    unsigned char extra;
    int tail = sceIoRead(file, &extra, 1);
    sceIoClose(file);
    if (tail != 0 || used < 30 || memcmp(bytes, "HPR1", 4)) return 0;
    uint32_t fields[6];
    memcpy(fields, bytes + 4, sizeof(fields));
    mode = fields[0]; selected_table = fields[1]; selected_index = fields[2];
    uint32_t a = fields[3], b = fields[4];
    /* Deliberately restrict this experiment to the already crosschecked item. */
    if (mode > 1 || selected_table != 1 || selected_index != 7 ||
        a == 0 || a >= MAX_TEXT || b == 0 || b >= MAX_TEXT || used != 30 + a + b)
        return 0;
    if (crc32(bytes + 28, used - 28) != fields[5] || bytes[28+a] || bytes[29+a+b] ||
        memchr(bytes + 28, 0, a) || memchr(bytes + 29+a, 0, b)) return 0;
    /* ASCII marker isolates pointer relocation from the separate font experiment. */
    for (unsigned int i = 0; i < b; ++i)
        if (bytes[29+a+i] < 32 || bytes[29+a+i] > 126) return 0;
    memcpy(original, bytes + 28, a + 1);
    memcpy(replacement, bytes + 29+a, b + 1);
    return 1;
}

static const char *query_hook(void *object, unsigned int table, unsigned int index) {
    const char *result = ((TextQuery)trampoline)(object, table, index);
    ++total_calls;
    if (table == selected_table && (index & 0xffffu) == selected_index) {
        ++selected_calls;
        if (!result || strcmp(result, original)) { ++mismatch_calls; return result; }
        if (mode) { ++replaced_calls; return replacement; }
    }
    return result;
}

static int source_ready(void) {
    const unsigned char *base = (const unsigned char *)TABLE_BASE;
    if (*(const uint32_t *)base != 23) return 0;
    uint32_t table;
    memcpy(&table, base + 8 + 4 * selected_table, 4);
    if (table > TABLE_BYTES - 4 * (selected_index + 1)) return -1;
    uint32_t offset;
    memcpy(&offset, base + table + 4 * selected_index, 4);
    unsigned int length = strlen(original) + 1;
    if (offset >= TABLE_BYTES - table || length > TABLE_BYTES - table - offset)
        return -1;
    return memcmp(base + table + offset, original, length) ? -1 : 1;
}

void run_hook_probe(void (*log)(const char *)) {
    if (!load_config()) { log("hook: ERROR invalid/missing probe config; no patches applied\n"); return; }
    if (memcmp((const void *)QUERY_ADDRESS, prologue, sizeof(prologue))) {
        log("hook: ERROR target code mismatch; no patches applied\n"); return;
    }
    int ready = 0;
    for (unsigned int i = 0; i < 600 && !ready; ++i) {
        ready = source_ready();
        if (!ready) sceKernelDelayThread(100000);
    }
    if (ready != 1) { log("hook: ERROR source mismatch/timeout; no patches applied\n"); return; }
    uintptr_t hook = (uintptr_t)query_hook;
    if ((hook & 0xf0000000u) != (QUERY_ADDRESS & 0xf0000000u)) {
        log("hook: ERROR jump region mismatch; no patches applied\n"); return;
    }
    trampoline[0] = prologue[0]; trampoline[1] = prologue[1];
    trampoline[2] = 0x08000000u | ((QUERY_ADDRESS + 8) >> 2);
    trampoline[3] = 0;
    sceKernelDcacheWritebackRange(trampoline, sizeof(trampoline));
    sceKernelIcacheInvalidateRange(trampoline, sizeof(trampoline));
    unsigned int state = sceKernelCpuSuspendIntr();
    volatile uint32_t *site = (volatile uint32_t *)QUERY_ADDRESS;
    /* Recheck immediately before the sole mutation, including potential conflicts. */
    if (memcmp((const void *)site, prologue, sizeof(prologue))) {
        sceKernelCpuResumeIntr(state);
        log("hook: ERROR target changed; no patches applied\n"); return;
    }
    site[0] = 0x08000000u | ((hook & 0x0fffffffu) >> 2);
    site[1] = 0;
    sceKernelDcacheWritebackRange((void *)site, 8);
    sceKernelIcacheInvalidateRange((void *)site, 8);
    sceKernelCpuResumeIntr(state);
    char message[200];
    snprintf(message, sizeof(message), "hook: installed mode=%lu site=%08lX trampoline=%08lX replacement=%08lX bytes=%u\n",
             (unsigned long)mode, (unsigned long)QUERY_ADDRESS, (unsigned long)(uintptr_t)trampoline,
             (unsigned long)(uintptr_t)replacement, (unsigned int)strlen(replacement));
    log(message);
    uint32_t previous = ~0u;
    /* Development counters only; no disk I/O in the game's text lookup path. */
    for (;;) {
        sceKernelDelayThread(5000000);
        if (total_calls == previous) continue;
        previous = total_calls;
        snprintf(message, sizeof(message), "hook: calls=%lu selected=%lu replaced=%lu mismatch=%lu\n",
                 (unsigned long)total_calls, (unsigned long)selected_calls,
                 (unsigned long)replaced_calls, (unsigned long)mismatch_calls);
        log(message);
    }
}
