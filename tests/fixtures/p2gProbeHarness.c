#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <setjmp.h>
#include "probe_core.h"
#include "probe_log.h"

unsigned char mock_table[512], fixture_config[600];
uint32_t mock_site[8], test_config_crc;
static const uint32_t verified[] = {1,2,3,4,5,6,7,8};
static size_t fixture_size, read_offset, output_size;
static char output[300000];
static int disk_failed, stop_after_install, change_target;
static jmp_buf stopped;

#include "equipment_hook.c"

int sceIoOpen(const char *p, int flags, int mode) { (void)p; (void)flags; (void)mode; read_offset=0; return 1; }
int sceIoRead(int fd, void *p, unsigned int size) {
    (void)fd; size_t n=fixture_size-read_offset; if(n>size)n=size;
    memcpy(p,fixture_config+read_offset,n);read_offset+=n;return (int)n;
}
int sceIoClose(int fd) { (void)fd; return 0; }
int sceKernelDelayThread(unsigned int n) {
    (void)n;
    if(stop_after_install && strstr(output,"event=installed"))longjmp(stopped,1);
    return 0;
}
unsigned int sceKernelCpuSuspendIntr(void) { return 0; }
void sceKernelCpuResumeIntr(unsigned int s) { (void)s; }
void sceKernelDcacheWritebackRange(const void *p,unsigned int n) { (void)p;(void)n; }
void sceKernelIcacheInvalidateRange(const void *p,unsigned int n) { (void)p;(void)n; }

