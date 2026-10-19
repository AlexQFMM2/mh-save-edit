#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {questRows} from './quest-bindings.mjs'
import {hash,encodeTextPackage,decodeTextPackage,fontCharacters,validateRows,BATCH_MAX_ROWS,BATCH_MAX_BYTES} from './text-package.mjs'

const [preparedFile,indexFile,draftFile,resourcesFile,questsFile,listsFile,output]=process.argv.slice(2)
assert(output,'Usage: audit-capacity.mjs <prepared> <index> <reviewed> <resources> <quests> <quest-lists> <new-output>')
assert(!fs.existsSync(output),'Use a new output directory')
const read=file=>JSON.parse(fs.readFileSync(file))
const prepared=read(preparedFile),index=read(indexFile),draft=read(draftFile),resources=read(resourcesFile)
assert.equal(draft.inputs[path.resolve(indexFile)],hash(fs.readFileSync(indexFile)))
for (const file of [indexFile,draftFile,resourcesFile]) assert.equal(prepared.inputs[path.resolve(file)],hash(fs.readFileSync(file)))
const records=new Map(resources.records.map(r=>[r.member,r]))
const candidates=questRows({index,draft,resources,quests:read(questsFile),lists:read(listsFile)})
for (const [key,b] of Object.entries(index.bindings)) {
  const u=index.units[b.unit],d=draft.units[b.unit],m=u.source.member
  if (![4756,4758].includes(m) || !d || d.original===d.translated) continue
  const resource=records.get(m),native=resource.units[b.unit]
  assert.equal(resource.decodedSha256,u.source.decodedSha256)
  assert.equal(native.sha256,d.sourceSha256)
  assert.equal(native.text,d.original)
  candidates.push({member:m,table:b.table,index:b.index,offset:u.offset,resourceBytes:resource.bytes,
    flag:0,original:d.original,translated:d.translated,sourceSha256:d.sourceSha256,basis:d.basis,physicalBinding:key})
}
const rows=validateRows([...prepared.rows,...candidates],{batch:true}),packet=encodeTextPackage(rows,{batch:true})
assert.equal(decodeTextPackage(packet).length,rows.length)
assert.equal(candidates.length,prepared.counts.pendingBindings,'Missing pending consumer')
const codepoints=fontCharacters(rows).filter(c=>c>=128)
fs.mkdirSync(output,{recursive:true})
fs.writeFileSync(path.join(output,'texts-candidates.bin'),packet)
fs.writeFileSync(path.join(output,'characters.json'),JSON.stringify({codepoints})+'\n')
const report={schema:'p2g-full-capacity-audit-v1',runtimeConnected:false,
  counts:{connected:prepared.rows.length,candidates:candidates.length,total:rows.length,glyphs:codepoints.length},
  packetBytes:packet.length,limits:{rows:BATCH_MAX_ROWS,packetBytes:BATCH_MAX_BYTES},
  packetSha256:hash(packet),members:Object.fromEntries([...new Set(rows.map(r=>r.member))].map(m=>[m,rows.filter(r=>r.member===m).length])),
  inputs:Object.fromEntries([preparedFile,indexFile,draftFile,resourcesFile,questsFile,listsFile].map(f=>[path.resolve(f),hash(fs.readFileSync(f))])),
  warning:'Offline capacity candidate only; pending consumer hooks are not installed. Do not install this packet.'}
fs.writeFileSync(path.join(output,'capacity.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({...report,members:undefined,inputs:undefined},null,2))
