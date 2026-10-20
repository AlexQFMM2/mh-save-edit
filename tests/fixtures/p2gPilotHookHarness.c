#define _GNU_SOURCE
#include <assert.h>
#include <sys/mman.h>
#include <stdio.h>
#include <string.h>
#include "pilot_hook.c"
PilotFontState pilot_font_state;
static unsigned int cached;
unsigned int sceKernelCpuSuspendIntr(void){return 7;}
void sceKernelCpuResumeIntr(unsigned int n){assert(n==7);}
void sceKernelDcacheWritebackRange(const void *p,unsigned int n){assert(p && n);++cached;}
void sceKernelIcacheInvalidateRange(const void *p,unsigned int n){assert(p && n);++cached;}
int sceKernelDelayThread(unsigned int n){(void)n;assert(0);return 0;}
int pilot_read(const char *n,unsigned char *p,size_t z,uint32_t c){(void)n;(void)p;(void)z;(void)c;return 0;}
int pilot_font_read(void){return 0;}
int pilot_font_info(void *p,SceFontInfo *i){(void)p;(void)i;return 0;}
int pilot_char_info(void *p,unsigned short c,SceFontCharacterInfo *i){(void)p;(void)c;(void)i;return 0;}
int pilot_char_image(void *p,unsigned short c,SceFontImageBuffer *i){(void)p;(void)c;(void)i;return 0;}
static void reset(void) {
    for(unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i)memcpy((void *)(uintptr_t)patches[i].address,patches[i].words,8);
    const uint32_t find_words[]=PILOT_FIND_WORDS;memcpy((void *)PILOT_FIND_RESOURCE,find_words,sizeof(find_words));
#ifdef BATCH
    const uint32_t quest_words[]=PILOT_QUEST_MAIN_WINDOW;
    memcpy((void *)PILOT_QUEST_MAIN_ADDRESS,quest_words,sizeof(quest_words));
#endif
}
int main(void) {
    void *memory=mmap((void *)0x08800000,0x1800000,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS|MAP_FIXED_NOREPLACE,-1,0);
    assert(memory==(void *)0x08800000);
    for(unsigned int target=0;target<sizeof(patches)/sizeof(patches[0]);++target) {
        reset();*(uint32_t *)(uintptr_t)patches[target].address^=1;
        assert(!install());
        for(unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i)if(i!=target)assert(!memcmp((void *)(uintptr_t)patches[i].address,patches[i].words,8));
    }
    reset();*(uint32_t *)PILOT_FIND_RESOURCE^=1;assert(!install());
    reset();assert(install());assert(cached);
    for(unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i) {
        uint32_t *site=(uint32_t *)(uintptr_t)patches[i].address;
        assert((site[0]>>26)==(patches[i].entry?2u:3u));
        assert(site[1]==(patches[i].entry?0:patches[i].words[1]));
    }
    assert(query_trampoline[0]==patches[0].words[0] && talk_trampoline[1]==patches[1].words[1]);
#ifdef BATCH
    reset();((uint32_t *)PILOT_QUEST_MAIN_ADDRESS)[15]^=1;assert(!install());
    assert(!memcmp((void *)(uintptr_t)patches[0].address,patches[0].words,8));
    const uint32_t scene_words[]=PILOT_SCENE_WINDOW;
    uint32_t *scene=(uint32_t *)PILOT_SCENE_ADDRESS;
    memcpy(scene,scene_words,sizeof(scene_words));scene[2]^=1;
    scene_install();assert(scene[0]==scene_words[0]);
    memcpy(scene,scene_words,sizeof(scene_words));scene_install();
    assert((scene[0]>>26)==2 && scene[1]==0);
    assert(scene_trampoline[0]==scene_words[0] && scene_trampoline[1]==scene_words[1]);
    uint32_t patched=scene[0];scene_install();assert(scene[0]==patched);
    memcpy(scene,scene_words,sizeof(scene_words));scene_install();assert(scene[0]==patched);
    const struct {uint32_t address,words[16];uint32_t *trampoline;} overlays[]={
        {PILOT_TUTORIAL_ADDRESS,PILOT_TUTORIAL_WINDOW,tutorial_trampoline},
        {PILOT_TRAINING_ADDRESS,PILOT_TRAINING_WINDOW,training_trampoline},
        {PILOT_QUEST_LIST_ADDRESS,PILOT_QUEST_LIST_WINDOW,quest_list_trampoline},
        {PILOT_QUEST_TRAINING_ADDRESS,PILOT_QUEST_TRAINING_WINDOW,quest_training_trampoline},
        {PILOT_QUEST_COPY_ADDRESS,PILOT_QUEST_COPY_WINDOW,quest_copy_trampoline}};
    for(unsigned int i=0;i<sizeof(overlays)/sizeof(overlays[0]);++i) {
        uint32_t *site=(uint32_t *)(uintptr_t)overlays[i].address;
        memcpy(site,overlays[i].words,64);site[15]^=1;scene_install();assert(site[0]==overlays[i].words[0]);
        memcpy(site,overlays[i].words,64);scene_install();assert((site[0]>>26)==2 && site[1]==0);
        assert(overlays[i].trampoline[0]==overlays[i].words[0] && overlays[i].trampoline[1]==overlays[i].words[1]);
        uint32_t jump=site[0];scene_install();assert(site[0]==jump);
        memcpy(site,overlays[i].words,64);scene_install();assert(site[0]==jump);
    }
    const struct {uint32_t address,field,words[16];} copies[]=PILOT_QUEST_COPY_SITES;
    for(unsigned int i=0;i<sizeof(copies)/sizeof(copies[0]);++i) {
        uint32_t *site=(uint32_t *)(uintptr_t)copies[i].address;
        memcpy(site,copies[i].words,64);site[15]^=1;scene_install();assert(site[0]==copies[i].words[0]);
        memcpy(site,copies[i].words,64);scene_install();assert(site[0]>>26==3 && site[1]==copies[i].words[1]);
        uint32_t jump=site[0];scene_install();assert(site[0]==jump);
        memcpy(site,copies[i].words,64);scene_install();assert(site[0]==jump);
    }
#endif
    unsigned char *base=(unsigned char *)PILOT_CORE_BASE;
    assert(choose(NULL,(const char *)base)==(const char *)base);
#ifdef BATCH
    assert(!offset_row(5369,0));
    assert(overlay_text(4757,(const char *)base,0,0)==(const char *)base);
    assert(quest_result(base,(const char *)base,0)==(const char *)base);
#endif
    uint32_t *words=(uint32_t *)base;words[0]=23;words[1]=8;words[3]=100;words[26]=800;
    memcpy(base+900,"ORIGINAL",9);
    data_state=DATA_READY;
    text.count=1;text.rows[0]=(PilotRow){.member=15,.table=1,.index=1,.offset=900,.resource_size=1024,
        .original="ORIGINAL",.translated="REPLACEMENT",.original_size=8,.translated_size=11};
    assert(replace(&text.rows[0],base,(char *)base+900)==(char *)base+900);
    pilot_font_state.ready=1;
    assert(replace(&text.rows[0],base,(char *)base+900)==text.rows[0].translated);
    base[900]='X';assert(replace(&text.rows[0],base,(char *)base+900)==(char *)base+900);
    assert(disabled && rejected==1 && replaced[0]==1);
    base[900]='O';assert(replace(&text.rows[0],base,(char *)base+900)==(char *)base+900);
    assert(!ram((void *)0x0a000000,1));assert(!ram((void *)0x087fffff,1));
    assert(!munmap(memory,0x1800000));
    puts("PASS pilot version guards, patch transaction, trampolines, delay slots and text gate");
}
