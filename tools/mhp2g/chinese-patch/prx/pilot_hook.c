#include <pspkernel.h>
#include <pspintrman.h>
#include <stdio.h>
#include <string.h>
#include "pilot_hook.h"
#include "pilot_core.h"
#include "pilot_io.h"
#include "pilot_font.h"
#include "pilot_profile.h"
#ifdef BATCH
#include "pilot_quest.h"
#endif

static unsigned char text_bytes[PILOT_TEXT_BYTES];
static PilotText text;
enum { DATA_PENDING, DATA_LOADING, DATA_READY, DATA_FAILED };
static volatile unsigned int data_state, installed;
#ifndef BATCH
static const uint32_t dialogue_header[34]=PILOT_DIALOGUE_HEADER;
#endif
static uint32_t query_trampoline[4] __attribute__((aligned(16)));
static uint32_t talk_trampoline[4] __attribute__((aligned(16)));
#ifdef BATCH
static uint32_t find_trampoline[4] __attribute__((aligned(16)));
static uint32_t scene_trampoline[4] __attribute__((aligned(16)));
static uint32_t tutorial_trampoline[4] __attribute__((aligned(16)));
static uint32_t training_trampoline[4] __attribute__((aligned(16)));
static uint32_t quest_main_trampoline[4] __attribute__((aligned(16)));
static uint32_t quest_list_trampoline[4] __attribute__((aligned(16)));
static uint32_t quest_training_trampoline[4] __attribute__((aligned(16)));
static uint32_t quest_copy_trampoline[4] __attribute__((aligned(16)));
static PilotQuestCopy quest_copies[16];
static const uint16_t quest_order[]=PILOT_QUEST_OFFSET_ORDER;
static uint32_t first_hits, total_selected, total_replaced;
static const uint16_t offset_order[]=PILOT_OFFSET_ORDER;
typedef struct { uint32_t member,size,words; uint32_t header[34]; } ResourceProfile;
static const ResourceProfile profiles[]=PILOT_RESOURCE_PROFILES;
static void scene_install(void);
#endif
typedef const char *(*Query)(void *, unsigned int, unsigned int);
typedef const char *(*QuestQuery)(void *, unsigned int);
typedef int (*Talk)(void *, const char *, unsigned int, unsigned int, unsigned int);
typedef unsigned char *(*FindResource)(void *, unsigned int);
static volatile uint32_t selected[PILOT_MAX_ROWS], replaced[PILOT_MAX_ROWS], rejected, disabled;

