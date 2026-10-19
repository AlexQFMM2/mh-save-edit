#include "pilot_core.h"
#include "probe_core.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void word(unsigned char *p,uint32_t n) {for(int i=0;i<4;++i)p[i]=(unsigned char)(n>>(8*i));}
static void checksum(unsigned char *p,size_t n) {word(p+24,probe_crc32(p+32,n-32));}
int main(int argc,char **argv) {
    assert(argc==2); FILE *f=fopen(argv[1],"rb"); assert(f);
    unsigned char bytes[8192],copy[8192]; size_t size=fread(bytes,1,sizeof(bytes),f); assert(!ferror(f)); fclose(f);
    PilotText text={0}; assert(pilot_parse(&text,bytes,size)); assert(text.count==2);
    assert(text.rows[0].translated_size>256);
    for(size_t i=0;i<size;++i) { assert(!pilot_parse(&text,bytes,i)); assert(!text.count); }
    for(size_t i=0;i<size;++i) {memcpy(copy,bytes,size); copy[i]^=0x80; assert(!pilot_parse(&text,copy,size)); assert(!text.count);}
    uint32_t random=17;
    for(unsigned int i=0;i<20000;++i) {
        memcpy(copy,bytes,size); random=random*1664525+1013904223; size_t at=32+random%(size-32);
        random=random*1664525+1013904223; copy[at]=(unsigned char)random; checksum(copy,size);
        int valid=pilot_parse(&text,copy,size); assert(valid || !text.count);
    }
    assert(pilot_parse(&text,bytes,size));
    const PilotRow *r=pilot_find(&text,15,1,1); assert(r); assert(!pilot_find(&text,15,2,1));
    unsigned char resource[1024]={0};
    word(resource,23); word(resource+4,8); word(resource+12,100); word(resource+104,r->offset-100);
    memcpy(resource+r->offset,r->original,r->original_size+1);
    assert(pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset));
    assert(!pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset+1));
    assert(!pilot_source(r,resource,4,(char *)resource+r->offset));
    resource[r->offset]^=1; assert(!pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset));
    word(resource+12,UINT32_MAX); assert(!pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset));
    r=pilot_find(&text,5370,8,86); assert(r);
    memset(resource,0,sizeof(resource)); word(resource+64,8); word(resource+68,136);
    word(resource+136+86*8,2); word(resource+136+86*8+4,r->offset-136);
    memcpy(resource+r->offset,r->original,r->original_size+1);
    assert(pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset));
    word(resource+136+86*8,0); assert(!pilot_source(r,resource,sizeof(resource),(char *)resource+r->offset));
    assert(!pilot_utf8((const unsigned char *)"\xc0\x80",2));
    assert(!pilot_utf8((const unsigned char *)"\xed\xa0\x80",3));
    assert(!pilot_utf8((const unsigned char *)"\xe0\xa0",2));
    assert(pilot_utf8((const unsigned char *)"\xe4\xb8\x80\n",4));
    PilotPool pool={0}; void *allocations[64];
    for(unsigned int i=0;i<64;++i) {allocations[i]=pilot_alloc(&pool,512);assert(allocations[i]);assert(!((uintptr_t)allocations[i]&15));memset(allocations[i],0xa5,512);}
    assert(pool.used==32768 && pool.peak==32768); assert(!pilot_alloc(&pool,1));
    for(unsigned int i=0;i<64;i+=2)assert(pilot_free(&pool,allocations[i]));
    for(unsigned int i=0;i<64;i+=2){allocations[i]=pilot_alloc(&pool,510);assert(allocations[i]);}
    assert(!pilot_free(&pool,(void *)(uintptr_t)1)); assert(!pilot_alloc(&pool,UINT32_MAX));
    for(unsigned int i=0;i<64;++i)assert(pilot_free(&pool,allocations[i]));
    assert(pool.used==0);assert(!pilot_free(&pool,allocations[0]));
    void *all=pilot_alloc(&pool,32768);assert(all);assert(pilot_free(&pool,all));
    puts("PASS pilot packet, source identity, UTF-8, fuzz and bounded pool");
}
