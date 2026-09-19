#!/usr/bin/env node
// Read-only mapping audit; no fuzzy names, row-number IDs or runtime writes.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import {pathToFileURL} from 'node:url'
export const normalizeSkillName = value => String(value ?? '').normalize('NFKC').replace(/[\s\[\]【】・･]/gu,'').toLowerCase()
export function wikiRows(snapshot) {
  const result=[]
  for (const source of snapshot.records) {
    if(source.error) throw new Error(`Incomplete source: ${source.url}`)
    for(const table of source.tables) for(const cells of table.rows) {
      const chinese=table.header.some(h => h.includes('系统（日）'))
      const compact=!chinese && table.header.length===4
      const name=cells[chinese?3:compact?1:2] ?? ''
      const point=cells[chinese?2:compact?2:3] ?? ''
      const threshold=/^[+-]?\d+$/.test(point.trim())?Number(point):null
      result.push({game:source.game,version:source.version,nameJp:name,nameCn:chinese?cells[4]:null,treeJp:(cells[chinese||compact?0:1]??'').split('\n')[0].trim(),threshold,point,effect:cells[chinese?5:compact?3:4]??'',url:source.url,sha256:source.sha256})
    }
  }
  return result
}
export function mapRows(activations, rows) {
  return activations.map(activation=>{
    const candidates=rows.filter(row=>row.game===activation.game_id && row.threshold===activation.threshold && normalizeSkillName(row.nameJp)===normalizeSkillName(activation.name_jp))
    return {activation, status:candidates.length===1?'matched':candidates.length?'ambiguous':'unmatched',candidates}
  })
}
function main(){
  const [snapshotFile,dataRoot,outFile]=process.argv.slice(2)
  if(!outFile)throw new Error('Usage: node tools/map_skill_wiki.mjs SNAPSHOT_JSON DATA_ROOT NEW_REPORT_JSON')
  if(fs.existsSync(outFile))throw new Error('Refusing to overwrite mapping report')
  const snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8'))
  for(const record of snapshot.records){
    if(record.error)throw new Error(record.error)
    const bytes=fs.readFileSync(path.join(path.dirname(snapshotFile),record.file))
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error(`Source digest mismatch: ${record.file}`)
  }
  const rows=wikiRows(snapshot),games=[]
  for(const game of ['mh3g','mh4g','mhgu']){
    const db=new Database(path.join(dataRoot,`${game}.sqlite`),{readonly:true,fileMustExist:true})
    const activations=db.prepare('SELECT a.*,s.name_jp tree_jp FROM catalog_skill_activations a JOIN catalog_skills s ON a.game_id=s.game_id AND a.skill_id=s.skill_id WHERE a.game_id=? ORDER BY a.dex_activation_id').all(game)
    db.close()
    const mapped=mapRows(activations,rows)
    const counts=Object.fromEntries(['matched','unmatched','ambiguous'].map(s=>[s,mapped.filter(r=>r.status===s).length]))
    games.push({game,counts,mapped})
    console.log(game,JSON.stringify(counts))
    for(const m of mapped.filter(m=>m.status!=='matched')) console.log(' ',m.activation.dex_activation_id,m.activation.name_jp,m.activation.threshold,m.status)
  }
  fs.writeFileSync(outFile,JSON.stringify({format:'skill-wiki-mapping-v1',snapshot:path.resolve(snapshotFile),games},null,2)+'\n')
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
