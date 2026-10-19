import { afterEach,describe,it,expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {encodeConfig,crc32,verifyEquipmentEvidence,sha256} from '../tools/mhp2g/chinese-patch/equipment-evidence.mjs'
import {analyzeProbeLog} from '../tools/mhp2g/chinese-patch/analyze-probe-log.mjs'

const temporary=[]
afterEach(()=>{for(const dir of temporary.splice(0))fs.rmSync(dir,{recursive:true,force:true})})
const temp=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-probe-test-'));temporary.push(dir);return dir}
const manifest={probe:{format:1,buildId:'synthetic',mode:0,table:9,index:2}}
function log(events,mode=0) {
  return events.map((event,i)=>`P2GPROBE/1 seq=${i+1} build=synthetic run=sample mode=${mode} target=9:2 event=${event}\n`).join('')
}
const prefix=['start format=1','config_ok','source_waiting timeout_seconds=60','source_ok','installed','waiting_target']
describe('equipment probe configuration and native code',()=>{
  it('uses the standard CRC and rejects malformed inputs before generation',()=>{
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    const profile={table:3,index:28,original:'ORIGINAL',replacement:'SYNTHETIC-TEST-MARKER'}
    expect(()=>encodeConfig({...profile,original:'x'.repeat(256)},0)).toThrow()
    expect(()=>encodeConfig({...profile,replacement:'bad\nmarker'},0)).toThrow()
    expect(()=>encodeConfig({...profile,original:'bad\0value'},0)).toThrow()
    expect(()=>encodeConfig({...profile,index:65536},0)).toThrow()
    expect(()=>encodeConfig(profile,2)).toThrow()
  })
  it('runs the production C core and hook guards against synthetic memory and PSP stubs',()=>{
    const dir=temp(),source=path.resolve('tools/mhp2g/chinese-patch/prx')
    const profile={table:3,index:28,original:'ORIGINAL',replacement:'SYNTHETIC-TEST-MARKER'}
    for(const mode of [0,1])fs.writeFileSync(path.join(dir,`${mode}.bin`),encodeConfig(profile,mode))
    fs.writeFileSync(path.join(dir,'pspkernel.h'),`typedef int SceUID;\nint sceKernelDelayThread(unsigned int);\nvoid sceKernelDcacheWritebackRange(const void *,unsigned int);\nvoid sceKernelIcacheInvalidateRange(const void *,unsigned int);\n`)
    fs.writeFileSync(path.join(dir,'pspintrman.h'),'unsigned int sceKernelCpuSuspendIntr(void);\nvoid sceKernelCpuResumeIntr(unsigned int);\n')
    fs.writeFileSync(path.join(dir,'pspiofilemgr.h'),'#define PSP_O_RDONLY 1\nint sceIoOpen(const char *,int,int);\nint sceIoRead(int,void *,unsigned int);\nint sceIoClose(int);\n')
    fs.writeFileSync(path.join(dir,'probe_profile.h'),`#define PROBE_PROLOGUE {1,2,3,4,5,6,7,8}\n#define PROBE_MODE 0\n#define PROBE_TABLE 3\n#define PROBE_INDEX 28\n#define PROBE_TABLE_COUNT 23\n#define PROBE_TABLE_BYTES 512\n#define PROBE_TABLE_BASE ((uintptr_t)mock_table)\n#define PROBE_QUERY_ADDRESS ((uintptr_t)mock_site)\n#define PROBE_CONFIG_CRC test_config_crc\n`)
    const exe=path.join(dir,'probe-tests'),built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${dir}`,`-I${source}`,'tests/fixtures/p2gProbeHarness.c',path.join(source,'probe_core.c'),path.join(source,'probe_log.c'),'-o',exe],{encoding:'utf8'})
    expect(built.status,built.stderr).toBe(0)
    const result=spawnSync(exe,[path.join(dir,'0.bin'),path.join(dir,'1.bin')],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0'}})
    expect(result.status,result.stdout+result.stderr).toBe(0)
    expect(result.stdout).toContain('PASS')
  })
  it('rejects a changed frozen native snapshot before reading target evidence',()=>{
    const dir=temp(),bytes=Buffer.from('{"synthetic":true}')
    fs.writeFileSync(path.join(dir,'texts.json'),bytes)
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({schema:'mhp2g-japanese-catalog-source-v1',files:{'texts.json':{sha256:sha256(Buffer.from('other')),bytes:bytes.length}}}))
    expect(()=>verifyEquipmentEvidence({nativeDirectory:dir})).toThrow(/Native snapshot hash/)
  })
})
describe('bounded probe log analysis',()=>{
  it('distinguishes missing, loading and not-yet-hit logs',()=>{
    expect(analyzeProbeLog('',manifest).status).toBe('incomplete')
    expect(analyzeProbeLog(log(['start']),manifest).status).toBe('incomplete')
    const result=analyzeProbeLog(log([...prefix,'summary calls=10 selected=0 replaced=0 mismatch=0 invalid=0']),manifest)
    expect(result.status).toBe('incomplete');expect(result.reason).toContain('尚未命中')
  })
  it('accepts A counters without claiming game/display acceptance',()=>{
    const result=analyzeProbeLog(log([...prefix,'first_match','summary calls=10 selected=3 replaced=0 mismatch=0 invalid=0']),manifest)
    expect(result.status).toBe('passed');expect(result.runtimeAccepted).toBe(false);expect(result.displayAccepted).toBe(false)
  })
  it('requires replacement evidence for B',()=>{
    const b={probe:{...manifest.probe,mode:1}}
    expect(analyzeProbeLog(log([...prefix,'first_match','first_replace','summary calls=10 selected=3 replaced=3 mismatch=0 invalid=0'],1),b).status).toBe('passed')
    expect(analyzeProbeLog(log([...prefix,'first_match','summary calls=10 selected=3 replaced=0 mismatch=0 invalid=0'],1),b).status).toBe('incomplete')
  })
  it.each(['config_error','version_mismatch','source_timeout','original_mismatch','invalid_pointer','log_write_failed'])('rejects %s',event=>{
    expect(analyzeProbeLog(log([...prefix,event]),manifest).status).toBe('failed')
  })
  it('rejects mixed builds, duplicate runs, bad counters and unframed logs',()=>{
    const text=log([...prefix,'first_match','summary calls=10 selected=3 replaced=0 mismatch=0 invalid=0'])
    for(const invalid of [text.replace('build=synthetic','build=old'),text+text,text.replace('selected=3','selected=30'),'old: loaded\n',text.replace('seq=2','seq=1')])expect(analyzeProbeLog(invalid,manifest).status).toBe('failed')
    expect(analyzeProbeLog(text+'P2GPROBE/',manifest).status).toBe('incomplete')
    expect(analyzeProbeLog(log([...prefix,'log_limit']),manifest).status).toBe('incomplete')
    expect(analyzeProbeLog(log([...prefix,'first_match','summary calls=10 selected=3 replaced=0 mismatch=0 invalid=0','summary calls=9 selected=2 replaced=0 mismatch=0 invalid=0']),manifest).status).toBe('failed')
  })
})
