#include <pspkernel.h>
#include <pspiofilemgr.h>
#include <string.h>
#ifdef HOOK_PROBE
#include "hook_probe.h"
#endif

PSP_MODULE_INFO("mhp2g_zh_cn", 0, 0, 1);
PSP_NO_CREATE_MAIN_THREAD();
PSP_HEAP_SIZE_KB(64);

#define PACKAGE_DIR "ms0:/PSP/PLUGINS/mhp2g_zh_cn/"

static void log_message(const char *message) {
    SceUID file = sceIoOpen(PACKAGE_DIR "plugin.log", PSP_O_WRONLY | PSP_O_CREAT | PSP_O_APPEND, 0600);
    if (file >= 0) {
        sceIoWrite(file, message, strlen(message));
        sceIoClose(file);
    }
}

static int finish_probe(void) {
    // Returning through the SDK CRT requests module self-unload. Keep this
    // module resident and end only its initialization thread instead.
    sceKernelExitDeleteThread(0);
    return 0;
}

int main(int argc, char *argv[]) {
    (void)argc;
    (void)argv;
    char contents[32] = {0};
    log_message("probe: module started\n");
    SceUID file = sceIoOpen(PACKAGE_DIR "probe.txt", PSP_O_RDONLY, 0);
    if (file < 0) {
        log_message("probe: ERROR missing package file; no patches applied\n");
        return finish_probe();
    }
    int length = sceIoRead(file, contents, sizeof(contents) - 1);
    sceIoClose(file);
    static const char marker[] = "mhp2g-zh-pilot-v1\r\n";
    if (length != sizeof(marker) - 1 || memcmp(contents, marker, sizeof(marker) - 1) != 0) {
        log_message("probe: ERROR package marker mismatch; no patches applied\n");
        return finish_probe();
    }
    log_message("probe: package file verified; no patches applied\n");
#ifdef HOOK_PROBE
    run_hook_probe(log_message);
#endif
    return finish_probe();
}
