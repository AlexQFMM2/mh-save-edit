#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { appendSkills,auditSkillCatalog,tableFingerprint } from './mhp2g/skillCatalog.mjs'
export function buildSkillCatalog({base,evidence,output,expected}) {
  assert(!fs.existsSync(output),'Output exists; refusing to overwrite')
  const input=JSON.parse(fs.readFileSync(evidence,'utf8')); assert.equal(sha256(base),input.inputs['base.sqlite'],'Base fingerprint mismatch')
  fs.mkdirSync(path.dirname(output),{recursive:true});const tmp=fs.mkdtempSync(path.join(path.dirname(output),'.p2g-skills-'));let db
  try {
    const file=path.join(tmp,'mhp2g.sqlite');fs.copyFileSync(base,file);db=new Database(file);db.pragma('foreign_keys=ON')
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r=>r.name)
    const before=new Map(tables.map(t=>[t,tableFingerprint(db,t)]))
    const builderHash=sha256(fileURLToPath(import.meta.url))+':'+sha256(fileURLToPath(new URL('./mhp2g/skillCatalog.mjs',import.meta.url)))
    db.transaction(()=>{
      appendSkills(db,input)
      db.prepare("INSERT INTO meta VALUES('skill_schema','mhp2g-skills-v1')").run()
      const capabilities=db.prepare("SELECT value FROM meta WHERE key='catalog_capabilities'").get()?.value??'items'
      db.prepare("INSERT OR REPLACE INTO meta VALUES('catalog_capabilities',?)").run(`${capabilities},skills`)
      db.prepare('INSERT INTO catalog_build_metadata VALUES(?,?,?,?)').run('skills','mhp2g',sha256(evidence),builderHash)
    })()
    const audit=auditSkillCatalog(db,expected)
    for(const table of tables)assert.equal(tableFingerprint(db,table),before.get(table),`Existing table changed: ${table}`)
    audit.preservedTables=tables.length;db.exec('VACUUM');db.close();db=null
    const result={schema:'mhp2g-skills-v1',baseSha256:sha256(base),evidenceSha256:sha256(evidence),builderHash,databaseSha256:sha256(file),audit}
    fs.writeFileSync(path.join(tmp,'manifest.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(tmp,'audit.json'),JSON.stringify(audit,null,2)+'\n')
    assert(!fs.existsSync(output),'Output exists');fs.renameSync(tmp,output);return result
  } finally {db?.close();fs.rmSync(tmp,{recursive:true,force:true})}
}
export const expectedSkillCounts={skills:99,activations:213,special:1,composites:7,equipment:2264,decorations:168,recipes:192,materials:597,points:7461}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
  for(const flag of ['--base','--evidence','--output'])assert(args.includes(flag),`Missing ${flag}`)
  console.log(JSON.stringify(buildSkillCatalog({base:option('--base'),evidence:option('--evidence'),output:option('--output'),expected:expectedSkillCounts}),null,2))
}
