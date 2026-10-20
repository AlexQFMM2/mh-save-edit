#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "pilot_font.c"
static int fault;
static void *char_allocation;
static unsigned int last_info, last_image;
int pilot_read(const char *name,unsigned char *out,size_t size,uint32_t crc) {
    (void)name;(void)crc;memset(out,0,size);return 1;
}
int pilot_prepare_data(void) { return pilot_font_read(); }
void *sceFontNewLib(SceFontLibData *data,int *error) {
    assert(data->maxFonts==1);*error=0;
    if(fault==1){*error=-1;return NULL;}
    assert(data->alloc(NULL,4096));return (void *)2;
}
void *sceFontOpenUserMemory(void *lib,char *data,unsigned int size,int *error) {
    assert(lib==(void *)2 && data==(char *)font_bytes && size==PILOT_PGF_BYTES);*error=0;
    if(fault==2){*error=-2;return NULL;}return (void *)3;
}
int sceFontGetFontInfo(void *font,SceFontInfo *info) {
    assert(font==(void *)1);memset(info,0,sizeof(*info));
    info->maxWidth=20;info->maxHeight=20;info->maxFixed.top=16*64;
    if(fault==3)info->maxWidth=0;
    if(fault==5)info->maxFixed.top=0;
    return fault==9?-9:0;
}
int sceFontGetCharInfo(void *font,unsigned short code,SceFontCharacterInfo *info) {
    (void)code;last_info=(unsigned int)(uintptr_t)font;memset(info,0,sizeof(*info));
    if(font==(void *)1){info->width=7;return 0;}
    assert(font==(void *)3);
    if(fault==10)return -10;
    if(char_allocation)assert(pilot_free(&pilot_font_state.pool,char_allocation));
    char_allocation=pilot_alloc(&pilot_font_state.pool,4);assert(char_allocation);
    info->width=2;info->height=2;info->y=2;info->data.hShift=128;
    if(fault==4)info->width=3;
    if(fault==8)assert(!pilot_alloc(&pilot_font_state.pool,UINT32_MAX));
    return 0;
}
int sceFontGetCharGlyphImage(void *font,unsigned short code,SceFontImageBuffer *image) {
    (void)code;last_image=(unsigned int)(uintptr_t)font;
    if(fault==11)return -11;
    if(image && image->data) {
        image->data[0]=image->data[1]=image->data[32]=image->data[33]=fault==6?0:255;
        if(fault==7)image->data[-1]=0;
    }
    return 0;
}
int main(int argc,char **argv) {
    assert(argc==2);fault=atoi(argv[1]);
    SceFontCharacterInfo c;SceFontInfo info;
    assert(!pilot_char_info((void *)1,65,&c));assert(last_info==1 && c.width==7);
    int result=pilot_font_info((void *)1,&info);
    if(fault) {
        assert(!pilot_font_state.ready && !pilot_font_state.active && pilot_font_state.error);
        if(fault==9)assert(result==-9);else assert(result==0);
        assert(!pilot_char_info((void *)1,65,&c) && last_info==1);
        puts("PASS font startup failure preserves original selection");return 0;
    }
    assert(result==0 && pilot_font_state.ready && pilot_font_state.active==PILOT_MODE);
    assert(info.maxWidth==20 && info.maxHeight==20 && info.maxFixed.top==1024);
    assert(!pilot_char_info((void *)1,65,&c));assert(last_info==(PILOT_MODE?3u:1u));
    assert(!pilot_char_image((void *)1,65,NULL));assert(last_image==last_info);
    assert(!pilot_char_info((void *)1,66,&c) && last_info==1);
    assert(!pilot_char_image((void *)1,66,NULL) && last_image==1);
    if(PILOT_MODE) {
        fault=10;assert(pilot_char_info((void *)1,65,&c)==-10);assert(!pilot_font_state.ready);
        fault=0;assert(!pilot_char_image((void *)1,65,NULL));assert(last_info==3 && last_image==3);
    }
    assert(pilot_font_state.pool.peak<=PILOT_POOL_BYTES);
    puts("PASS font gating, original metrics, dispatch and resident fallback consistency");
}
