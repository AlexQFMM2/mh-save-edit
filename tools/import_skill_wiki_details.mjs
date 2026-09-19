#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import {wikiRows} from './map_skill_wiki.mjs'
import {matchesWikiSourceIdentity} from './runtime/skillWikiIdentity.mjs'
import {extractTables} from './snapshot_skill_wiki.mjs'
import {importSkillWikiDetails} from './runtime/skillWikiDetails.mjs'
const args=process.argv.slice(2)
const apply=args.includes('--apply')
const positional=args.filter(a=>a!=='--apply')
const [game,reviewFile,dbFile,backupRoot,...snapshots]=positional
if(!snapshots.length)throw new Error('Usage: node tools/import_skill_wiki_details.mjs GAME REVIEW_JSON DATABASE BACKUP_DIRECTORY SNAPSHOT_JSON... [--apply]')
const document=JSON.parse(fs.readFileSync(reviewFile,'utf8'))
const sources=[]
for(const file of snapshots){
 const snapshot=JSON.parse(fs.readFileSync(file,'utf8'))
 for(const record of snapshot.records){
  if(record.error)throw new Error(`Incomplete snapshot: ${record.url}`)
  const bytes=fs.readFileSync(path.join(path.dirname(file),record.file))
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error(`Source hash mismatch: ${record.file}`)
  if(JSON.stringify(extractTables(bytes.toString('utf8')))!==JSON.stringify(record.tables))throw new Error(`Parsed tables differ from archived HTML: ${record.file}`)
 }
 sources.push(...wikiRows(snapshot))
}
for(const entry of document.entries.filter(e=>e.gameId===game&&e.status==='reviewed')){
 const matches=sources.filter(s=>s.game===game&&s.url===entry.sourceUrl&&s.version===entry.sourceVersion&&s.sha256===entry.sourceSha256&&s.effect===entry.sourceText&&matchesWikiSourceIdentity(entry,s))
 if(matches.length!==1)throw new Error(`Reviewed entry does not uniquely match fixed source: ${entry.activationKey}`)
}
const original=new Database(dbFile,{readonly:true,fileMustExist:true})
// Validate the whole batch against a tiny in-memory identity fixture before any
// writable connection or backup. Dry run never opens the real database writable.
const check=new Database(':memory:')
check.exec('CREATE TABLE catalog_skill_activations(game_id TEXT,activation_key TEXT,skill_id INTEGER,dex_activation_id INTEGER,threshold INTEGER,name_jp TEXT)')
const copy=check.prepare('INSERT INTO catalog_skill_activations VALUES(?,?,?,?,?,?)')
for(const a of original.prepare('SELECT * FROM catalog_skill_activations WHERE game_id=?').all(game))copy.run(a.game_id,a.activation_key,a.skill_id,a.dex_activation_id,a.threshold,a.name_jp)
const result=importSkillWikiDetails(check,game,document)
check.close()
let backup=null
if(apply){
 fs.mkdirSync(backupRoot,{recursive:true})
 backup=path.join(backupRoot,`${game}-${Date.now()}.sqlite`)
 if(fs.existsSync(backup))throw new Error('Backup path exists')
 await original.backup(backup)
 original.close()
 const db=new Database(dbFile,{fileMustExist:true})
 try{
  db.transaction(()=>{
   importSkillWikiDetails(db,game,document)
   const hasMetadata=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_build_metadata'").get()
   if(hasMetadata){
    const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(reviewFile)).digest('hex')
    const builderHash=crypto.createHash('sha256').update(fs.readFileSync(import.meta.filename)).update(fs.readFileSync(new URL('./runtime/skillWikiDetails.mjs',import.meta.url))).update(fs.readFileSync(new URL('./runtime/skillWikiIdentity.mjs',import.meta.url))).digest('hex')
    db.prepare("INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES('skill-wiki-details',?,?,?)").run(game,sourceHash,builderHash)
   }
  })()
  if(db.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Database integrity failure; restore from backup')
 }finally{db.close()}
}else original.close()
console.log(JSON.stringify({...result,mode:apply?'applied':'dry-run',backup,reviewSha256:crypto.createHash('sha256').update(fs.readFileSync(reviewFile)).digest('hex')},null,2))
