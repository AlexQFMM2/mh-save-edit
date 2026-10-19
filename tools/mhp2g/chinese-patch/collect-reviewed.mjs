#!/usr/bin/env node
// Only source-bound reviews are accepted. No model output is imported here.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {hash,validateText} from './text-package.mjs'

const controls=/~(?:[A-Z][0-9A-F]{2}|[0-9A-F]{2}|C%[-+ #0]*\d*(?:\.\d+)?[a-zA-Z])|%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[a-zA-Z%]|\$/g
export function reflowReview(original, translated) {
  // Some catalog reviews store escaped LF. This is a serialization change,
  // not permission to change engine variables, colors, buttons or page flags.
  translated=translated.replaceAll('\\n','\n')
  assert.deepEqual(translated.match(controls)??[],original.match(controls)??[],'Review changed controls')
  const a=original.split(controls),b=translated.split(controls),tokens=original.match(controls)??[]
  const output=a.map((source,i)=>{
    let target=b[i]
    if (source.split('\n').length!==target.split('\n').length) {
      const lines=source.split('\n'),text=target.replaceAll('\n','')
      const total=lines.reduce((n,s)=>n+s.length,0)
      let used=0,weight=0
      const result=[]
      for (const line of lines.slice(0,-1)) {
        weight+=line.length
        let end=total?Math.round(text.length*weight/total):used
        while(end>used && end<text.length && /[A-Za-z0-9]/.test(text[end-1]) && /[A-Za-z0-9]/.test(text[end])) end++
        result.push(text.slice(used,end)); used=end
      }
      result.push(text.slice(used));target=result.join('\n')
    }
    return target+(tokens[i]??'')
  }).join('')
  validateText(original,output,{batch:true})
  assert.equal(output.replaceAll('\n',''),translated.replaceAll('\n',''),'Reflow lost content')
  return output
}

export function collectReviewed(configFile,output) {
  assert(!fs.existsSync(output),'Use a new output file')
  const inputs={}
  const read=file=>{
    const bytes=fs.readFileSync(file);inputs[path.resolve(file)]=hash(bytes)
    return JSON.parse(bytes)
  }
  const config=read(configFile),index=read(config.index),localization=read(config.localization)
  const core=new Map(),exact=new Map(),issues=[]
  function add(source,target,basis,status,nativeKey) {
    if (!target) return
    const entry={original:source,translated:target,basis,status}
    exact.set(source,entry)
    if(nativeKey!==undefined) core.set(nativeKey,entry)
  }
  for(const [key,row] of Object.entries(localization.units)) {
    if(row.chinese) assert(['reviewed','official'].includes(row.status),'Unreviewed catalog translation')
    add(row.japanese,row.chinese,row.reviewBasis??'Existing project review','project-reviewed',key)
  }
  for(const file of config.nameReviews??[]) for(const row of read(file).entries) {
    assert.equal(localization.units[row.textKey]?.japanese,row.japanese,'Stale identity-specific name review')
    add(row.japanese,row.chinese,row.basis,'project-reviewed',row.textKey)
  }
  for(const file of config.textReviews??[]) for(const row of Object.values(read(file).units)) {
    if(row.chinese) assert(['reviewed','official'].includes(row.status),'Unreviewed text review')
    add(row.japanese,row.chinese,row.basis,'project-reviewed')
  }
  if(config.skillReview) {
    const skills=read(config.skillReview)
    for(const row of [...skills.trees,...skills.rules]) add(row.japanese,row.nameCn,'Latest P2G skill review; exact source text','project-reviewed')
  }
  const pilot=read(config.pilotReview)
  for(const [key,row] of Object.entries(pilot.units)) add(row.original,row.translated,row.basis,'pilot-reviewed',key)
  for(const row of pilot.dialogue) add(row.original,row.translated,row.basis,'pilot-reviewed')
  const manual=new Map()
  for(const file of config.manualReviews??[]) {
    const review=read(file)
    assert.equal(review.sourceVersion,index.sourceVersion)
    assert.equal(review.indexSha256,hash(fs.readFileSync(config.index)))
    for(const [key,row] of Object.entries(review.units)) {
      assert.equal(row.status,'agent-reviewed')
      assert.equal(row.original,index.units[key]?.text)
      assert.equal(row.sourceSha256,index.units[key].sha256)
      assert.equal(row.sourceVersion,index.sourceVersion)
      manual.set(key,row)
      add(row.original,row.translated,row.basis,row.status)
    }
  }
  const references=new Map()
  for(const [key,binding] of Object.entries(index.bindings)) {
    if(!references.has(binding.unit)) references.set(binding.unit,[])
    references.get(binding.unit).push({key,...binding})
  }
  const units={},excluded={},counts={}
  for(const [key,unit] of Object.entries(index.units)) {
    const bindings=references.get(key)
    assert(bindings?.length,'Unbound index unit')
    if(unit.source.member===15 && bindings.some(b=>b.table>=19)) {
      excluded[key]='word-filter-or-unconfirmed-filter-table';continue
    }
    let decision=manual.get(key)
    if(!decision && unit.source.member===15) {
      for(const b of bindings) { decision=core.get(`${b.table}:${b.index}`); if(decision) break }
    }
    decision??=exact.get(unit.text)
    if(decision) {
      assert.equal(decision.original,unit.text,'Stale review source')
      try {
        const translated=reflowReview(unit.text,decision.translated)
        decision={...decision,translated,reflowed:translated!==decision.translated}
      } catch(error) {issues.push({unit:key,reason:error.message});decision=null}
    }
    if(!decision) decision={original:unit.text,translated:unit.text,
      status:/[\u3040-\u30ff\u3400-\u9fff]/u.test(unit.text)?'untranslated':'literal-preserved',
      basis:'Retain source until a compatible review exists'}
    units[key]={...decision,sourceSha256:unit.sha256,sourceVersion:index.sourceVersion}
    counts[decision.status]=(counts[decision.status]??0)+1
  }
  const result={schema:'p2g-translations-v1',sourceVersion:index.sourceVersion,inputs,units,excluded,counts,issues,
    runtimeAccepted:false,displayAccepted:false}
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'})
  return {counts,issues:issues.length,excluded:Object.keys(excluded).length}
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [configFile,output]=process.argv.slice(2)
  assert(output,'Usage: collect-reviewed.mjs <private-config> <new-output.json>')
  console.log(collectReviewed(configFile,output))
}
