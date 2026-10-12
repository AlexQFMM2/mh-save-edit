#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { appendQuests, auditQuestCatalog } from './mhp2g/questCatalog.mjs'

export function buildQuestCatalog({base,evidence,output,expected}) {
  assert(!fs.existsSync(output),'Output exists; refusing to overwrite')
  const snapshot=JSON.parse(fs.readFileSync(evidence,'utf8'))
  assert.equal(sha256(base),snapshot.inputs.base,'Base fingerprint mismatch')
  fs.mkdirSync(path.dirname(output),{recursive:true})
  const temp=fs.mkdtempSync(path.join(path.dirname(output),'.p2g-quests-'))
  let db
  try {
    const file=path.join(temp,'mhp2g.sqlite');fs.copyFileSync(base,file);db=new Database(file);db.pragma('foreign_keys=ON')
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='monster_schema'").get()?.value,'mhp2g-monsters-v1')
    const builderHash=sha256(fileURLToPath(import.meta.url))+':'+sha256(fileURLToPath(new URL('./mhp2g/questCatalog.mjs',import.meta.url)))
    db.transaction(()=>{
      appendQuests(db,snapshot)
      db.prepare("INSERT INTO meta VALUES('quest_schema','mhp2g-quests-v1')").run()
      db.prepare("INSERT OR REPLACE INTO meta VALUES('catalog_capabilities','items,monsters,quests')").run()
      db.prepare('INSERT INTO catalog_build_metadata VALUES(?,?,?,?)').run('quests','mhp2g',sha256(evidence),builderHash)
    })()
    const audit=auditQuestCatalog(db,expected);db.exec('VACUUM');db.close();db=null
    const manifest={schema:'mhp2g-quests-v1',baseSha256:sha256(base),evidenceSha256:sha256(evidence),builderHash,databaseSha256:sha256(file),audit}
    fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
    fs.writeFileSync(path.join(temp,'audit.json'),JSON.stringify({status:'passed',...audit},null,2)+'\n')
    assert(!fs.existsSync(output),'Output exists; refusing to overwrite');fs.renameSync(temp,output)
    return manifest
  } finally {db?.close();fs.rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
  for(const flag of ['--base','--evidence','--output'])assert(args.includes(flag),`Missing ${flag}`)
  console.log(JSON.stringify(buildQuestCatalog({base:option('--base'),evidence:option('--evidence'),output:option('--output'),
    expected:{quests:502,native:450,rewards:4917,supplies:7470,groups:747,large:540,legacyMonsters:601,sequential:29,transitions:67,keys:77,urgent:21}}),null,2))
}
