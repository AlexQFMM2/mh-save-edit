#include "pilot_font.h"
#include "pilot_io.h"
#include "probe_core.h"
#include "pilot_profile.h"
#include <string.h>
_Static_assert(sizeof(SceFontInfo)==264, "Unexpected font-info ABI");
_Static_assert(sizeof(SceFontCharacterInfo)==60, "Unexpected character-info ABI");
_Static_assert(sizeof(void *)!=4 || sizeof(SceFontImageBuffer)==24, "Unexpected glyph-image ABI");

PilotFontState pilot_font_state __attribute__((aligned(16)));
static unsigned char font_bytes[PILOT_PGF_BYTES] __attribute__((aligned(16)));
static const PilotGlyph glyphs[] = PILOT_GLYPHS;
static void *library, *external, *original;
static unsigned char scratch[32*32+32] __attribute__((aligned(16)));

static void *allocate(void *context, unsigned int size) {
    (void)context; return pilot_alloc(&pilot_font_state.pool,size);
}
static void release(void *context, void *pointer) {
    (void)context; pilot_free(&pilot_font_state.pool,pointer);
}
static SceFontLibData parameters = { .maxFonts=1, .alloc=allocate, .free=release };
static int font_fail(unsigned int stage, int error) {
    pilot_font_state.error=stage; pilot_font_state.error_code=(uint32_t)error;
    pilot_font_state.ready=0;
    return 0;
}
int pilot_font_read(void) { return pilot_read("zh-cn.pgf",font_bytes,sizeof(font_bytes),PILOT_PGF_CRC); }
static int preflight(const SceFontInfo *info) {
    int error=0;
    if (!library) library=sceFontNewLib(&parameters,&error);
    if (!library || error) return font_fail(1,error);
    if (!external) external=sceFontOpenUserMemory(library,(char *)font_bytes,sizeof(font_bytes),&error);
    if (!external || error) return font_fail(2,error);
    unsigned int width=(info->maxWidth+1u)&~1u, height=(info->maxHeight+1u)&~1u;
    if (!width || width>32 || !height || height>32 || info->maxFixed.top<0 || info->maxFixed.top>2048)
        return font_fail(3,0);
    for (unsigned int i=0;i<sizeof(glyphs)/sizeof(glyphs[0]);++i) {
        const PilotGlyph *g=&glyphs[i];
        SceFontCharacterInfo c;
        error=sceFontGetCharInfo(external,g->code,&c);
        if (error || c.width!=g->width || c.height!=g->height || c.x!=g->left || c.y!=g->top || c.data.hShift!=g->advance)
            return font_fail(4,error);
        int top=64+info->maxFixed.top-c.y*64;
        if (c.x<0 || c.width>width || (unsigned int)c.x>width-c.width || top<0 ||
            top+(int)c.height*64>(int)(height+2)*64) return font_fail(5,g->code);
        memset(scratch,0xa5,sizeof(scratch)); memset(scratch+16,0,1024);
        SceFontImageBuffer image={.pixelFormat=SCE_FONT_PIXEL_FORMAT_8, .size={32,32}, .bytesPerLine=32, .data=scratch+16};
        error=sceFontGetCharGlyphImage(external,g->code,&image);
        if (error || probe_crc32(scratch+16,1024)!=g->bitmap_crc) return font_fail(6,error?error:(int)g->code);
        for (unsigned int k=0;k<16;++k) if (scratch[k]!=0xa5 || scratch[1040+k]!=0xa5) return font_fail(7,g->code);
    }
    if (pilot_font_state.pool.failures) return font_fail(8,0);
    return 1;
}
int pilot_font_info(void *font, SceFontInfo *info) {
    int result=sceFontGetFontInfo(font,info);
    ++pilot_font_state.initialized;
    if (result) { font_fail(9,result); return result; }
    pilot_font_state.original_width=info->maxWidth; pilot_font_state.original_height=info->maxHeight;
    pilot_font_state.original_ascender=info->maxFixed.top;
    /* This call precedes initializeGlyphIndex/cacheCommonGlyphs. Never enable
       a font on a late timer: the game cache is keyed only by codepoint. */
    pilot_font_state.ready=0;
    if (!pilot_font_state.error && preflight(info)) {
        original=font; pilot_font_state.ready=1;
        pilot_font_state.active=PILOT_MODE;
    }
    return result;
}
static void *select_font(void *font, unsigned short code) {
    if (pilot_font_state.active && font==original) {
        unsigned int lo=0,hi=sizeof(glyphs)/sizeof(glyphs[0]);
        while (lo<hi) { unsigned int m=lo+(hi-lo)/2; if (glyphs[m].code<code) lo=m+1; else hi=m; }
        if (lo<sizeof(glyphs)/sizeof(glyphs[0]) && glyphs[lo].code==code) return external;
    }
    return font;
}
int pilot_char_info(void *font, unsigned short code, SceFontCharacterInfo *info) {
    void *selected=select_font(font,code);
    int result=sceFontGetCharInfo(selected,code,info);
    if (selected==external) {
        ++pilot_font_state.info_calls;
        if (result || pilot_font_state.pool.failures) font_fail(10,result);
    }
    return result;
}
int pilot_char_image(void *font, unsigned short code, SceFontImageBuffer *image) {
    void *selected=select_font(font,code);
    int result=sceFontGetCharGlyphImage(selected,code,image);
    if (selected==external) {
        ++pilot_font_state.image_calls;
        if (result || pilot_font_state.pool.failures) font_fail(11,result);
    }
    /* On a late fault, reject new translations but keep the same font for
       existing resident strings and cached metrics until the cold restart. */
    return result;
}
