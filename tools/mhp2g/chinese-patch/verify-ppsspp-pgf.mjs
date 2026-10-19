#!/usr/bin/env node
// The caller supplies official, hash-pinned GPL reference files privately.
// No emulator is launched; only its PGF parser/rasterizer runs in a test process.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { hash } from './text-package.mjs'
const [reference,fontDirectory]=process.argv.slice(2)
assert(fontDirectory,'Usage: verify-ppsspp-pgf.mjs <reference-dir> <font-build-dir>')
const cpp=fs.readFileSync(path.join(reference,'ppsspp-PGF.cpp'),'utf8'), header=fs.readFileSync(path.join(reference,'ppsspp-PGF.h'),'utf8')
assert.equal(hash(cpp),'68d34afc0f651004baa5a5a99e28d5e5c6dc72eee1552246edeed6727416315d')
assert.equal(hash(header),'af69a54767209b1daa179fecf2c283b10619af9efa1d3dced54d8ca8bc4e91d9')
const font=JSON.parse(fs.readFileSync(path.join(fontDirectory,'font.json')))
const pgf=fs.readFileSync(path.join(fontDirectory,'zh-cn.pgf'))
assert.equal(hash(pgf),font.pgfSha256)
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-pgf-reference-'))
try {
  const code = `#include <cstdint>
#include <cstring>
#include <cassert>
#include <cstdio>
#include <fstream>
#include <iterator>
#include <algorithm>
using u8=uint8_t; using u16=uint16_t; using u32=uint32_t; using s16=int16_t; using s32=int32_t;
using u16_le=u16; using u32_le=u32; using s16_le=s16; using s32_le=s32; using float_le=float;
#define COMMON_LITTLE_ENDIAN 1
#define _dbg_assert_msg_(condition,...) assert(condition)
#define DEBUG_LOG(...) ((void)0)
#define ERROR_LOG_REPORT(...) assert(false)
#define ERROR_LOG_REPORT_ONCE(...) assert(false)
namespace Memory {
static u8 memory[4096];
static u8 Read_U8(u32 a) { assert(a<sizeof(memory)); return memory[a]; }
static void Write_U8(u8 v,u32 a) { assert(a<sizeof(memory)); memory[a]=v; }
static void Write_U32(u32 v,u32 a) { for(unsigned i=0;i<4;i++) Write_U8(v>>(8*i),a+i); }
}
struct Gpu { void InvalidateCache(u32,u32,int) {} } gpuObject;
static Gpu *gpu=&gpuObject;
#define GPU_INVALIDATE_SAFE 0
` + header.replace(/^#include "[^\n]+\n/gm,'').replace('#pragma once','') + '\n' +
    (cpp.slice(0,cpp.indexOf('struct GlyphFromPGF1State'))+cpp.slice(cpp.indexOf('bool PGF::ReadPtr'))).replace(/^#include [^\n]+\n/gm,'') + `
static uint32_t crc(const u8 *p,size_t n) {
  uint32_t c=~0u; while(n--) { c^=*p++; for(int i=0;i<8;++i) c=(c>>1)^(0xedb88320u&(0u-(c&1))); } return ~c;
}
struct Expected {int code,w,h,left,top,advance; uint32_t crc;};
static Expected expected[]={${font.codepoints.map(code=>{const g=font.metrics[code];return `{${code},${g.width},${g.height},${g.left},${g.top},${g.advance},${g.bitmapCrc32}u}`}).join(',')}};
int main(int argc,char **argv) {
  assert(argc==2); std::ifstream file(argv[1],std::ios::binary);
  std::vector<u8> data((std::istreambuf_iterator<char>(file)),{});
  PGF font; assert(font.ReadPtr(data.data(),data.size()));
  for(const auto &g:expected) {
    PGFCharInfo c; assert(font.GetCharInfo(g.code,&c,0));
    assert(c.bitmapWidth==(u32)g.w && c.bitmapHeight==(u32)g.h && (s32)c.bitmapLeft==g.left && (s32)c.bitmapTop==g.top && c.sfp26AdvanceH==g.advance);
    memset(Memory::memory,0,sizeof(Memory::memory));
    GlyphImage image={PSP_FONT_PIXELFORMAT_8,0,0,32,32,32,0,0};
    font.DrawCharacter(&image,0,0,32,32,g.code,0,FONT_PGF_CHARGLYPH);
    if(crc(Memory::memory,1024)!=g.crc) { fprintf(stderr,"Bitmap mismatch: U+%04X\\n",g.code); return 1; }
    image.pixelFormat=PSP_FONT_PIXELFORMAT_4; image.bytesPerLine=16; image.bufferPtr=2048;
    font.DrawCharacter(&image,0,0,32,32,g.code,0,FONT_PGF_CHARGLYPH);
    for(unsigned i=0;i<1024;++i) assert(((Memory::memory[2048+i/2]>>((i%2)*4))&15)==Memory::memory[i]/17);
  }
  for(int c=32;c<0xfff0;c++) {
    if(std::any_of(std::begin(expected),std::end(expected),[&](const Expected &e){return e.code==c;})) continue;
    PGFCharInfo info; assert(!font.GetCharInfo(c,&info,0));
  }
  printf("PASS official PPSSPP v1.15.4: %zu mapped glyphs, metrics, 8-bit/4-bit pixels and absent characters\\n",sizeof(expected)/sizeof(expected[0]));
}
`
  fs.writeFileSync(path.join(dir,'verify.cpp'),code)
  const result=spawnSync('c++',['-std=c++17','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',path.join(dir,'verify.cpp'),'-o',path.join(dir,'verify')],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  const test=spawnSync(path.join(dir,'verify'),[path.resolve(fontDirectory,'zh-cn.pgf')],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
  assert.equal(test.status,0,test.stdout+test.stderr)
  console.log(test.stdout.trim())
} finally {fs.rmSync(dir,{recursive:true,force:true})}
