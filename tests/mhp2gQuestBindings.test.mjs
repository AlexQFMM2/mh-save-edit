import {it,expect} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {questRows} from '../tools/mhp2g/chinese-patch/quest-bindings.mjs'
import {encodeTextPackage,decodeTextPackage,hash} from '../tools/mhp2g/chinese-patch/text-package.mjs'

function fixture() {
  const version='SYNTHETIC',original='SYNTHETIC QUEST',unit='data:4759:quest-payload:offset:400:utf8'
  const physical='data:5310:offset:700:utf8',key='data:5310:record:64:field:description'
  const binding={unit,physicalUnit:physical,physicalSource:{member:5310,offset:700,decodedSha256:'LIST'},
    questId:47,field:'description',pointerOffset:188,pointerSha256:'POINTER'}
  return {
    index:{sourceVersion:version,units:{[unit]:{text:original,offset:400,sha256:hash(original),source:{member:4759,decodedSha256:'ENVELOPE'}}},bindings:{[key]:binding}},
    draft:{units:{[unit]:{original,translated:'合成任务',status:'agent-reviewed',sourceSha256:hash(original),sourceVersion:version,basis:'Synthetic alias test'}}},
    resources:{isoSha256:version,records:[{member:5310,bytes:1024,decodedSha256:'LIST'}]},
    quests:{isoSha256:version,members:[]},lists:{isoSha256:version,members:[{member:5310,decodedSha256:'LIST',layout:'quest-list',status:'text-structure-parsed',records:[{recordOffset:64,questId:47,
      bindings:[{...binding,key,unit:physical}],units:{[physical]:{text:original,sha256:hash(original),offset:700}}}]}]}
  }
}
it('keeps a shared quest translation bound to its physical list record and offset',()=>{
  const rows=questRows(fixture())
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({member:5310,table:64,index:3,offset:700,flag:47,resourceBytes:1024})
  expect(decodeTextPackage(encodeTextPackage(rows,{batch:true}))[0]).toMatchObject({member:5310,offset:700})
})
it('rejects changed source identities, pointers and quest metadata',()=>{
  for (const mutate of [
    x=>{x.lists.members[0].decodedSha256='WRONG'},
    x=>{x.lists.members[0].records[0].questId=48},
    x=>{x.lists.members[0].records[0].bindings[0].pointerSha256='WRONG'},
    x=>{Object.values(x.lists.members[0].records[0].units)[0].offset=400},
    x=>{Object.values(x.draft.units)[0].status='machine-draft'}
  ]) {
    const x=fixture();mutate(x);expect(()=>questRows(x)).toThrow()
  }
})
it('checks production quest lookup and copy lifetimes under ASan/UBSan',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-quest-'))
  try {
    const source=path.resolve('tools/mhp2g/chinese-patch/prx'),exe=path.join(dir,'test')
    const built=spawnSync('cc',['-DBATCH','-std=c11','-Wall','-Wextra','-Werror','-g','-fsanitize=address,undefined','-fno-pie','-no-pie',`-I${source}`,
      'tests/fixtures/p2gQuestHarness.c',path.join(source,'pilot_quest.c'),path.join(source,'pilot_core.c'),path.join(source,'probe_core.c'),'-o',exe],{encoding:'utf8'})
    expect(built.status,built.stderr).toBe(0)
    const result=spawnSync(exe,[],{encoding:'utf8',env:{...process.env,ASAN_OPTIONS:'detect_leaks=0',UBSAN_OPTIONS:'halt_on_error=1'}})
    expect(result.status,result.stdout+result.stderr).toBe(0)
    expect(result.stdout).toContain('PASS quest')
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
