#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
const [dataRoot,generatedRoot,reviews,backups,output]=process.argv.slice(2)
if(!output)throw new Error('Usage: node tools/audit_skill_wiki_details.mjs RUNTIME_ROOT GENERATED_ROOT REVIEWS_ROOT RUNTIME_BACKUPS_ROOT NEW_REPORT_JSON')
if(fs.existsSync(output))throw new Error('Refusing to overwrite audit report')
const report={format:'skill-wiki-audit-v1',games:[],limits:['Wiki evidence, not executable verification.','Arabic numeral counts are text coverage, not proof of correctness.','Unresolved/conflicting rows retain original descriptions.']}
for(const game of ['mh3g','mh4g','mhgu']){
 const files=fs.readdirSync(backups).filter(f=>f.startsWith(game+'-')&&f.endsWith('.sqlite')).sort()
 if(files.length!==1)throw new Error(`Select a backup directory with exactly one pre-import backup per game: ${game}`)
 const backup=path.join(backups,files[0])
 const db=new Database(path.join(dataRoot,game+'.sqlite'),{readonly:true,fileMustExist:true})
 const old=new Database(backup,{readonly:true,fileMustExist:true})
 const generated=new Database(path.join(generatedRoot,game+'.sqlite'),{readonly:true,fileMustExist:true})
 try{
  const doc=JSON.parse(fs.readFileSync(path.join(reviews,`reviewed-${game}-v1.json`),'utf8'))
  const rows=db.prepare('SELECT * FROM catalog_skill_effect_details ORDER BY activation_key').all()
  const prepared=generated.prepare('SELECT * FROM catalog_skill_effect_details ORDER BY activation_key').all()
  assert.deepEqual(rows,prepared,'Generated/runtime descriptions differ')
  const reviewed=doc.entries.filter(e=>e.status==='reviewed')
  assert.equal(rows.length,reviewed.length)
  for(const e of reviewed){
   const actual=rows.find(r=>r.game_id===game&&r.activation_key===e.activationKey)
   assert.ok(actual)
   for(const [column,key] of Object.entries({skill_id:'skillId',dex_activation_id:'dexActivationId',threshold:'threshold',name_jp:'nameJp',description_cn:'descriptionCn',source_url:'sourceUrl',source_version:'sourceVersion',source_sha256:'sourceSha256',source_text:'sourceText',review_note:'reviewNote'}))assert.equal(actual[column],e[key],`${game}:${e.activationKey}:${column}`)
  }
  // Compare every preexisting business table, not just the original skill text.
  // Import never rewrites these tables, so their natural row order is stable.
  const unchanged=[]
  const tables=old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
  for(const {name} of tables){
   if(['catalog_build_metadata','catalog_skill_effect_details'].includes(name))continue
   const quoted='"'+name.replaceAll('"','""')+'"'
   assert.deepEqual(db.prepare(`SELECT * FROM ${quoted}`).all(),old.prepare(`SELECT * FROM ${quoted}`).all(),`Original table changed: ${game}:${name}`)
   unchanged.push(name)
  }
  assert.deepEqual(db.prepare("SELECT * FROM catalog_build_metadata WHERE domain!='skill-wiki-details' ORDER BY domain,game_id").all(),old.prepare("SELECT * FROM catalog_build_metadata WHERE domain!='skill-wiki-details' ORDER BY domain,game_id").all())
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
  assert.equal(db.pragma('foreign_key_check').length,0)
  const total=db.prepare('SELECT count(*) n FROM catalog_skill_activations WHERE game_id=?').get(game).n
  report.games.push({game,total,imported:rows.length,containsArabicNumerals:rows.filter(r=>/\d/.test(r.description_cn)).length,backup,unchangedTables:unchanged,integrity:'ok',foreignKeys:'ok',generatedMatchesRuntime:true,metadata:db.prepare("SELECT * FROM catalog_build_metadata WHERE domain='skill-wiki-details'").all(),excluded:doc.entries.filter(e=>e.status!=='reviewed').map(e=>({activationKey:e.activationKey,nameJp:e.nameJp,status:e.status,reason:e.reviewNote}))})
  console.log(game,rows.length+'/'+total,'imported;',unchanged.length,'original tables unchanged')
 }finally{db.close();old.close();generated.close()}
}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log('Audit report:',output)
