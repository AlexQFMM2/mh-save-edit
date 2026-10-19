/* Offline read-back through the production parser; never starts an emulator. */
#include "prx/pilot_core.h"
#include <stdio.h>
#include <stdlib.h>
static PilotText text;
static unsigned char bytes[PILOT_PACKET_BYTES];
int main(int argc,char **argv) {
    if (argc!=2) return 2;
    FILE *file=fopen(argv[1],"rb");
    if (!file) return 2;
    size_t size=fread(bytes,1,sizeof(bytes),file);
    int extra=fgetc(file),failed=ferror(file);fclose(file);
    if (failed || extra!=EOF || !pilot_parse(&text,bytes,size)) return 1;
    for (uint32_t i=0;i<text.count;++i) {
        const PilotRow *row=&text.rows[i];
        if (pilot_find(&text,row->member,row->table,row->index)!=row) return 1;
    }
    printf("PASS production packet: rows=%lu bytes=%lu\n",(unsigned long)text.count,(unsigned long)size);
    return 0;
}
