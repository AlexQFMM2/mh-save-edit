#define _GNU_SOURCE
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include "pilot_hook.c"
#include "pilot_font.c"

static int fault, reads;
static const char *packet_path;
static ProbeLog *current_log;
static char log_bytes[4096];
static size_t log_size;
unsigned int sceKernelCpuSuspendIntr(void) { return 7; }
void sceKernelCpuResumeIntr(unsigned int n) { assert(n==7); }
void sceKernelDcacheWritebackRange(const void *p,unsigned int n) { assert(p && n); }
void sceKernelIcacheInvalidateRange(const void *p,unsigned int n) { assert(p && n); }
int sceKernelDelayThread(unsigned int n) {
    assert(n==5000000 && current_log);return 0;
}
static int write_log(void *context,const char *line,size_t size) {
    (void)context;assert(log_size+size<sizeof(log_bytes));
    memcpy(log_bytes+log_size,line,size);log_size+=size;
    if (strstr(line,"event=font_summary")) current_log->capped=1;
    return 1;
}
int pilot_read(const char *name,unsigned char *out,size_t size,uint32_t crc) {
    (void)crc;++reads;
    /* Simulate other game activity during slow file IO. Hooks must already be
       installed, but incomplete rows and the external font stay inaccessible. */
    assert(installed && data_state==DATA_LOADING && pilot_font_state.preparing);
    assert(!pilot_font_state.ready && !pilot_font_state.initialized);
    for (unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i) {
        uint32_t *site=(uint32_t *)(uintptr_t)patches[i].address;
        assert(site[0]>>26==(patches[i].entry?2u:3u));
    }
    assert(choose(NULL,"original")== (const char *)"original");
    SceFontCharacterInfo info;
    assert(!pilot_char_info((void *)1,65,&info) && info.width==7);
    if (!strcmp(name,"texts.bin")) {
        if (fault==1) return 0;
        if (fault==2) { memset(out,0,size);return 1; }
        if (fault==4) { SceFontInfo nested;assert(!pilot_font_info((void *)1,&nested)); }
        if (fault==5) assert(!pilot_prepare_data());
        FILE *file=fopen(packet_path,"rb");assert(file);
        assert(fread(out,1,size,file)==size);assert(fgetc(file)==EOF);assert(!fclose(file));return 1;
    }
    assert(!strcmp(name,"zh-cn.pgf"));memset(out,0,size);return fault!=3;
}
void *sceFontNewLib(SceFontLibData *data,int *error) {
    assert(data->maxFonts==1 && data->alloc(NULL,4096));*error=0;return (void *)2;
}
void *sceFontOpenUserMemory(void *lib,char *data,unsigned int size,int *error) {
    assert(lib==(void *)2 && data==(char *)font_bytes && size==PILOT_PGF_BYTES);
    *error=0;return (void *)3;
}
int sceFontGetFontInfo(void *font,SceFontInfo *info) {
    assert(font==(void *)1);memset(info,0,sizeof(*info));
    info->maxWidth=20;info->maxHeight=20;info->maxFixed.top=16*64;return 0;
}
int sceFontGetCharInfo(void *font,unsigned short code,SceFontCharacterInfo *info) {
    (void)code;memset(info,0,sizeof(*info));
    if (font==(void *)1) { info->width=7;return 0; }
    assert(font==(void *)3 && data_state==DATA_READY && !pilot_font_state.ready);
    info->width=2;info->height=2;info->y=2;info->data.hShift=128;return 0;
}
int sceFontGetCharGlyphImage(void *font,unsigned short code,SceFontImageBuffer *image) {
    (void)code;assert(font==(void *)3 && image && image->data);
    image->data[0]=image->data[1]=image->data[32]=image->data[33]=255;return 0;
}
int main(int argc,char **argv) {
    assert(argc==3);fault=atoi(argv[1]);packet_path=argv[2];
    void *memory=mmap((void *)0x08800000,0x1800000,PROT_READ|PROT_WRITE,
        MAP_PRIVATE|MAP_ANONYMOUS|MAP_FIXED_NOREPLACE,-1,0);
    assert(memory==(void *)0x08800000);
    for (unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i)
        memcpy((void *)(uintptr_t)patches[i].address,patches[i].words,8);
    const uint32_t words[]=PILOT_FIND_WORDS;
    memcpy((void *)PILOT_FIND_RESOURCE,words,sizeof(words));
    assert(pilot_install() && pilot_install() && !reads);
    assert(choose(NULL,"original")== (const char *)"original");
    SceFontInfo info;
    /* This return is the game's boundary before building its glyph cache. */
    assert(!pilot_font_info((void *)1,&info));
    assert(pilot_font_state.initialized==1 && !pilot_font_state.preparing);
    assert(pilot_font_state.ready==(fault==0) && pilot_font_state.active==(fault==0));
    assert((pilot_font_state.error!=0)==(fault!=0));
    if (!fault) assert(choose(&text.rows[0],"original")==text.rows[0].translated);
    int previous_reads=reads;
    assert(!pilot_font_info((void *)1,&info) && reads==previous_reads);
    assert(pilot_font_state.ready==(fault==0));
    ProbeLog log={.write=write_log,.build="synthetic",.run="x",.mode=1};
    current_log=&log;assert(probe_event(&log,"start","format=1"));pilot_run(&log);
    assert(strstr(log_bytes,"event=installed"));
    assert(strstr(log_bytes,fault && fault!=4?"event=config_error":"event=config_ok"));
    assert(strstr(log_bytes,"event=font_metrics") && !strstr(log_bytes,"event=font_init_missed"));
    assert(!munmap(memory,0x1800000));
    puts("PASS early hooks, initialization barrier, partial-data gates, failure latch and repeat initialization");
}
