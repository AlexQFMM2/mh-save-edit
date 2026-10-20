import { describe,it,expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { hash,validateRows,validateText,encodeTextPackage,decodeTextPackage,fontCharacters } from '../tools/mhp2g/chinese-patch/text-package.mjs'
import { crc32 } from '../tools/mhp2g/chinese-patch/equipment-evidence.mjs'
import { analyzeProbeLog } from '../tools/mhp2g/chinese-patch/analyze-probe-log.mjs'

const row=(fields={})=>({member:15,table:1,index:1,offset:900,resourceBytes:1024,flag:0,original:'SYNTHETIC',translated:'A'.repeat(300),sourceSha256:hash('SYNTHETIC'),basis:'Synthetic test only',...fields})
describe('P2G pilot text package',()=>{
  it('keeps namespaces separate and permits resident strings beyond the old probe limit',()=>{
    const rows=[row(),row({member:5370,table:8,index:86,flag:2})]
    const bytes=encodeTextPackage(rows),decoded=decodeTextPackage(bytes)
    expect(decoded.map(x=>x.translated)).toEqual(['A'.repeat(300),'A'.repeat(300)])
    expect(fontCharacters(rows)).toEqual([65])
    expect(()=>validateRows([row(),row()])).toThrow(/Duplicate/)
    expect(()=>validateRows([row({sourceSha256:hash('changed')})])).toThrow(/hash/)
    expect(()=>validateRows([row({offset:1023})])).toThrow(/resource/)
  })
  it('rejects escaped newlines, changed controls, missing pages and broken encodings',()=>{
    for(const [a,b] of [['A\nB','C\\nD'],['~C03X~C00','~C00X~C03'],['%s','%d'],['A\nB','AB'],['A','\ud800'],['A','\0'],['A','~Q']])expect(()=>validateText(a,b)).toThrow()
    expect(()=>validateText('~C03A~C00\n%s','~C03B~C00\n%s')).not.toThrow()
    expect(()=>validateRows([row({member:5370,table:8,index:90,flag:2})])).toThrow(/identity/)
    const packet=encodeTextPackage([row()])
    for(const offset of [0,4,8,12,16,20,24,28,32,packet.length-1]) {
      const corrupt=Buffer.from(packet);corrupt[offset]^=0xff
      expect(()=>decodeTextPackage(corrupt)).toThrow()
    }
    expect(()=>decodeTextPackage(packet.subarray(0,packet.length-1))).toThrow()
  })
  it('runs production native parsers and allocation lifetime checks under ASan/UBSan',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-pilot-test-'))
    try {
      const packet=path.join(dir,'texts.bin'),exe=path.join(dir,'test'),source=path.resolve('tools/mhp2g/chinese-patch/prx')
      fs.writeFileSync(packet,encodeTextPackage([row(),row({member:5370,table:8,index:86,flag:2})]))
      const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${source}`,
        'tests/fixtures/p2gPilotHarness.c',path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),'-o',exe],{encoding:'utf8'})
      expect(built.status,built.stderr).toBe(0)
      const result=spawnSync(exe,[packet],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
      expect(result.status,result.stdout+result.stderr).toBe(0)
      expect(result.stdout).toContain('PASS')
    } finally {fs.rmSync(dir,{recursive:true,force:true})}
  })
  it('checks production font dispatch and failure gates with SDK stubs',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-font-test-'))
    try {
      const source=path.resolve('tools/mhp2g/chinese-patch/prx'),bitmap=Buffer.alloc(1024)
      for(const i of [0,1,32,33])bitmap[i]=255
      fs.copyFileSync('tests/fixtures/p2gFontStub.h',path.join(dir,'pspfont.h'))
      for(const mode of [0,1]) {
        fs.writeFileSync(path.join(dir,'pilot_profile.h'),`#define PILOT_MODE ${mode}\n#define PILOT_PGF_BYTES 8\n#define PILOT_PGF_CRC 0\n#define PILOT_GLYPHS {{65,2,2,0,2,128,${crc32(bitmap)}u}}\n`)
        const exe=path.join(dir,`font-${mode}`)
        const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${dir}`,`-I${source}`,
          'tests/fixtures/p2gFontHarness.c',path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),'-o',exe],{encoding:'utf8'})
        expect(built.status,built.stderr).toBe(0)
        for(const fault of [0,1,2,3,4,5,6,7,8,9]) {
          const test=spawnSync(exe,[String(fault)],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
          expect(test.status,`mode=${mode} fault=${fault}\n${test.stdout}${test.stderr}`).toBe(0)
        }
      }
    } finally {fs.rmSync(dir,{recursive:true,force:true})}
  })
  it('keeps display acceptance pending even with complete pilot logs',()=>{
    const manifest={probe:{format:1,pilot:true,buildId:'test',mode:1,table:0,index:0},keys:['15:1:1']}
    const events=['start','config_ok','installed','font_metrics width=20 height=20 ascender=1024 ready=1 active=1 pool_peak=8192',
      'text_summary key=15:1:1 selected=3 replaced=3','font_summary info=1 image=1 pool_used=4096 pool_peak=8192 pool_failures=0']
    const log=events.map((event,i)=>`P2GPROBE/1 seq=${i+1} build=test run=x mode=1 target=0:0 event=${event}\n`).join('')
    expect(analyzeProbeLog(log,manifest)).toMatchObject({status:'passed',displayAccepted:false,runtimeAccepted:false})
    const earlyEvents=[events[0],events[2],'font_summary info=0 image=0 pool_used=0 pool_peak=0 pool_failures=0',events[1],...events.slice(3)]
    const earlyLog=earlyEvents.map((event,i)=>`P2GPROBE/1 seq=${i+1} build=test run=x mode=1 target=0:0 event=${event}\n`).join('')
    expect(analyzeProbeLog(earlyLog,manifest)).toMatchObject({status:'passed',displayAccepted:false,runtimeAccepted:false})
    for(const invalid of [log.replace('ready=1','ready=0'),log.replace('image=1','image=0')])expect(analyzeProbeLog(invalid,manifest).status).toBe('incomplete')
    for(const invalid of [log.replace('pool_failures=0','pool_failures=1'),log.replace('key=15:1:1','key=15:1:2'),log.replace('replaced=3','replaced=4')])expect(analyzeProbeLog(invalid,manifest).status).toBe('failed')
  })
  it('guards the actual hook transaction and rejects stale source text',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-hook-test-'))
    try {
      const source=path.resolve('tools/mhp2g/chinese-patch/prx'),exe=path.join(dir,'hooks')
      fs.copyFileSync('tests/fixtures/p2gFontStub.h',path.join(dir,'pspfont.h'))
      fs.writeFileSync(path.join(dir,'pspkernel.h'),'int sceKernelDelayThread(unsigned int);\nvoid sceKernelDcacheWritebackRange(const void *,unsigned int);\nvoid sceKernelIcacheInvalidateRange(const void *,unsigned int);\n')
      fs.writeFileSync(path.join(dir,'pspintrman.h'),'unsigned int sceKernelCpuSuspendIntr(void);\nvoid sceKernelCpuResumeIntr(unsigned int);\n')
      const sites=['QUERY','TALK','INFO','CHAR','IMAGE','IMAGE2'].map((key,i)=>`#define PILOT_${key}_ADDRESS (0x08801000u+${i*16}u)\n#define PILOT_${key}_WORDS {${i+1},${i+2}}\n`).join('')
      const packet=encodeTextPackage([row({translated:'A'})]),packetPath=path.join(dir,'texts.bin'),bitmap=Buffer.alloc(1024)
      fs.writeFileSync(packetPath,packet)
      for(const i of [0,1,32,33])bitmap[i]=255
      fs.writeFileSync(path.join(dir,'pilot_profile.h'),sites+`#define PILOT_MODE 1\n#define PILOT_TEXT_BYTES ${packet.length}\n#define PILOT_TEXT_CRC 0\n#define PILOT_PGF_BYTES 8\n#define PILOT_PGF_CRC 0\n#define PILOT_GLYPHS {{65,2,2,0,2,128,${crc32(bitmap)}u}}\n#define PILOT_CORE_BASE 0x08810000u\n#define PILOT_RESOURCE_MANAGER 0x08802000u\n#define PILOT_RESOURCE_MANAGER_BYTES 1024u\n#define PILOT_FIND_RESOURCE 0x08802100u\n#define PILOT_FIND_WORDS {1,2,3,4}\n#define PILOT_DIALOGUE_BYTES 1024u\n#define PILOT_DIALOGUE_HEADER {1,2,3,4}\n`)
      const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-Wno-int-to-pointer-cast','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${dir}`,`-I${source}`,
        'tests/fixtures/p2gPilotHookHarness.c',path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),path.join(source,'probe_log.c'),'-o',exe],{encoding:'utf8'})
      expect(built.status,built.stderr).toBe(0)
      const test=spawnSync(exe,[],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
      expect(test.status,test.stdout+test.stderr).toBe(0)
      const startup=path.join(dir,'startup')
      const startupBuilt=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-Wno-int-to-pointer-cast','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${dir}`,`-I${source}`,
        'tests/fixtures/p2gStartupHarness.c',path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),path.join(source,'probe_log.c'),'-o',startup],{encoding:'utf8'})
      expect(startupBuilt.status,startupBuilt.stderr).toBe(0)
      for(const fault of [0,1,2,3,4,5]) {
        const result=spawnSync(startup,[String(fault),packetPath],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
        expect(result.status,`startup fault=${fault}\n${result.stdout}${result.stderr}`).toBe(0)
      }
    } finally {fs.rmSync(dir,{recursive:true,force:true})}
  })
})
