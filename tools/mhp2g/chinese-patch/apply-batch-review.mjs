#!/usr/bin/env node
// Merge private, source-bound decisions. This never marks machine output as reviewed.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {hash,validateText} from './text-package.mjs'
const [indexFile,draftFile,manualFile,skillFile,output]=process.argv.slice(2)
assert(output,'Usage: apply-batch-review.mjs <index> <draft> <manual-review> <skill-review> <new-output>')
assert(!fs.existsSync(output),'Use a new output file')
const read=f=>JSON.parse(fs.readFileSync(f))
const index=read(indexFile), draft=read(draftFile), manual=read(manualFile), skills=read(skillFile)
assert.equal(draft.sourceVersion,index.sourceVersion)
assert.equal(manual.sourceVersion,index.sourceVersion)
assert.equal(manual.indexSha256,hash(fs.readFileSync(indexFile)))
let skillReused=0
const names=new Map([...skills.trees,...skills.rules].filter(r=>r.nameCn).map(r=>[r.japanese,r.nameCn]))
const exactManual=new Map(Object.values(manual.units).map(row=>[row.original,row]))
let manualReused=0
for (const [key,row] of Object.entries(draft.units)) {
  const unit=index.units[key]
  assert.equal(row.original,unit.text)
  assert.equal(row.sourceSha256,hash(Buffer.from(unit.text)))
  if (unit.source.member===15 && names.has(row.original)) {
    const translated=names.get(row.original)
    validateText(row.original,translated,{batch:true})
    draft.units[key]={...row,translated,status:'project-reviewed',basis:'Latest P2G skill name review; exact Japanese source text, native identity retained'}
    skillReused++
  }
  if (row.status==='machine-draft' && exactManual.has(row.original)) {
    const reviewed=exactManual.get(row.original)
    validateText(row.original,reviewed.translated,{batch:true})
    draft.units[key]={...row,translated:reviewed.translated,status:'agent-reviewed',
      basis:reviewed.basis+'；同文复用审校结果，保留当前资源身份'}
    manualReused++
  }
}
for (const [key,row] of Object.entries(manual.units)) {
  assert(draft.units[key], 'Manual review points outside translatable scope')
  assert.equal(row.original,index.units[key].text)
  assert.equal(row.sourceSha256,index.units[key].sha256)
  assert.equal(row.sourceVersion,index.sourceVersion)
  validateText(row.original,row.translated,{batch:true})
  assert.equal(row.status,'agent-reviewed')
  draft.units[key]=row
}
draft.inputs={...draft.inputs,...Object.fromEntries([draftFile,manualFile,skillFile].map(file=>[path.resolve(file),hash(fs.readFileSync(file))]))}
draft.counts={}
for (const row of Object.values(draft.units)) draft.counts[row.status]=(draft.counts[row.status]??0)+1
draft.review={manualUnits:Object.keys(manual.units).length,manualReused,skillReused,displayAccepted:false}
fs.writeFileSync(output,JSON.stringify(draft,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({counts:draft.counts,review:draft.review}))
