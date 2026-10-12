#!/usr/bin/env node
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { auditQuestCatalog } from './mhp2g/questCatalog.mjs'
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
assert(args.includes('--database'),'Missing --database')
const db=new Database(option('--database'),{readonly:true,fileMustExist:true})
let base
try {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='quest_schema'").get()?.value,'mhp2g-quests-v1')
  const report=auditQuestCatalog(db,{quests:502,native:450,rewards:4917,supplies:7470,groups:747,large:540,legacyMonsters:601,sequential:29,transitions:67,keys:77,urgent:21})
  if(args.includes('--base')) {
    base=new Database(option('--base'),{readonly:true,fileMustExist:true})
    const tables=base.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r=>r.name)
    const fingerprint=(database,table)=>crypto.createHash('sha256').update(JSON.stringify(database.prepare(`SELECT * FROM "${table.replaceAll('"','""')}"`).all().map(r=>JSON.stringify(r)).sort())).digest('hex')
    for(const table of tables)assert.equal(fingerprint(db,table),fingerprint(base,table),`Pre-existing data changed: ${table}`)
    report.preservedTables=tables.length
  }
  console.log(JSON.stringify({status:'passed',...report},null,2))
} finally {base?.close();db.close()}