static int ram(const void *p, size_t size) {
    uintptr_t at=(uintptr_t)p;
    return at>=0x08800000u && at<=0x0a000000u && size<=0x0a000000u-at;
}
static const char *choose(const PilotRow *row, const char *result) {
    if (data_state!=DATA_READY) return result;
    unsigned int i=(unsigned int)(row-text.rows);
    if (selected[i]!=UINT32_MAX) ++selected[i];
#ifdef BATCH
    if (total_selected!=UINT32_MAX) ++total_selected;
#endif
    if (PILOT_MODE && !disabled && pilot_font_state.ready && !pilot_font_state.error) {
        if (replaced[i]!=UINT32_MAX) ++replaced[i];
#ifdef BATCH
        if (total_replaced!=UINT32_MAX) ++total_replaced;
#endif
        return row->translated;
    }
    return result;
}
static const char *replace(const PilotRow *row, const unsigned char *base, const char *result) {
    if (!ram(base,row->resource_size) || !pilot_source(row,base,row->resource_size,result)) {
        if (rejected!=UINT32_MAX) ++rejected;
        disabled=1; return result;
    }
    return choose(row,result);
}
#ifdef BATCH
static FindResource resource_finder(void) { return (FindResource)find_trampoline; }
static uint32_t resource_member(const unsigned char *base) {
    for (uint32_t i=0;i<sizeof(profiles)/sizeof(profiles[0]);++i) {
        const ResourceProfile *p=&profiles[i];
        if (ram(base,p->size) && !memcmp(base,p->header,p->words*4)) return p->member;
    }
    return 0;
}
static const PilotRow *offset_row(uint32_t member, uint32_t offset) {
    if (data_state!=DATA_READY) return NULL;
    uint32_t lo=0,hi=sizeof(offset_order)/sizeof(offset_order[0]);
    while (lo<hi) {
        uint32_t mid=lo+(hi-lo)/2;
        const PilotRow *r=&text.rows[offset_order[mid]];
        if (r->member<member || (r->member==member && r->offset<offset)) lo=mid+1; else hi=mid;
    }
    if (lo<sizeof(offset_order)/sizeof(offset_order[0])) {
        const PilotRow *r=&text.rows[offset_order[lo]];
        if (r->member==member && r->offset==offset) return r;
    }
    return NULL;
}
static const char *overlay_text(uint32_t member, const char *result, unsigned int table, unsigned int index) {
    if (data_state!=DATA_READY) return result;
    const PilotRow *row=pilot_find(&text,member,table,index&0xffffu);
    if (row) {
        void *manager=*(void * volatile *)PILOT_RESOURCE_MANAGER;
        if (ram(manager,PILOT_RESOURCE_MANAGER_BYTES)) {
            const unsigned char *base=resource_finder()(manager,4);
            if (resource_member(base)==member) return replace(row,base,result);
        }
    }
    return result;
}
static const char *scene_hook(void *object, unsigned int table, unsigned int index) {
    return overlay_text(4757,((Query)scene_trampoline)(object,table,index),table,index);
}
static const char *tutorial_hook(void *object, unsigned int table, unsigned int index) {
    return overlay_text(4756,((Query)tutorial_trampoline)(object,table,index),table,index);
}
static const char *training_hook(void *object, unsigned int table, unsigned int index) {
    return overlay_text(4758,((Query)training_trampoline)(object,table,index),table,index);
}
static const char *quest_result(const unsigned char *base, const char *result, unsigned int field) {
    if (data_state!=DATA_READY || !base) return result;
    const PilotRow *row=pilot_quest_source(&text,quest_order,PILOT_QUEST_COUNT,base,result,field);
    return row?replace(row,base,result):result;
}
static const char *quest_main_hook(void *object, unsigned int field) {
    const char *result=((QuestQuery)quest_main_trampoline)(object,field);
    if (data_state!=DATA_READY) return result;
    const PilotRow *copied=pilot_quest_copy(quest_copies,result,field);
    if (copied) return choose(copied,result);
    if (!ram(object,92)) return result;
    return quest_result((const unsigned char *)(uintptr_t)pilot_word((const unsigned char *)object+80),result,field);
}
static const char *quest_list_hook(void *object, unsigned int field) {
    const char *result=((QuestQuery)quest_list_trampoline)(object,field);
    if (!ram(object,28)) return result;
    const unsigned char *p=object;
    unsigned int id=p[4]|(unsigned int)p[5]<<8;
    return quest_result((const unsigned char *)(uintptr_t)pilot_word(p+(id<60000?20:24)),result,field);
}
static const char *quest_training_hook(void *object, const unsigned char *base, void *record, unsigned int field) {
    typedef const char *(*TrainingQuest)(void *, const unsigned char *, void *, unsigned int);
    const char *result=((TrainingQuest)quest_training_trampoline)(object,base,record,field);
    return quest_result(base,result,field);
}
static const char *quest_copy_hook(void *object, unsigned int field) {
    const char *result=((QuestQuery)quest_copy_trampoline)(object,field);
    if (data_state!=DATA_READY) return result;
    const PilotRow *row=pilot_quest_copy(quest_copies,result,field);
    return row?choose(row,result):result;
}
static char *quest_capture_field(char *destination, const char *source, uint32_t field) {
    const PilotRow *row=data_state==DATA_READY?
        pilot_quest_source(&text,quest_order,PILOT_QUEST_COUNT,NULL,source,field):NULL;
    char *result=((char *(*)(char *,const char *))PILOT_STRING_COPY)(destination,source);
    /* Capture identity only. The original copy never receives translated text. */
    pilot_quest_capture(quest_copies,row,destination);
    return result;
}
#define QUEST_CAPTURE(n) static char *quest_capture_##n(char *d,const char *s) { return quest_capture_field(d,s,n); }
QUEST_CAPTURE(0) QUEST_CAPTURE(1) QUEST_CAPTURE(2) QUEST_CAPTURE(3) QUEST_CAPTURE(4) QUEST_CAPTURE(5)
#undef QUEST_CAPTURE
static unsigned char *resource_hook(void *object, unsigned int tag) {
    unsigned char *result=resource_finder()(object,tag);
    /* An overlay can be reloaded. Verify its instruction window on every
       candidate installation; never write an address just because it matches. */
    if (tag==4) scene_install();
    return result;
}
#endif
static const char *query_hook(void *object, unsigned int table, unsigned int index) {
    const char *result=((Query)query_trampoline)(object,table,index);
    if (data_state!=DATA_READY) return result;
    const PilotRow *row=pilot_find(&text,15,table,index&0xffffu);
    return row?replace(row,(const unsigned char *)PILOT_CORE_BASE,result):result;
}
static int talk_hook(void *self, const char *message, unsigned int progress, unsigned int mode, unsigned int extra) {
    if (data_state==DATA_READY && mode!=3 && mode!=4 && message) {
        void *manager=*(void * volatile *)PILOT_RESOURCE_MANAGER;
        if (ram(manager,PILOT_RESOURCE_MANAGER_BYTES)) {
            const unsigned char *base=
#ifdef BATCH
                resource_finder()(manager,5);
            uint32_t member=resource_member(base);
            if (member>=5369 && member<=5372 && (uintptr_t)message>=(uintptr_t)base &&
                (uintptr_t)message-(uintptr_t)base<UINT32_MAX) {
                const PilotRow *row=offset_row(member,(uint32_t)((uintptr_t)message-(uintptr_t)base));
                if (row) message=replace(row,base,message);
            }
#else
                ((FindResource)PILOT_FIND_RESOURCE)(manager,5);
            if (ram(base,PILOT_DIALOGUE_BYTES) && !memcmp(base,dialogue_header,sizeof(dialogue_header))) {
                for (uint32_t i=0;i<text.count;++i) {
                    const PilotRow *row=&text.rows[i];
                    if (row->member==5370 && (uintptr_t)message==(uintptr_t)base+row->offset) {
                        message=replace(row,base,message); break;
                    }
                }
            }
#endif
        }
    }
    return ((Talk)talk_trampoline)(self,message,progress,mode,extra);
}
typedef struct { uint32_t address; uint32_t words[2]; void *replacement; int entry; } Patch;
static const Patch patches[]={
    {PILOT_QUERY_ADDRESS, PILOT_QUERY_WORDS, query_hook, 1},
    {PILOT_TALK_ADDRESS, PILOT_TALK_WORDS, talk_hook, 1},
    {PILOT_INFO_ADDRESS, PILOT_INFO_WORDS, pilot_font_info, 0},
    {PILOT_CHAR_ADDRESS, PILOT_CHAR_WORDS, pilot_char_info, 0},
    {PILOT_IMAGE_ADDRESS, PILOT_IMAGE_WORDS, pilot_char_image, 0},
    {PILOT_IMAGE2_ADDRESS, PILOT_IMAGE2_WORDS, pilot_char_image, 0},
#ifdef BATCH
    {PILOT_FIND_RESOURCE, PILOT_FIND_FIRST_WORDS, resource_hook, 1},
    {PILOT_QUEST_MAIN_ADDRESS, PILOT_QUEST_MAIN_WORDS, quest_main_hook, 1},
#endif
};
static void cache(void *p, unsigned int size) {
    sceKernelDcacheWritebackRange(p,size); sceKernelIcacheInvalidateRange(p,size);
}
#ifdef BATCH
static void scene_install(void) {
    typedef struct { uint32_t address,words[16]; void *hook; uint32_t *trampoline; } OverlayPatch;
    static const OverlayPatch overlays[]={
        {PILOT_SCENE_ADDRESS,PILOT_SCENE_WINDOW,scene_hook,scene_trampoline},
        {PILOT_TUTORIAL_ADDRESS,PILOT_TUTORIAL_WINDOW,tutorial_hook,tutorial_trampoline},
        {PILOT_TRAINING_ADDRESS,PILOT_TRAINING_WINDOW,training_hook,training_trampoline},
        {PILOT_QUEST_LIST_ADDRESS,PILOT_QUEST_LIST_WINDOW,quest_list_hook,quest_list_trampoline},
        {PILOT_QUEST_TRAINING_ADDRESS,PILOT_QUEST_TRAINING_WINDOW,quest_training_hook,quest_training_trampoline},
        {PILOT_QUEST_COPY_ADDRESS,PILOT_QUEST_COPY_WINDOW,quest_copy_hook,quest_copy_trampoline},
    };
    for (uint32_t i=0;i<sizeof(overlays)/sizeof(overlays[0]);++i) {
        const OverlayPatch *p=&overlays[i];
        volatile uint32_t *site=(volatile uint32_t *)(uintptr_t)p->address;
        uint32_t jump=0x08000000u|(((uintptr_t)p->hook&0x0fffffffu)>>2);
        if (site[0]==jump && site[1]==0) continue;
        if (((uintptr_t)p->hook&0xf0000000u)!=(p->address&0xf0000000u) ||
            memcmp((const void *)site,p->words,sizeof(p->words))) continue;
        p->trampoline[0]=p->words[0]; p->trampoline[1]=p->words[1];
        p->trampoline[2]=0x08000000u|((p->address+8)>>2); p->trampoline[3]=0;
        cache(p->trampoline,16);
        unsigned int state=sceKernelCpuSuspendIntr();
        if (!memcmp((const void *)site,p->words,sizeof(p->words))) {
            site[0]=jump;site[1]=0;cache((void *)site,8);
        }
        sceKernelCpuResumeIntr(state);
    }
    static char *(*const capture_hooks[])(char *,const char *)={quest_capture_0,quest_capture_1,quest_capture_2,
        quest_capture_3,quest_capture_4,quest_capture_5};
    static const struct { uint32_t address,field,words[16]; } copies[]=PILOT_QUEST_COPY_SITES;
    for (uint32_t i=0;i<sizeof(copies)/sizeof(copies[0]);++i) {
        volatile uint32_t *site=(volatile uint32_t *)(uintptr_t)copies[i].address;
        uintptr_t hook=(uintptr_t)capture_hooks[copies[i].field];
        if ((hook&0xf0000000u)!=(copies[i].address&0xf0000000u) ||
            memcmp((const void *)site,copies[i].words,sizeof(copies[i].words))) continue;
        unsigned int state=sceKernelCpuSuspendIntr();
        if (!memcmp((const void *)site,copies[i].words,sizeof(copies[i].words))) {
            site[0]=0x0c000000u|((hook&0x0fffffffu)>>2);
            cache((void *)site,4);
        }
        sceKernelCpuResumeIntr(state);
    }
}
#endif
static int install(void) {
    for (unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i) {
        const Patch *p=&patches[i];
        if (memcmp((const void *)p->address,p->words,8) ||
            ((uintptr_t)p->replacement&0xf0000000u)!=(p->address&0xf0000000u)) return 0;
    }
    const uint32_t find_words[]=PILOT_FIND_WORDS;
    if (memcmp((const void *)PILOT_FIND_RESOURCE,find_words,sizeof(find_words))) return 0;
#ifdef BATCH
    const uint32_t quest_words[]=PILOT_QUEST_MAIN_WINDOW;
    if (memcmp((const void *)PILOT_QUEST_MAIN_ADDRESS,quest_words,sizeof(quest_words))) return 0;
    quest_main_trampoline[0]=quest_words[0];quest_main_trampoline[1]=quest_words[1];
    quest_main_trampoline[2]=0x08000000u|((PILOT_QUEST_MAIN_ADDRESS+8)>>2);quest_main_trampoline[3]=0;
    cache(quest_main_trampoline,16);
#endif
    for (unsigned int i=0;i<2;++i) {
        uint32_t *t=i?talk_trampoline:query_trampoline;
        t[0]=patches[i].words[0]; t[1]=patches[i].words[1];
        t[2]=0x08000000u|((patches[i].address+8)>>2); t[3]=0; cache(t,16);
    }
#ifdef BATCH
    find_trampoline[0]=find_words[0];find_trampoline[1]=find_words[1];
    find_trampoline[2]=0x08000000u|((PILOT_FIND_RESOURCE+8)>>2);find_trampoline[3]=0;
    cache(find_trampoline,16);
#endif
    unsigned int state=sceKernelCpuSuspendIntr();
    for (unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i) {
        if (memcmp((const void *)patches[i].address,patches[i].words,8)) {
            sceKernelCpuResumeIntr(state); return 0;
        }
    }
    for (unsigned int i=0;i<sizeof(patches)/sizeof(patches[0]);++i) {
        const Patch *p=&patches[i]; volatile uint32_t *site=(volatile uint32_t *)p->address;
        site[0]=(p->entry?0x08000000u:0x0c000000u)|(((uintptr_t)p->replacement&0x0fffffffu)>>2);
        if (p->entry) site[1]=0;
        cache((void *)site,8);
    }
    installed=1;
    sceKernelCpuResumeIntr(state);
    return 1;
}
int pilot_install(void) {
    if (!installed) installed=install();
    return installed;
}
void pilot_disable(void) { disabled=1; }
int pilot_prepare_data(void) {
    if (data_state==DATA_READY) return 1;
    /* A recursive/concurrent initialization must not publish partial rows. */
    if (data_state!=DATA_PENDING || !installed) { data_state=DATA_FAILED; return 0; }
    data_state=DATA_LOADING;
    if (!pilot_read("texts.bin",text_bytes,sizeof(text_bytes),PILOT_TEXT_CRC) ||
        data_state!=DATA_LOADING ||
        !pilot_parse(&text,text_bytes,sizeof(text_bytes)) || !pilot_font_read() || data_state!=DATA_LOADING) {
        data_state=DATA_FAILED; return 0;
    }
    data_state=DATA_READY;
    return 1;
}
void pilot_run(ProbeLog *log) {
    if (!installed) { probe_event(log,"version_mismatch","no_patches=1"); return; }
    if (!probe_event(log,"installed","font_gate=initialization")) { disabled=1; return; }
#ifndef BATCH
    uint32_t previous_selected[PILOT_MAX_ROWS]={0}, previous_replaced[PILOT_MAX_ROWS]={0};
#endif
    uint32_t previous_init=0, previous_error=0, previous_rejected=0, config_logged=0;
    for (uint32_t tick=0;;++tick) {
        sceKernelDelayThread(5000000);
        char fields[240];
        if (!config_logged && (data_state==DATA_READY || data_state==DATA_FAILED)) {
            int ok=data_state==DATA_READY;
            probe_event(log,ok?"config_ok":"config_error",ok?"package=pilot":"replacement_disabled=1");
            config_logged=1;
        }
        if (pilot_font_state.initialized!=previous_init) {
            snprintf(fields,sizeof(fields),"width=%lu height=%lu ascender=%ld ready=%lu active=%lu pool_peak=%lu",
                (unsigned long)pilot_font_state.original_width,(unsigned long)pilot_font_state.original_height,
                (long)pilot_font_state.original_ascender,(unsigned long)pilot_font_state.ready,
                (unsigned long)pilot_font_state.active,(unsigned long)pilot_font_state.pool.peak);
            probe_event(log,"font_metrics",fields); previous_init=pilot_font_state.initialized;
        }
        if (tick==11 && !previous_init && !pilot_font_state.preparing)
            probe_event(log,"font_init_missed","replacement_disabled=1");
        if (pilot_font_state.error!=previous_error) {
            snprintf(fields,sizeof(fields),"stage=%lu code=%lu replacement_disabled=1",
                (unsigned long)pilot_font_state.error,(unsigned long)pilot_font_state.error_code);
            probe_event(log,"font_error",fields); previous_error=pilot_font_state.error;
        }
        if (rejected!=previous_rejected) { probe_event(log,"original_mismatch","replacement_disabled=1"); previous_rejected=rejected; }
#ifdef BATCH
        if (data_state==DATA_READY && first_hits<64) for (uint32_t i=0;i<text.count && first_hits<64;++i) {
            if (!selected[i] || (selected[i]&0x80000000u)) continue;
            snprintf(fields,sizeof(fields),"key=%lu:%lu:%lu selected=%lu replaced=%lu",
                (unsigned long)text.rows[i].member,(unsigned long)text.rows[i].table,
                (unsigned long)text.rows[i].index,(unsigned long)selected[i],(unsigned long)replaced[i]);
            probe_event(log,"text_summary",fields);selected[i]|=0x80000000u;++first_hits;
        }
        if (tick%6==0) {
            snprintf(fields,sizeof(fields),"selected=%lu replaced=%lu entries=%lu",
                (unsigned long)total_selected,(unsigned long)total_replaced,(unsigned long)text.count);
            probe_event(log,"batch_summary",fields);
        }
#else
        for (uint32_t i=0;data_state==DATA_READY && i<text.count;++i) {
            uint32_t a=selected[i],b=replaced[i];
            if (a==previous_selected[i] && b==previous_replaced[i]) continue;
            snprintf(fields,sizeof(fields),"key=%lu:%lu:%lu selected=%lu replaced=%lu",
                (unsigned long)text.rows[i].member,(unsigned long)text.rows[i].table,(unsigned long)text.rows[i].index,
                (unsigned long)a,(unsigned long)b);
            probe_event(log,"text_summary",fields); previous_selected[i]=a; previous_replaced[i]=b;
        }
#endif
        if (tick%6==0) {
            snprintf(fields,sizeof(fields),"info=%lu image=%lu pool_used=%lu pool_peak=%lu pool_failures=%lu",
                (unsigned long)pilot_font_state.info_calls,(unsigned long)pilot_font_state.image_calls,
                (unsigned long)pilot_font_state.pool.used,(unsigned long)pilot_font_state.pool.peak,
                (unsigned long)pilot_font_state.pool.failures);
            probe_event(log,"font_summary",fields);
        }
        if (log->failed) { disabled=1; return; }
        if (log->capped) {
#ifndef BATCH
            disabled=1;
#endif
            return;
        }
    }
}
