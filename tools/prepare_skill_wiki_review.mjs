#!/usr/bin/env node
// Emits pending review documents. Never promotes candidates automatically.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {wikiRows,mapRows} from './map_skill_wiki.mjs'
const [dataRoot,outputRoot,...snapshots]=process.argv.slice(2)
if(!snapshots.length)throw new Error('Usage: node tools/prepare_skill_wiki_review.mjs DATA_ROOT NEW_OUTPUT_ROOT SNAPSHOT_JSON...')
if(fs.existsSync(outputRoot))throw new Error('Refusing to overwrite review work')
const sources=snapshots.flatMap(file=>wikiRows(JSON.parse(fs.readFileSync(file,'utf8'))))
fs.mkdirSync(outputRoot,{recursive:true})
for(const game of ['mh3g','mh4g','mhgu']){
 const db=new Database(path.join(dataRoot,`${game}.sqlite`),{readonly:true,fileMustExist:true})
 const acts=db.prepare('SELECT * FROM catalog_skill_activations WHERE game_id=? ORDER BY dex_activation_id').all(game);db.close()
 const mapped=mapRows(acts,sources)
 const entries=mapped.map(({activation:a,status,candidates})=>({
  gameId:game,activationKey:a.activation_key,skillId:a.skill_id,dexActivationId:a.dex_activation_id,
  threshold:a.threshold,nameJp:a.name_jp,nameCn:a.name_cn,specialMarker:a.special_marker,
  status:'pending',mappingStatus:status,descriptionCn:'',originalDescriptionCn:a.description_cn,
  candidates,reviewNote:'',
 }))
 fs.writeFileSync(path.join(outputRoot,`${game}.json`),JSON.stringify({format:'skill-wiki-reviewed-v1',entries},null,2)+'\n')
 // A compact source view permits bounded human/agent review; IDs are Dex IDs,
 // not source row indices. Multiple candidates retain separate source URLs.
 fs.writeFileSync(path.join(outputRoot,`${game}-sources.txt`),entries.map(e=>`${e.dexActivationId}\t${e.nameJp}\t${e.threshold}\n${e.candidates.map(c=>`${c.url}\n${c.effect}`).join('\n---\n')}\n`).join('\n'))
 console.log(game,entries.length,'pending; no reviewed entries generated')
}
