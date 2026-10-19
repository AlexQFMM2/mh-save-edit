#include "pilot_core.h"
#include "probe_core.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static void word(unsigned char *p,uint32_t n) {for(unsigned i=0;i<4;++i)p[i]=(unsigned char)(n>>(8*i));}
int main(int argc,char **argv) {
    assert(argc==2);FILE *file=fopen(argv[1],"rb");assert(file);
    assert(!fseek(file,0,SEEK_END));long length=ftell(file);assert(length>128*1024);
    rewind(file);unsigned char *bytes=malloc((size_t)length);assert(bytes);
    assert(fread(bytes,1,(size_t)length,file)==(size_t)length);fclose(file);
    PilotText *text=calloc(1,sizeof(*text));assert(text);
    assert(pilot_parse(text,bytes,(size_t)length));assert(text->count==18001);
    for(uint32_t i=0;i<18000;++i) {
        const PilotRow *row=pilot_find(text,15,1,i);assert(row && row->index==i);
        assert(!pilot_find(text,15,2,i));
    }
    assert(!pilot_find(text,15,1,18000));
    const PilotRow *row=pilot_find(text,5369,99,0);assert(row);
    unsigned char resource[1024]={0};
    word(resource,99);word(resource+4,16);word(resource+8,~0u);word(resource+12,~0u);
    word(resource+16,2);word(resource+20,row->offset-16);
    memcpy(resource+row->offset,row->original,row->original_size+1);
    assert(pilot_source(row,resource,sizeof(resource),(char *)resource+row->offset));
    word(resource+16,1);assert(!pilot_source(row,resource,sizeof(resource),(char *)resource+row->offset));
    /* Physical quest/list records: six absolute resource-relative pointers,
       with a quest ID independent of the source text's canonical alias. */
    PilotRow quest={.member=5310,.table=64,.index=3,.flag=47,.offset=700,
        .resource_size=1024,.original="SYNTHETIC",.original_size=9};
    memset(resource,0,sizeof(resource));word(resource+84,200);word(resource+200,176);
    word(resource+188,700);resource[88]=47;memcpy(resource+700,"SYNTHETIC",10);
    assert(pilot_source(&quest,resource,sizeof(resource),(char *)resource+700));
    resource[88]=46;assert(!pilot_source(&quest,resource,sizeof(resource),(char *)resource+700));
    resource[88]=47;word(resource+188,699);assert(!pilot_source(&quest,resource,sizeof(resource),(char *)resource+700));
    word(resource+188,700);word(resource+84,~0u);assert(!pilot_source(&quest,resource,sizeof(resource),(char *)resource+700));
    word(bytes+12,~0u);assert(!pilot_parse(text,bytes,(size_t)length) && !text->count);
    word(bytes+12,18001);word(bytes+32,42);word(bytes+24,probe_crc32(bytes+32,(size_t)length-32));
    assert(!pilot_parse(text,bytes,(size_t)length) && !text->count);
    free(text);free(bytes);puts("PASS batch capacity, indexed lookup, sparse table identity and corrupt bounds");
}
