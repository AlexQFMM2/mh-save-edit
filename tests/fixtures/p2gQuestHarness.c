#define _GNU_SOURCE
#include <assert.h>
#include <sys/mman.h>
#include <string.h>
#include <stdio.h>
#include "pilot_quest.h"
static PilotText text;
static void word(unsigned char *p,uint32_t n) { memcpy(p,&n,4); }
int main(void) {
    unsigned char *base=mmap((void *)0x08800000,0x10000,PROT_READ|PROT_WRITE,
        MAP_PRIVATE|MAP_ANONYMOUS|MAP_FIXED_NOREPLACE,-1,0);
    assert(base==(void *)0x08800000);
    word(base,48);word(base+48+20,256);base[48+24]=123;
    word(base+256,128);word(base+128+4*3,400);word(base+128+4*4,400);
    memcpy(base+400,"SHARED ORIGINAL",16);
    text.count=3;
    text.rows[0]=(PilotRow){.member=4759,.table=48,.index=3,.offset=400,.flag=123,.resource_size=1024,
        .original="SHARED ORIGINAL",.translated="LONG TRANSLATION 1234567890",.original_size=15};
    text.rows[1]=text.rows[0];text.rows[1].index=4;
    text.rows[2]=text.rows[0];text.rows[2].member=5310;text.rows[2].offset=600;
    const uint16_t order[]={0,1,2};
    assert(pilot_quest_source(&text,order,3,base,(char *)base+400,3)==text.rows);
    assert(pilot_quest_source(&text,order,3,NULL,(char *)base+400,4)==text.rows+1);
    assert(!pilot_quest_source(&text,order,3,base,(char *)base+400,2));
    assert(!pilot_quest_source(&text,order,3,base,(char *)base+400,6));
    base[72]=124;assert(!pilot_quest_source(&text,order,3,base,(char *)base+400,3));base[72]=123;
    word(base+128+12,404);assert(!pilot_quest_source(&text,order,3,NULL,(char *)base+400,3));word(base+128+12,400);
    base[415]='X';assert(!pilot_quest_source(&text,order,3,base,(char *)base+400,3));base[415]=0;
    assert(!pilot_quest_source(&text,order,3,NULL,(char *)0x087fffff,3));
    PilotQuestCopy copies[16]={0};char *buffer=(char *)base+2000;
    memset(buffer,0x5a,80);strcpy(buffer,(char *)base+400);
    pilot_quest_capture(copies,text.rows,buffer);
    const PilotRow *row=pilot_quest_copy(copies,buffer,3);
    assert(row==text.rows && strlen(row->translated)>row->original_size && buffer[16]==0x5a);
    assert(!pilot_quest_copy(copies,buffer,4));
    buffer[0]='X';assert(!pilot_quest_copy(copies,buffer,3));buffer[0]='S';
    pilot_quest_capture(copies,NULL,buffer);assert(!pilot_quest_copy(copies,buffer,3));
    for(unsigned int i=0;i<24;++i)pilot_quest_capture(copies,text.rows,buffer+80*i);
    strcpy(buffer+80*23,(char *)base+400);assert(pilot_quest_copy(copies,buffer+80*23,3)==text.rows);
    assert(!munmap(base,0x10000));
    puts("PASS quest physical identity, shared-field lookup, unchanged copy buffers and stale-source fallback");
}
