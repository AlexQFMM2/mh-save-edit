#include <pspiofilemgr.h>
#include <stdio.h>
#include "pilot_io.h"
#include "probe_core.h"
int pilot_read(const char *name, unsigned char *out, size_t size, uint32_t crc) {
    char path[160];
    int len=snprintf(path,sizeof(path),"ms0:/PSP/PLUGINS/mhp2g_zh_cn/%s",name);
    if (len<0 || (size_t)len>=sizeof(path)) return 0;
    SceUID file=sceIoOpen(path,PSP_O_RDONLY,0);
    if (file<0) return 0;
    size_t used=0;
    while (used<size) {
        int n=sceIoRead(file,out+used,size-used);
        if (n<=0) { sceIoClose(file); return 0; }
        used+=(size_t)n;
    }
    unsigned char extra;
    int tail=sceIoRead(file,&extra,1), closed=sceIoClose(file);
    return tail==0 && closed>=0 && probe_crc32(out,size)==crc;
}