static int capture(void *ctx,const char *s,size_t n) {
    (void)ctx;if(disk_failed)return 0;
    assert(output_size+n<sizeof(output));memcpy(output+output_size,s,n);output_size+=n;output[output_size]=0;
    if(change_target && strstr(s,"event=source_ok"))mock_site[0]=99;
    return 1;
}
static ProbeLog logger(void) {
    ProbeLog l={.write=capture,.build="synthetic-A",.run="test",.mode=0,.table=3,.index=28};return l;
}
static void put(unsigned char *p,uint32_t n) { for(unsigned i=0;i<4;i++)p[i]=(unsigned char)(n>>(8*i)); }
static void reset(void) {
    output_size=0;output[0]=0;disk_failed=0;stop_after_install=0;change_target=0;enabled=0;
    memset(mock_table,0,sizeof(mock_table));memcpy(mock_site,verified,sizeof(mock_site));
    put(mock_table,23);put(mock_table+20,128);put(mock_table+128+28*4,256);
    memcpy(mock_table+384,"ORIGINAL",9);memset((void *)&counts,0,sizeof(counts));
}
static size_t read_file(const char *p,unsigned char *bytes) {
    FILE *f=fopen(p,"rb");assert(f);size_t n=fread(bytes,1,600,f);assert(!ferror(f));fclose(f);return n;
}
int main(int argc,char **argv) {
    assert(argc==3);fixture_size=read_file(argv[1],fixture_config);test_config_crc=probe_crc32(fixture_config,fixture_size);
    assert(probe_crc32((const unsigned char *)"123456789",9)==0xcbf43926u);
    ProbeConfig a,b;unsigned char second[600],bad[600];size_t second_size=read_file(argv[2],second);
    assert(probe_parse(&a,fixture_config,fixture_size,3,28,0));assert(probe_parse(&b,second,second_size,3,28,1));
    assert(!probe_parse(&a,fixture_config,fixture_size,3,29,0));
    assert(!probe_parse(&a,fixture_config,fixture_size,3,28,1));
    assert(!probe_parse(&a,fixture_config,fixture_size-1,3,28,0));
    for(size_t i=0;i<fixture_size;i++) {
        memcpy(bad,fixture_config,fixture_size);bad[i]^=128;
        assert(!probe_parse(&a,bad,fixture_size,3,28,0));
    }
    memcpy(bad,fixture_config,fixture_size);put(bad+16,256);assert(!probe_parse(&a,bad,fixture_size,3,28,0));
    memcpy(bad,fixture_config,fixture_size);bad[28+8]=1;put(bad+24,probe_crc32(bad+28,fixture_size-28));
    assert(!probe_parse(&a,bad,fixture_size,3,28,0));
    memcpy(bad,fixture_config,fixture_size);bad[28]=0;put(bad+24,probe_crc32(bad+28,fixture_size-28));
    assert(!probe_parse(&a,bad,fixture_size,3,28,0));
    reset();assert(probe_source_ready(mock_table,sizeof(mock_table),23,&a)==1);
    const char *original=(const char *)mock_table+384;ProbeCounters counter={0};
    assert(probe_query(&a,3,28,original,mock_table,sizeof(mock_table),&counter,1)==original);
    assert(counter.selected==1 && !counter.replaced && !counter.mismatch);
    assert(probe_query(&b,3,28,original,mock_table,sizeof(mock_table),&counter,1)==b.replacement);
    assert(counter.replaced==1);
    assert(probe_query(&b,3,29,original,mock_table,sizeof(mock_table),&counter,1)==original);
    assert(probe_query(&b,3,28,original,mock_table,sizeof(mock_table),&counter,0)==original);
    const char *invalid=(const char *)(uintptr_t)1;
    assert(probe_query(&b,3,28,invalid,mock_table,sizeof(mock_table),&counter,1)==invalid);
    const char *end=(const char *)mock_table+sizeof(mock_table)-2;
    assert(probe_query(&b,3,28,end,mock_table,sizeof(mock_table),&counter,1)==end);
    mock_table[384]='X';assert(probe_query(&b,3,28,original,mock_table,sizeof(mock_table),&counter,1)==original);
    assert(counter.invalid==2 && counter.mismatch==3 && counter.replaced==1);
    assert(probe_source_ready(mock_table,sizeof(mock_table),23,&a)==-1);
    reset();put(mock_table+20,0xfffffff0);assert(probe_source_ready(mock_table,sizeof(mock_table),23,&a)==-1);
    reset();put(mock_table+128+28*4,0xffffffff);assert(probe_source_ready(mock_table,sizeof(mock_table),23,&a)==-1);
    reset();mock_site[0]=99;ProbeLog l=logger();equipment_probe(&l);
    assert(mock_site[0]==99 && strstr(output,"event=version_mismatch") && !enabled);
    reset();fixture_config[28]^=1;l=logger();equipment_probe(&l);fixture_config[28]^=1;
    assert(!memcmp(mock_site,verified,sizeof(mock_site)) && strstr(output,"event=config_error") && !enabled);
    reset();mock_table[384]='X';l=logger();equipment_probe(&l);
    assert(!memcmp(mock_site,verified,sizeof(mock_site)) && strstr(output,"event=source_mismatch") && !enabled);
    reset();mock_table[0]=0;l=logger();equipment_probe(&l);
    assert(!memcmp(mock_site,verified,sizeof(mock_site)) && strstr(output,"event=source_timeout") && !enabled);
    reset();disk_failed=1;l=logger();equipment_probe(&l);
    assert(l.failed && !enabled && !memcmp(mock_site,verified,sizeof(mock_site)));
    reset();change_target=1;l=logger();equipment_probe(&l);
    assert(mock_site[0]==99 && strstr(output,"event=target_changed") && !enabled);
    reset();stop_after_install=1;l=logger();
    if(!setjmp(stopped))equipment_probe(&l);
    assert(enabled && strstr(output,"event=installed"));
    assert(mock_site[0]==(0x08000000u|(((uintptr_t)query & 0x0fffffffu)>>2)) && mock_site[1]==0);
    assert(!memcmp(mock_site+2,verified+2,sizeof(mock_site)-8));
    reset();l=logger();for(int i=0;i<10000 && !l.capped;i++)probe_event(&l,"summary","calls=1");
    assert(l.capped && l.bytes<=PROBE_LOG_LIMIT && strstr(output,"event=log_limit"));
    size_t before=output_size;assert(!probe_event(&l,"summary","calls=2") && before==output_size);
    puts("C probe: configuration, bounds, forwarding/replacement, no-write rejection, patch extent, logging PASS");
    return 0;
}
