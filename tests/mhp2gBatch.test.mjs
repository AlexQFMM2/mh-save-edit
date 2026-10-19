import {it,expect} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {encodeTextPackage,decodeTextPackage,validateText,hash} from '../tools/mhp2g/chinese-patch/text-package.mjs'
import {reflowReview,collectReviewed} from '../tools/mhp2g/chinese-patch/collect-reviewed.mjs'
const source=path.resolve('tools/mhp2g/chinese-patch/prx')
const row=i=>({member:15,table:1,index:i,offset:900,resourceBytes:1024,flag:0,original:'SYNTHETIC',translated:'T'.repeat(50),sourceSha256:hash('SYNTHETIC'),basis:'Synthetic capacity fixture'})
const env={...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}
it('adapts catalog line breaks without losing prose or moving engine controls',()=>{
  const original='ALPHA\nBETA\n~C05GAMMA %d\nDELTA'
  const review='甲乙丙丁~C05中文 %d末尾'
  const result=reflowReview(original,review)
  expect(result.replaceAll('\n','')).toBe(review)
  expect(result.match(/\n/g)).toHaveLength(3)
  expect(result).toContain('~C05')
  expect(()=>reflowReview(original,'甲乙~C05正文 %s')).toThrow(/controls/)
  expect(reflowReview('A\nB','甲\\n乙')).toBe('甲\n乙')
})
it('keeps native reviews distinct, rejects stale sources and excludes filter tables',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-reviews-'))
  try {
    const write=(name,value)=>{const file=path.join(dir,name);fs.writeFileSync(file,JSON.stringify(value));return file}
    const index=write('index.json',{sourceVersion:'SYNTHETIC',units:{a:{text:'甲',sha256:hash('甲'),source:{member:15}},b:{text:'甲',sha256:hash('甲'),source:{member:15}},c:{text:'FILTER',sha256:hash('FILTER'),source:{member:15}}},bindings:{a:{unit:'a',table:1,index:1},b:{unit:'b',table:1,index:2},c:{unit:'c',table:19,index:0}}})
    const localization=write('localization.json',{units:{'1:1':{japanese:'甲',chinese:'A',status:'reviewed'},'1:2':{japanese:'甲',chinese:'B',status:'reviewed'}}})
    const pilotReview=write('pilot.json',{units:{},dialogue:[]})
    const config=write('config.json',{index,localization,pilotReview})
    const output=path.join(dir,'output.json')
    collectReviewed(config,output)
    const result=JSON.parse(fs.readFileSync(output))
    expect(result.units.a.translated).toBe('A');expect(result.units.b.translated).toBe('B')
    expect(result.excluded.c).toContain('filter')
    const bad=write('bad.json',{entries:[{textKey:'1:1',japanese:'STALE',chinese:'WRONG'}]})
    const staleConfig=write('stale-config.json',{index,localization,pilotReview,nameReviews:[bad]})
    expect(()=>collectReviewed(staleConfig,path.join(dir,'rejected.json'))).toThrow(/Stale/)
    expect(fs.existsSync(path.join(dir,'rejected.json'))).toBe(false)
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
it('separates batch packets from the original pilot and checks dynamic controls',()=>{
  const rows=Array.from({length:4000},(_,i)=>row(i))
  expect(()=>encodeTextPackage(rows)).toThrow(/count/)
  const packet=encodeTextPackage(rows,{batch:true})
  expect(decodeTextPackage(packet)).toHaveLength(4000)
  expect(()=>validateText('~C%02d%s $ ~10','~C%02d%s $ ~10',{batch:true})).not.toThrow()
  expect(()=>validateText('~C%02d%s $ ~10','~C%02d%s ~10',{batch:true})).toThrow(/control/)
  expect(()=>encodeTextPackage([row(0),{...row(1),table:19}],{batch:true})).toThrow(/identity/)
  const legacy=Buffer.from(packet);legacy.write('PZT1');legacy.writeUInt32LE(1,4)
  expect(()=>decodeTextPackage(legacy)).toThrow()
})
it('runs bulk packet corruption, sparse tables and binary lookups in the production C parser',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-batch-'))
  try {
    const rows=Array.from({length:18000},(_,i)=>row(i))
    rows.push({...row(0),member:5369,table:99,flag:2})
    const packet=path.join(dir,'texts.bin'),exe=path.join(dir,'test')
    fs.writeFileSync(packet,encodeTextPackage(rows,{batch:true}))
    const built=spawnSync('cc',['-DBATCH','-std=c11','-Wall','-Wextra','-Werror','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${source}`,
      'tests/fixtures/p2gBatchHarness.c',path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),'-o',exe],{encoding:'utf8'})
    expect(built.status,built.stderr).toBe(0)
    const result=spawnSync(exe,[packet],{encoding:'utf8',env})
    expect(result.status,result.stdout+result.stderr).toBe(0)
    expect(result.stdout).toContain('PASS batch')
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
it('verifies scene overlay fingerprints, reloads and transactional hook guards',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-batch-hooks-'))
  try {
    fs.copyFileSync('tests/fixtures/p2gFontStub.h',path.join(dir,'pspfont.h'))
    fs.writeFileSync(path.join(dir,'pspkernel.h'),'int sceKernelDelayThread(unsigned int);\nvoid sceKernelDcacheWritebackRange(const void *,unsigned int);\nvoid sceKernelIcacheInvalidateRange(const void *,unsigned int);\n')
    fs.writeFileSync(path.join(dir,'pspintrman.h'),'unsigned int sceKernelCpuSuspendIntr(void);\nvoid sceKernelCpuResumeIntr(unsigned int);\n')
    const sites=['QUERY','TALK','INFO','CHAR','IMAGE','IMAGE2'].map((key,i)=>`#define PILOT_${key}_ADDRESS (0x08801000u+${i*16}u)\n#define PILOT_${key}_WORDS {${i+1},${i+2}}\n`).join('')
    const consumers=['TUTORIAL','TRAINING','QUEST_MAIN','QUEST_LIST','QUEST_TRAINING','QUEST_COPY'].map((name,i)=>
      `#define PILOT_${name}_ADDRESS (0x08802300u+${i*256}u)\n#define PILOT_${name}_WORDS {${31+i*2},${32+i*2}}\n#define PILOT_${name}_WINDOW {${31+i*2},${32+i*2},51,52,53,54,55,56,57,58,59,60,61,62,63,64}\n`).join('')
    fs.writeFileSync(path.join(dir,'pilot_profile.h'),sites+consumers+'#define PILOT_MODE 1\n#define PILOT_TEXT_BYTES 32\n#define PILOT_TEXT_CRC 0\n#define PILOT_CORE_BASE 0x08810000u\n#define PILOT_RESOURCE_MANAGER 0x08802000u\n#define PILOT_RESOURCE_MANAGER_BYTES 1024u\n#define PILOT_FIND_RESOURCE 0x08802100u\n#define PILOT_FIND_WORDS {1,2,3,4}\n#define PILOT_FIND_FIRST_WORDS {1,2}\n#define PILOT_SCENE_ADDRESS 0x08802200u\n#define PILOT_SCENE_WINDOW {11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26}\n#define PILOT_QUEST_OFFSET_ORDER {0}\n#define PILOT_QUEST_COUNT 0u\n#define PILOT_STRING_COPY 0x08802a00u\n#define PILOT_QUEST_COPY_SITES {{0x08802900u,0,{71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86}}}\n#define PILOT_OFFSET_ORDER {0}\n#define PILOT_RESOURCE_PROFILES {{5370,1024,2,{1,2}}}\n')
    const exe=path.join(dir,'test')
    const built=spawnSync('cc',['-DBATCH','-std=c11','-Wall','-Wextra','-Werror','-Wno-int-to-pointer-cast','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${dir}`,`-I${source}`,
      'tests/fixtures/p2gPilotHookHarness.c',path.join(source,'pilot_quest.c'),path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),path.join(source,'probe_log.c'),'-o',exe],{encoding:'utf8'})
    expect(built.status,built.stderr).toBe(0)
    const test=spawnSync(exe,[],{encoding:'utf8',env})
    expect(test.status,test.stdout+test.stderr).toBe(0)
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
