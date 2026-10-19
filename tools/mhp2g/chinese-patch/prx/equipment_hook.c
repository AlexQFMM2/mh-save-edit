#include <pspkernel.h>
#include <pspintrman.h>
#include <pspiofilemgr.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "probe_core.h"
#include "equipment_hook.h"
#include "probe_profile.h"

static const uint32_t prologue[] = PROBE_PROLOGUE;
static uint32_t trampoline[4] __attribute__((aligned(16)));
static ProbeConfig config;
static volatile ProbeCounters counts;
static volatile int enabled;
typedef const char *(*TextQuery)(void *, unsigned int, unsigned int);

static const char *query(void *object, unsigned int table, unsigned int index) {
    const char *result = ((TextQuery)trampoline)(object, table, index);
    return probe_query(&config, table, index, result, (const unsigned char *)PROBE_TABLE_BASE,
                       PROBE_TABLE_BYTES, &counts, enabled);
}
static int load_config(void) {
    unsigned char bytes[28 + PROBE_MAX_TEXT * 2 + 1];
    SceUID f = sceIoOpen("ms0:/PSP/PLUGINS/mhp2g_zh_cn/hook-probe.bin", PSP_O_RDONLY, 0);
    if (f < 0) return 0;
    size_t used = 0;
    while (used < sizeof(bytes)) {
        int n = sceIoRead(f, bytes+used, sizeof(bytes)-used);
        if (n < 0) { sceIoClose(f); return 0; }
        if (!n) break;
        used += (size_t)n;
    }
    sceIoClose(f);
    return probe_crc32(bytes, used) == PROBE_CONFIG_CRC &&
        probe_parse(&config, bytes, used, PROBE_TABLE, PROBE_INDEX, PROBE_MODE);
}
void equipment_probe(ProbeLog *log) {
    if (!load_config()) { probe_event(log, "config_error", "no_patches=1"); return; }
    if (!probe_event(log, "config_ok", "")) return;
    if (memcmp((const void *)PROBE_QUERY_ADDRESS, prologue, sizeof(prologue))) {
        probe_event(log, "version_mismatch", "no_patches=1"); return;
    }
    if (!probe_event(log, "source_waiting", "timeout_seconds=60")) return;
    int ready = 0;
    for (unsigned int i = 0; i < 600 && !ready; ++i) {
        ready = probe_source_ready((const unsigned char *)PROBE_TABLE_BASE, PROBE_TABLE_BYTES, PROBE_TABLE_COUNT, &config);
        if (!ready) sceKernelDelayThread(100000);
    }
    if (ready != 1) { probe_event(log, ready ? "source_mismatch" : "source_timeout", "no_patches=1"); return; }
    uintptr_t hook = (uintptr_t)query;
    if ((hook & 0xf0000000u) != (PROBE_QUERY_ADDRESS & 0xf0000000u)) {
        probe_event(log, "jump_region_mismatch", "no_patches=1"); return;
    }
    trampoline[0] = prologue[0]; trampoline[1] = prologue[1];
    trampoline[2] = 0x08000000u | ((PROBE_QUERY_ADDRESS+8) >> 2); trampoline[3] = 0;
    sceKernelDcacheWritebackRange(trampoline, sizeof(trampoline));
    sceKernelIcacheInvalidateRange(trampoline, sizeof(trampoline));
    if (!probe_event(log, "source_ok", "")) return;
    unsigned int state = sceKernelCpuSuspendIntr();
    volatile uint32_t *site = (volatile uint32_t *)PROBE_QUERY_ADDRESS;
    if (memcmp((const void *)site, prologue, sizeof(prologue))) {
        sceKernelCpuResumeIntr(state); probe_event(log, "target_changed", "no_patches=1"); return;
    }
    enabled = 1;
    site[0] = 0x08000000u | ((hook & 0x0fffffffu) >> 2); site[1] = 0;
    sceKernelDcacheWritebackRange((void *)site, 8); sceKernelIcacheInvalidateRange((void *)site, 8);
    sceKernelCpuResumeIntr(state);
    if (!probe_event(log, "installed", "")) { enabled = 0; return; }
    if (!probe_event(log, "waiting_target", "")) { enabled = 0; return; }
    ProbeCounters previous = {0};
    int first = 1;
    for (;;) {
        sceKernelDelayThread(5000000);
        state = sceKernelCpuSuspendIntr();
        ProbeCounters now = counts;
        sceKernelCpuResumeIntr(state);
        if (first || memcmp(&now, &previous, sizeof(now))) {
            if (!previous.selected && now.selected) probe_event(log, "first_match", "");
            if (!previous.mismatch && now.mismatch) probe_event(log, "original_mismatch", "replacement_rejected=1");
            if (!previous.invalid && now.invalid) probe_event(log, "invalid_pointer", "replacement_rejected=1");
            if (!previous.replaced && now.replaced) probe_event(log, "first_replace", "");
            char fields[180];
            snprintf(fields, sizeof(fields), "calls=%lu selected=%lu replaced=%lu mismatch=%lu invalid=%lu",
                (unsigned long)now.calls, (unsigned long)now.selected, (unsigned long)now.replaced,
                (unsigned long)now.mismatch, (unsigned long)now.invalid);
            probe_event(log, "summary", fields);
            previous = now; first = 0;
        }
        if (log->failed || log->capped) { enabled = 0; return; }
    }
}
