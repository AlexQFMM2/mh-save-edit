import assert from 'node:assert/strict'
import fs from 'node:fs'
import {hash, BATCH_MAX_ROWS} from './text-package.mjs'

export function batchHeader(prepared, inspectionFile, resourcesFile) {
  const inspection=JSON.parse(fs.readFileSync(inspectionFile))
  const resources=JSON.parse(fs.readFileSync(resourcesFile))
  function window(source,address) {
    const item=inspection.results.find(x=>x.query.kind==='range' && x.query.source===source &&
      x.range.start<=address && x.range.start+x.range.bytes>=address+64)
    assert(item,`Missing consumer instruction window ${source}:${address.toString(16)}`)
    assert.equal(item.sourceSha256,source==='boot'?prepared.bootSha256:
      resources.records.find(r=>r.member===source).decodedSha256,'Different consumer code')
    const raw=Buffer.alloc(item.range.words.length*4)
    item.range.words.forEach((word,i)=>raw.writeUInt32LE(word,i*4))
    assert.equal(hash(raw),item.range.sha256,'Consumer instruction hash mismatch')
    const at=(address-item.range.start)/4
    return item.range.words.slice(at,at+16)
  }
  const consumers=[
    ['SCENE',50,0x09a76958,[0x27bdffe0,0xafbf000c],0x0e69da44],
    ['TUTORIAL',51,0x09a5e460,[0x27bdffe0,0xafbf000c],0x0e697906],
    ['TRAINING',53,0x09a69618,[0x27bdffe0,0xafbf000c],0x0e69a574],
    ['QUEST_MAIN','boot',0x0886be9c,[0x27bdfff0,0xafbf000c]],
    ['QUEST_LIST',50,0x09a8aa20,[0x27bdfff0,0xafbf000c]],
    ['QUEST_TRAINING',53,0x09a69380,[0x8cc40014,0x3c0208a6]],
    ['QUEST_COPY',50,0x09a85620,[0x27bdfff0,0xafbf000c]],
  ]
  const hex=n=>`0x${n.toString(16)}u`,list=a=>`{${a.map(hex).join(',')}}`
  const order=prepared.rows.map((r,i)=>({r,i})).sort((a,b)=>a.r.member-b.r.member||a.r.offset-b.r.offset||a.i-b.i).map(x=>x.i)
  assert(order.length===prepared.rows.length && order.every(i=>i<BATCH_MAX_ROWS && i<=65535))
  const definitions=consumers.map(([name,source,address,prologue,call])=>{
    const words=window(source,address)
    assert.deepEqual(words.slice(0,2),prologue,`${name} trampoline prologue changed`)
    if(call) assert.equal(words[4],call,`${name} table accessor changed`)
    return `#define PILOT_${name}_ADDRESS ${hex(address)}\n#define PILOT_${name}_WORDS ${list(words.slice(0,2))}\n#define PILOT_${name}_WINDOW ${list(words)}\n`
  }).join('')
  const copyAddresses=[0x09a83110,0x09a83128,0x09a83140,0x09a83158,0x09a83170,0x09a83184,
    0x09a833f0,0x09a83408,0x09a83420,0x09a83438,0x09a83450,0x09a83464]
  const copies=copyAddresses.map((address,i)=>{
    const words=window(50,address)
    assert.equal(words[0],0x0e203ecc,'Quest copy call changed')
    return `{${hex(address)},${i%6},${list(words)}}`
  })
  const questOrder=prepared.rows.map((r,i)=>({r,i})).filter(({r})=>r.member>=4759&&r.member<=5322)
    .sort((a,b)=>a.r.offset-b.r.offset||a.r.member-b.r.member||a.r.table-b.r.table||a.r.index-b.r.index).map(x=>x.i)
  return '\n'+definitions+
    '#define PILOT_STRING_COPY 0x0880fb30u\n'+
    `#define PILOT_QUEST_COPY_SITES {${copies.join(',')}}\n`+
    `#define PILOT_QUEST_OFFSET_ORDER ${list(questOrder.length?questOrder:[0])}\n`+
    `#define PILOT_QUEST_COUNT ${questOrder.length}u\n`+
    `#define PILOT_OFFSET_ORDER ${list(order)}\n`+
    '#define PILOT_RESOURCE_PROFILES {'+prepared.profiles.map(p=>
      `{${p.member},${p.bytes},${p.headerWords.length},${list(p.headerWords)}}`).join(',')+'}\n'
}
