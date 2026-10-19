#ifndef P2G_TEST_FONT_H
#define P2G_TEST_FONT_H
typedef struct {unsigned int width,height;int top,bottom,shiftX,shiftY,shiftVertX,shiftVertY,hShift,vShift;} SceFontCharacterData;
typedef struct {SceFontCharacterData maxFixed;char maxFloat[40];unsigned short maxWidth,maxHeight;char remainder[180];} SceFontInfo;
typedef struct {unsigned int width,height;int x,y;SceFontCharacterData data;char unknown[4];} SceFontCharacterInfo;
typedef struct {unsigned short width,height;} SceFontRect;
typedef struct {unsigned int pixelFormat;int x,y;SceFontRect size;unsigned short bytesPerLine;short unknown;unsigned char *data;} SceFontImageBuffer;
typedef struct {void *unknown;unsigned int maxFonts;void *cache;void *(*alloc)(void *,unsigned int);void (*free)(void *,void *);} SceFontLibData;
#define SCE_FONT_PIXEL_FORMAT_8 2
void *sceFontNewLib(SceFontLibData *,int *);
void *sceFontOpenUserMemory(void *,char *,unsigned int,int *);
int sceFontGetFontInfo(void *,SceFontInfo *);
int sceFontGetCharInfo(void *,unsigned short,SceFontCharacterInfo *);
int sceFontGetCharGlyphImage(void *,unsigned short,SceFontImageBuffer *);
#endif
