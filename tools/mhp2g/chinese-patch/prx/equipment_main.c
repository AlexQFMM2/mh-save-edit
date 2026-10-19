#include <pspkernel.h>
#include <pspiofilemgr.h>
#include <stdio.h>
#include <string.h>
#ifdef PILOT
#include "pilot_hook.h"
#include "pilot_profile.h"
#else
#include "equipment_hook.h"
#include "probe_profile.h"
#endif

PSP_MODULE_INFO("mhp2g_zh_cn", 0, 0, 2);
PSP_NO_CREATE_MAIN_THREAD();
PSP_HEAP_SIZE_KB(64);
#define DIR "ms0:/PSP/PLUGINS/mhp2g_zh_cn/"

static int write_line(void *context, const char *line, size_t length) {
    (void)context;
    SceUID f = sceIoOpen(DIR "plugin.log", PSP_O_WRONLY | PSP_O_APPEND, 0600);
    if (f < 0) return 0;
    size_t written = 0;
    while (written < length) {
        int n = sceIoWrite(f, line+written, length-written);
        if (n <= 0) { sceIoClose(f); return 0; }
        written += (size_t)n;
    }
    return sceIoClose(f) >= 0;
}
static int rotate_log(void) {
    SceIoStat stat;
    if (sceIoGetstat(DIR "plugin.log", &stat) >= 0) {
        if (sceIoGetstat(DIR "plugin.previous.log", &stat) >= 0 && sceIoRemove(DIR "plugin.previous.log") < 0) return 0;
        if (sceIoRename(DIR "plugin.log", DIR "plugin.previous.log") < 0) return 0;
    }
    SceUID f = sceIoOpen(DIR "plugin.log", PSP_O_WRONLY | PSP_O_CREAT | PSP_O_TRUNC, 0600);
    return f >= 0 && sceIoClose(f) >= 0;
}
int main(int argc, char *argv[]) {
    (void)argc; (void)argv;
    char run[24];
    snprintf(run, sizeof(run), "%016llX", (unsigned long long)sceKernelGetSystemTimeWide());
    ProbeLog log = { .write=write_line, .build=PROBE_BUILD_ID, .run=run,
        .mode=PROBE_MODE, .table=PROBE_TABLE, .index=PROBE_INDEX };
    if (!rotate_log()) {
        sceKernelPrintf("P2GPROBE event=log_write_failed no_patches=1\n");
    } else if (probe_event(&log, "start", "format=1")) {
#ifdef PILOT
        pilot_run(&log);
#else
        equipment_probe(&log);
#endif
    }
    if (log.failed) sceKernelPrintf("P2GPROBE event=log_write_failed replacement_disabled=1\n");
    sceKernelExitDeleteThread(0);
    return 0;
}
