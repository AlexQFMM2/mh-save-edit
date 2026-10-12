import type Database from 'better-sqlite3'
import { normalizeCatalogSearch } from './questRepository'
export function hasP2gDecorations(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM meta WHERE key='decoration_schema' AND value='mhp2g-decorations-v1'").get())
}
export function decorationItemMatches(db: Database.Database, query?: string): Map<number,string> {
  const matches=new Map<number,string>()
  if(!query?.trim()||!hasP2gDecorations(db))return matches
  const q=normalizeCatalogSearch(query)
  const rows=db.prepare(`SELECT r.item_id,i.name_cn,i.name_jp FROM p2g_decoration_materials m
    JOIN catalog_item_relations r ON r.id=m.relation_id JOIN catalog_items i ON i.item_id=m.decoration_item_id ORDER BY i.item_id,m.relation_id`).all() as {item_id:number;name_cn:string;name_jp:string}[]
  for(const r of rows)if(normalizeCatalogSearch(`${r.name_cn} ${r.name_jp}`).includes(q)&&!matches.has(r.item_id))matches.set(r.item_id,r.name_cn)
  return matches
}
export function decorationUsageTargets(db: Database.Database): Map<number,{gameId:'mhp2g';itemId:number;nameCn:string}> {
  if(!hasP2gDecorations(db))return new Map()
  const rows=db.prepare(`SELECT m.relation_id,i.item_id,i.name_cn FROM p2g_decoration_materials m JOIN catalog_items i ON i.item_id=m.decoration_item_id`).all() as {relation_id:number;item_id:number;name_cn:string}[]
  return new Map(rows.map(r=>[r.relation_id,{gameId:'mhp2g',itemId:r.item_id,nameCn:r.name_cn}]))
}
