#include "pilot_core.h"
#include "probe_core.h"
#include <string.h>

uint32_t pilot_word(const unsigned char *p) {
    return (uint32_t)p[0] | (uint32_t)p[1]<<8 | (uint32_t)p[2]<<16 | (uint32_t)p[3]<<24;
}
int pilot_utf8(const unsigned char *p, size_t n) {
    for (size_t i=0; i<n;) {
        unsigned int c=p[i++], tail=0, min=0;
        if (c<128) { if (c<32 && c!=10) return 0; continue; }
        if (c>=0xc2 && c<=0xdf) { tail=1; min=128; c&=31; }
        else if (c>=0xe0 && c<=0xef) { tail=2; min=2048; c&=15; }
        else return 0;
        if (tail>n-i) return 0;
        while (tail--) { unsigned int b=p[i++]; if ((b&0xc0)!=0x80) return 0; c=(c<<6)|(b&63); }
        if (c<min || c>=0xfff0 || (c>=0xd800 && c<=0xdfff)) return 0;
    }
    return n!=0;
}
static int row_order(const PilotRow *a, const PilotRow *b) {
    if (a->member!=b->member) return a->member<b->member;
    if (a->table!=b->table) return a->table<b->table;
    return a->index<b->index;
}
static int identity(const PilotRow *r) {
#ifdef BATCH
    if (r->index>=65535) return 0;
    if (r->member==15) return r->table<19 && !r->flag;
    if (r->member>=4756 && r->member<=4758)
        return r->table<(r->member==4756?2u:r->member==4757?4u:1u) && !r->flag;
    if (r->member>=4759 && r->member<=5322)
        return !(r->table%4) && r->table<=r->resource_size &&
            r->resource_size-r->table>=48 && r->index<6 && r->flag<=65535;
    return r->member>=5369 && r->member<=5372 && r->table<100 && r->flag<=2;
#else
    return (r->member==15 && r->table<23 && r->index<65535 && !r->flag) ||
        (r->member==5370 && r->table==8 && r->index>=86 && r->index<=90 && r->flag==(r->index==90?0u:2u));
#endif
}
int pilot_parse(PilotText *out, const unsigned char *p, size_t size) {
    out->count=0;
    if (!p || size<32 || size>PILOT_PACKET_BYTES) return 0;
#ifdef BATCH
    if (memcmp(p,"PZT2",4) || pilot_word(p+4)!=2) return 0;
#else
    if (memcmp(p,"PZT1",4) || pilot_word(p+4)!=1) return 0;
#endif
    uint32_t count=pilot_word(p+12), cursor=32+40*count;
    if (pilot_word(p+8)!=size || !count || count>PILOT_MAX_ROWS ||
        pilot_word(p+16)!=32 || pilot_word(p+20)!=cursor || cursor>=size || pilot_word(p+28) ||
        probe_crc32(p+32,size-32)!=pilot_word(p+24)) return 0;
    for (uint32_t i=0; i<count; ++i) {
        const unsigned char *entry=p+32+40*i;
        PilotRow *r=&out->rows[i];
        r->member=pilot_word(entry); r->table=pilot_word(entry+4); r->index=pilot_word(entry+8);
        r->offset=pilot_word(entry+12); r->original_size=pilot_word(entry+20); r->translated_size=pilot_word(entry+28);
        r->flag=pilot_word(entry+32); r->resource_size=pilot_word(entry+36);
        if (pilot_word(entry+16)!=cursor || !r->original_size || r->original_size>=size-cursor) return 0;
        r->original=(const char *)p+cursor;
        cursor+=r->original_size+1;
        if (pilot_word(entry+24)!=cursor || !r->translated_size || r->translated_size>4096 || r->translated_size>=size-cursor) return 0;
        r->translated=(const char *)p+cursor;
        cursor+=r->translated_size+1;
        if (r->original[r->original_size] || r->translated[r->translated_size] ||
            !pilot_utf8((const unsigned char *)r->original,r->original_size) ||
            !pilot_utf8((const unsigned char *)r->translated,r->translated_size)) return 0;
        if (r->offset>=r->resource_size || r->original_size>=r->resource_size-r->offset) return 0;
        if (!identity(r)) return 0;
        if (i && !row_order(&out->rows[i-1],r)) return 0;
    }
    if (cursor!=size) return 0;
    out->count=count;
    return 1;
}
const PilotRow *pilot_find(const PilotText *text, uint32_t member, uint32_t table, uint32_t index) {
    PilotRow key={.member=member,.table=table,.index=index};
    uint32_t lo=0,hi=text->count;
    while (lo<hi) {
        uint32_t mid=lo+(hi-lo)/2;
        if (row_order(&text->rows[mid],&key)) lo=mid+1; else hi=mid;
    }
    if (lo<text->count && !row_order(&key,&text->rows[lo])) return &text->rows[lo];
    return NULL;
}
int pilot_source(const PilotRow *r, const unsigned char *base, size_t size, const char *result) {
    if (!base || size!=r->resource_size || r->offset>=size || r->original_size>=size-r->offset ||
        (uintptr_t)result!=(uintptr_t)base+r->offset) return 0;
    uint32_t table, relative;
    if (r->member==15 || (r->member>=4756 && r->member<=4758)) {
        uint32_t count=r->member==15?23u:r->member==4756?2u:r->member==4757?4u:1u;
        if (size<8+count*4 || pilot_word(base)!=count || pilot_word(base+4)!=8 || r->table>=count) return 0;
        table=pilot_word(base+8+4*r->table);
        if (table>=size || r->index>=(size-table)/4) return 0;
        relative=pilot_word(base+table+4*r->index);
    } else if (r->member>=5369 && r->member<=5372) {
        table=UINT32_MAX;
        for (uint32_t at=0;at+8<=size && at<2048;at+=8) {
            uint32_t id=pilot_word(base+at),offset=pilot_word(base+at+4);
            if (id==UINT32_MAX && offset==UINT32_MAX) break;
            if (id==r->table) { table=offset; break; }
        }
        if (table>=size || r->index>=(size-table)/8) return 0;
        if (pilot_word(base+table+8*r->index)!=r->flag) return 0;
        relative=pilot_word(base+table+8*r->index+4);
    }
#ifdef BATCH
    else if (r->member>=4759 && r->member<=5322) {
        /* The payload/list base is derived from the source pointer by the
           consumer. Never substitute using the canonical alias's offset. */
        if (r->table%4 || r->table>size || size-r->table<48 || r->index>=6) return 0;
        uint32_t quest_id=(uint32_t)base[r->table+24] | (uint32_t)base[r->table+25]<<8;
        if (quest_id!=r->flag) return 0;
        uint32_t meta=pilot_word(base+r->table+20);
        if (meta%4 || meta<24 || meta>size-4) return 0;
        uint32_t slots=pilot_word(base+meta);
        if (slots%4 || !slots || slots>meta-24) return 0;
        if (pilot_word(base+slots+4*r->index)!=r->offset) return 0;
        return !memcmp(result,r->original,r->original_size+1);
    }
#endif
    else return 0;
    if (relative>=size-table || table+relative!=r->offset) return 0;
    return !memcmp(result,r->original,r->original_size+1);
}
void *pilot_alloc(PilotPool *p, uint32_t size) {
    if (size>PILOT_POOL_BYTES) { ++p->failures; return NULL; }
    size=((size?size:1)+15)&~15u;
    unsigned int slot=0;
    while (slot<PILOT_POOL_SLOTS && p->slots[slot].size) ++slot;
    if (slot==PILOT_POOL_SLOTS) { ++p->failures; return NULL; }
    uint32_t at=0;
    for (;;) {
        if (size>PILOT_POOL_BYTES-at) { ++p->failures; return NULL; }
        uint32_t next=at;
        for (unsigned int i=0;i<PILOT_POOL_SLOTS;++i) {
            PilotAllocation a=p->slots[i];
            if (a.size && at<a.offset+a.size && a.offset<at+size && next<a.offset+a.size) next=a.offset+a.size;
        }
        if (at==next) break;
        at=next;
    }
    p->slots[slot]=(PilotAllocation){at,size};
    p->used+=size; if (p->used>p->peak) p->peak=p->used;
    return p->bytes+at;
}
int pilot_free(PilotPool *p, void *pointer) {
    if (!pointer) return 1;
    for (unsigned int i=0;i<PILOT_POOL_SLOTS;++i) {
        PilotAllocation *a=&p->slots[i];
        if (a->size && p->bytes+a->offset==pointer) { p->used-=a->size; a->size=0; return 1; }
    }
    ++p->failures; return 0;
}
