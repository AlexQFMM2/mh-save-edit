#ifndef P2G_PILOT_FONT_H
#define P2G_PILOT_FONT_H
#include <pspfont.h>
#include "pilot_core.h"
typedef struct { uint32_t code, width, height; int left, top, advance; uint32_t bitmap_crc; } PilotGlyph;
typedef struct {
    volatile uint32_t initialized, preparing, ready, active, error, error_code, info_calls, image_calls;
    uint32_t original_width, original_height;
    int original_ascender;
    PilotPool pool;
} PilotFontState;
extern PilotFontState pilot_font_state;
int pilot_font_info(void *font, SceFontInfo *info);
int pilot_char_info(void *font, unsigned short code, SceFontCharacterInfo *info);
int pilot_char_image(void *font, unsigned short code, SceFontImageBuffer *image);
int pilot_font_read(void);
#endif
