#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot=path.resolve(import.meta.dirname,'..')
const args=process.argv.slice(2)
const researchIndex=args.indexOf('--research-root')
const researchRoot=path.resolve(projectRoot,researchIndex>=0?args[researchIndex+1]:'../research')
const dataRoot=path.join(researchRoot,'generated/mh-save-edit/catalog/data')
const expected={mh3g:{quests:364,dexRewards:6560},mh4g:{quests:572,dexRewards:13012},mhgu:{quests:1356,dexRewards:37569}}
const verifiedHunterArtQuestPairs=[[21,'dex:783'],[33,'dex:758'],[45,'dex:772'],[57,'dex:781'],[69,'dex:757'],[93,'dex:764'],[105,'dex:757'],[117,'dex:754'],[129,'dex:781'],[141,'dex:764'],[153,'dex:758'],[165,'dex:772'],[177,'dex:783'],[189,'dex:754']]
const results=[]
for(const[gameId,counts]of Object.entries(expected)){
  const file=path.join(dataRoot,`${gameId}.sqlite`)
  if(!fs.existsSync(file))throw new Error(`Missing catalog database: ${file}`)
  const db=new Database(file,{readonly:true})
  const value={
    quests:db.prepare('SELECT count(*) count FROM catalog_quests WHERE game_id=?').get(gameId).count,
    dexRewards:db.prepare("SELECT count(*) count FROM catalog_quest_rewards WHERE game_id=? AND source LIKE '%DB_ItmtoQst'").get(gameId).count,
    unmappedRewards:db.prepare('SELECT count(*) count FROM catalog_quest_rewards r LEFT JOIN catalog_items i ON i.game_id=r.game_id AND i.save_id=r.item_save_id WHERE r.game_id=? AND i.save_id IS NULL').get(gameId).count,
  }
  if(value.quests!==counts.quests)throw new Error(`${gameId}: expected ${counts.quests} quests, received ${value.quests}`)
  if(value.dexRewards!==counts.dexRewards)throw new Error(`${gameId}: expected ${counts.dexRewards} Dex rewards, received ${value.dexRewards}`)
  if(value.unmappedRewards!==0)throw new Error(`${gameId}: ${value.unmappedRewards} rewards have no item`)
  if(gameId==='mhgu'){
    value.nativeRewards=db.prepare("SELECT count(*) count FROM catalog_quest_rewards WHERE quest_key LIKE 'mhgu:%'").get().count
    value.hunterArts=db.prepare("SELECT count(*) count FROM catalog_hunter_arts WHERE game_id='mhgu' AND is_placeholder=0").get().count
    value.hunterArtPlaceholders=db.prepare("SELECT count(*) count FROM catalog_hunter_arts WHERE game_id='mhgu' AND is_placeholder=1").get().count
    value.hunterArtUnlocks=db.prepare("SELECT count(*) count FROM catalog_hunter_art_unlocks WHERE game_id='mhgu' AND evidence_status!='conflict'").get().count
    value.mhguExclusiveQuests=db.prepare("SELECT count(*) count FROM catalog_quests WHERE game_id='mhgu' AND availability='mhgu'").get().count
    value.conflictRows=db.prepare("SELECT count(*) count FROM catalog_hunter_art_unlocks WHERE game_id='mhgu' AND evidence_status='conflict'").get().count
    if(value.nativeRewards===0)throw new Error('mhgu: native quest rewards were not parsed')
    if(value.mhguExclusiveQuests!==49)throw new Error(`mhgu: expected 49 exclusive quests, received ${value.mhguExclusiveQuests}`)
    if(value.hunterArts!==178||value.hunterArtPlaceholders!==13||value.hunterArtUnlocks!==178)throw new Error(`mhgu: Hunter Art counts are invalid: ${JSON.stringify(value)}`)
    for(const[id,questKey]of verifiedHunterArtQuestPairs)if(!db.prepare("SELECT 1 FROM catalog_hunter_art_quest_refs WHERE game_id='mhgu' AND hunter_art_id=? AND quest_key=? AND evidence_status='verified'").get(id,questKey))throw new Error(`mhgu: verified Hunter Art ${id} is not linked to ${questKey}`)
  }
  const foreignKeys=db.pragma('foreign_key_check')
  if(foreignKeys.length)throw new Error(`${gameId}: foreign key validation failed`)
  db.close()
  results.push({gameId,...value})
}
const buildReport=JSON.parse(fs.readFileSync(path.join(dataRoot,'manifests/quest-catalog-build.json'),'utf8'))
if(buildReport.conflicts?.length!==1||buildReport.conflicts[0].key!=='through-thick-and-fin-hunter-art')throw new Error('Hunter Art source conflict was not retained in the private build audit')
console.log(JSON.stringify({format:'mh-save-edit-quest-catalog-audit-v1',results},null,2))
