#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {hash, validateRows, validateText, encodeTextPackage, decodeTextPackage, fontCharacters} from './text-package.mjs'
import {questRows} from './quest-bindings.mjs'

const read = file => JSON.parse(fs.readFileSync(file))
export function prepareBatch({indexFile, draftFile, resourcesFile, nativeDirectory, questsFile, listsFile, output}) {
  assert(!fs.existsSync(output), 'Use a new output directory')
  assert.equal(Boolean(questsFile),Boolean(listsFile),'Provide both quest source files together')
  const index=read(indexFile), draft=read(draftFile), resources=read(resourcesFile)
  const nativeFile=path.join(nativeDirectory,'texts.json'),native=read(nativeFile)
  const nativeManifest=read(path.join(nativeDirectory,'manifest.json'))
  assert.equal(hash(fs.readFileSync(nativeFile)),nativeManifest.files['texts.json'].sha256)
  assert.equal(draft.sourceVersion,index.sourceVersion)
  assert.equal(draft.inputs[path.resolve(indexFile)],hash(fs.readFileSync(indexFile)))
  assert.equal(resources.isoSha256,native.isoSha256)
  const records=new Map(resources.records.map(r=>[r.member,r]))
  const rows=[], pending=[], literals=[], untranslated=[], seenUnits=new Set()
  const reviewStatuses=new Set(['project-reviewed','agent-reviewed','pilot-reviewed'])
  const quests=questsFile&&listsFile?questRows({index,draft,resources,quests:read(questsFile),lists:read(listsFile)}):[]
  const connectedQuests=new Set(quests.map(r=>r.physicalBinding))
  for (const [key,binding] of Object.entries(index.bindings)) {
    const unit=index.units[binding.unit], decision=draft.units[binding.unit]
    if (!decision) {
      assert(draft.excluded[binding.unit], 'Unaccounted source unit')
      continue
    }
    assert.equal(decision.original,unit.text)
    assert.equal(decision.sourceSha256,hash(Buffer.from(unit.text)))
    assert.equal(decision.sourceVersion,index.sourceVersion)
    seenUnits.add(binding.unit)
    if (connectedQuests.has(key)) continue
    if (['untranslated','snapshot-untranslated'].includes(decision.status)) {
      assert.equal(decision.translated,unit.text,'Unreviewed text must retain the source')
      untranslated.push(key);continue
    }
    assert(reviewStatuses.has(decision.status) || decision.status==='literal-preserved','Unreviewed translation cannot enter a trial package')
    if (decision.translated===unit.text) { literals.push(key); continue }
    assert(reviewStatuses.has(decision.status),'Literal decision must retain the source')
    const member=unit.source.member, resource=records.get(member)
    if (!(member===15 || (member>=4756 && member<=4758) || (member>=5369 && member<=5372))) {
      pending.push({key,unit:binding.unit,reason:'Consumer not yet connected to verified runtime hook'})
      continue
    }
    assert(resource && resource.decodedSha256===unit.source.decodedSha256, 'Resource identity mismatch')
    const source=resource.units[binding.unit]
    assert(source && source.sha256===unit.sha256 && source.text===unit.text)
    const row={member,table:binding.table,index:binding.index,offset:unit.offset,
      resourceBytes:resource.bytes,flag:binding.flag??0,original:unit.text,
      translated:decision.translated,sourceSha256:unit.sha256,basis:decision.basis,status:decision.status}
    try {
      validateText(row.original,row.translated,{batch:true})
    }
    catch(error) { pending.push({key,unit:binding.unit,reason:error.message}); continue }
    rows.push(row)
  }
  assert.equal(seenUnits.size,Object.keys(draft.units).length,'Unbound translation')
  const sorted=validateRows([...rows,...quests],{batch:true}), packet=encodeTextPackage(sorted,{batch:true})
  assert.equal(decodeTextPackage(packet).length,sorted.length)
  const profiles=[]
  for (const member of [4756,4757,4758,5369,5370,5371,5372]) {
    const r=records.get(member), words=r.directoryKind==='count-offsets-at-8'
      ? [r.tables.length,8,...r.tables.map(t=>t.offset)]
      : [...r.tables.flatMap(t=>[t.table,t.offset]),0xffffffff,0xffffffff]
    assert(words.length<=34)
    profiles.push({member,bytes:r.bytes,headerWords:words,decodedSha256:r.decodedSha256})
  }
  const evidence={schema:'p2g-batch-texts-v1',sourceVersion:index.sourceVersion,bootSha256:native.boot.sha256,
    isoSha256:native.isoSha256,rows:sorted,codepoints:fontCharacters(sorted).filter(code=>code>=128),profiles,
    dialogue:{resourceSha256:records.get(5370).decodedSha256},
    counts:{authoredUnits:Object.values(draft.units).filter(r=>reviewStatuses.has(r.status)).length,
      changedUnits:Object.values(draft.units).filter(r=>reviewStatuses.has(r.status) && r.translated!==r.original).length,
      untranslatedUnits:Object.values(draft.units).filter(r=>['untranslated','snapshot-untranslated'].includes(r.status)).length,
      indexedUnits:Object.keys(draft.units).length,excludedUnits:Object.keys(draft.excluded).length,
      runtimeBindings:sorted.length,unchangedBindings:literals.length,pendingBindings:pending.length,
      untranslatedBindings:untranslated.length,statuses:draft.counts},pending,literals,untranslated,
    inputs:Object.fromEntries([indexFile,draftFile,resourcesFile,nativeFile,path.join(nativeDirectory,'manifest.json'),questsFile,listsFile].filter(Boolean)
      .map(file=>[path.resolve(file),hash(fs.readFileSync(file))])),runtimeAccepted:false,displayAccepted:false}
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'texts.bin'),packet)
  fs.writeFileSync(path.join(output,'prepared.json'),JSON.stringify(evidence,null,2)+'\n')
  fs.writeFileSync(path.join(output,'characters.json'),JSON.stringify({codepoints:evidence.codepoints})+'\n')
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({schema:'p2g-batch-text-build-v1',
    files:Object.fromEntries(['texts.bin','prepared.json','characters.json'].map(name=>[name,hash(fs.readFileSync(path.join(output,name)))])),
    runtimeAccepted:false},null,2)+'\n')
  return evidence.counts
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [indexFile,draftFile,resourcesFile,nativeDirectory,output,questsFile,listsFile]=process.argv.slice(2)
  assert(output,'Usage: prepare-batch.mjs <index> <translations> <resources> <native-dir> <new-output> [<quest-envelopes> <quest-lists>]')
  console.log(prepareBatch({indexFile,draftFile,resourcesFile,nativeDirectory,output,questsFile,listsFile}))
}
