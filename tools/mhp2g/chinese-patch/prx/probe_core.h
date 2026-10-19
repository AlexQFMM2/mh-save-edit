#ifndef P2G_PROBE_CORE_H
#define P2G_PROBE_CORE_H
#include <stddef.h>
#include <stdint.h>
#define PROBE_MAX_TEXT 256u
typedef struct {
    uint32_t mode, table, index, original_length, replacement_length;
    char original[PROBE_MAX_TEXT], replacement[PROBE_MAX_TEXT];
} ProbeConfig;
typedef struct { uint32_t calls, selected, replaced, mismatch, invalid; } ProbeCounters;
uint32_t probe_crc32(const unsigned char *bytes, size_t size);
int probe_parse(ProbeConfig *out, const unsigned char *bytes, size_t size,
                uint32_t table, uint32_t index, uint32_t mode);
int probe_source_ready(const unsigned char *base, size_t size, uint32_t tables, const ProbeConfig *config);
const char *probe_query(const ProbeConfig *config, uint32_t table, uint32_t index,
                       const char *result, const unsigned char *base, size_t size,
                       volatile ProbeCounters *counts, int enabled);
#endif
