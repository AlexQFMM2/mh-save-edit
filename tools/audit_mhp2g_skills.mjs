#!/usr/bin/env node
import fs from 'node:fs'
import { sha256 } from './mhp2g/sources.mjs'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { auditSkillCatalog,tableFingerprint } from './mhp2g/skillCatalog.mjs'
import { expectedSkillCounts } from './build_mhp2g_skill_catalog.mjs'
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
assert(args.includes('--database')&&args.includes('--base'),'Usage: --database <new.sqlite> --base <base.sqlite>')
const db=new Database(option('--database'),{readonly:true,fileMustExist:true}),base=new Database(option('--base'),{readonly:true,fileMustExist:true})
try {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='skill_schema'").get()?.value,'mhp2g-skills-v1')
  const audit=auditSkillCatalog(db,expectedSkillCounts)
  for(const {name} of base.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata')").all())assert.equal(tableFingerprint(db,name),tableFingerprint(base,name),`Existing data changed: ${name}`)
  if(args.includes('--evidence')) {
    const evidence=JSON.parse(fs.readFileSync(option('--evidence'),'utf8'))
    assert.equal(db.prepare("SELECT source_sha256 FROM catalog_build_metadata WHERE domain='skills'").get()?.source_sha256,sha256(option('--evidence')))
    for(const skill of evidence.skills)assert.deepEqual(JSON.parse(db.prepare('SELECT detail_json FROM p2g_skills WHERE skill_id=?').get(skill.skillId).detail_json),{...skill,sourceUrl:evidence.sourceUrl})
    for(const equipment of evidence.equipment) {
      assert.deepEqual(JSON.parse(db.prepare('SELECT detail_json FROM p2g_skill_equipment WHERE equipment_key=?').get(equipment.equipmentKey).detail_json),equipment)
      assert.deepEqual(db.prepare('SELECT skill_id,points FROM p2g_skill_points WHERE equipment_key=? ORDER BY position').all(equipment.equipmentKey),equipment.skills.map(s=>({skill_id:s.skillId,points:s.points})))
    }
  }
  console.log(JSON.stringify({status:'passed',...audit},null,2))
} finally {db.close();base.close()}
