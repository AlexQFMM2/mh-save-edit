import type Database from 'better-sqlite3'
import { hasP2gQuests } from './p2gQuestRepository'
import { normalizeCatalogSearch } from './questRepository'
import type { ItemRelation, P2gMonsterQuest } from './types'

export function questItemMatches(db: Database.Database, query?: string): Map<number,string> {
  const result=new Map<number,string>()
  if(!query?.trim()||!hasP2gQuests(db))return result
  const rows=db.prepare(`SELECT DISTINCT i.item_id,q.name_cn FROM p2g_quest_items i JOIN p2g_quests q USING(quest_key)
    JOIN p2g_quest_search s USING(quest_key) WHERE s.kind='name' AND instr(s.normalized_text,?)>0 ORDER BY q.source_order`).all(normalizeCatalogSearch(query)) as {item_id:number;name_cn:string}[]
  for(const row of rows)if(!result.has(row.item_id))result.set(row.item_id,row.name_cn)
  return result
}
export function questItemRelations(db: Database.Database,itemId:number):ItemRelation[] {
  if(!hasP2gQuests(db))return []
  const rows=db.prepare(`SELECT i.*,q.name_cn,q.name_jp,q.detail_json FROM p2g_quest_items i JOIN p2g_quests q USING(quest_key)
    WHERE i.item_id=? ORDER BY q.source_order,i.item_kind,i.ordinal`).all(itemId) as {
      id:number;quest_key:string;name_cn:string;name_jp:string;detail_json:string;item_kind:string;group_key:string;
      quantity:number|null;probability:number|null;guaranteed:number|null
    }[]
  return rows.map(r=>{
    const detail=JSON.parse(r.detail_json) as {p2g:{source:string;rewardGroups:{key:string;label:string}[]}}
    const group=detail.p2g.rewardGroups.find(g=>g.key===r.group_key)?.label
    return {id:-r.id,sourceKind:'quest',usageKind:null,targetId:null,targetName:r.name_cn,quantity:r.quantity,probability:r.probability,rank:null,relatedItems:[],
      relatedQuest:{gameId:'mhp2g',questKey:r.quest_key,nameCn:r.name_cn,nameEn:r.name_jp},
      metadata:{details:r.item_kind==='supply'?'支给品配置':`${group??'报酬'}${r.guaranteed?' · 首项保证':''}${detail.p2g.source==='native'?' · 每抽权重':''}`,
        sourceKey:`${r.quest_key}:${r.item_kind}:${r.id}`,evidence:detail.p2g.source==='native'?'P2G 原生任务':'P2G Wiki'}}
  })
}
export function monsterQuestReferences(db:Database.Database,monsterId:number,fallback:P2gMonsterQuest[]):P2gMonsterQuest[] {
  if(!hasP2gQuests(db))return fallback
  const legacy=db.prepare(`SELECT l.*,q.name_cn FROM p2g_quest_legacy_monsters l LEFT JOIN p2g_quests q USING(quest_key)
    WHERE monster_id=? ORDER BY ordinal`).all(monsterId) as {source_key:string;quest_key:string|null;name_cn:string|null;record_json:string}[]
  const result=legacy.map(r=>{
    const record=JSON.parse(r.record_json) as {nameJp:string;fields:P2gMonsterQuest['fields'];basis:string}
    return {questKey:r.quest_key??r.source_key,sourceKey:r.source_key,nameCn:r.name_cn??undefined,nameJp:record.nameJp,fields:record.fields,sourceNote:record.basis,linked:r.quest_key!=null}
  })
  const seen=new Set(result.map(r=>r.questKey))
  const native=db.prepare(`SELECT q.* FROM p2g_quest_monsters m JOIN p2g_quests q USING(quest_key) WHERE monster_id=? ORDER BY source_order`).all(monsterId) as {quest_key:string;name_cn:string;name_jp:string;detail_json:string}[]
  for(const q of native)if(!seen.has(q.quest_key)) {
    const detail=JSON.parse(q.detail_json) as {levelNameCn:string;p2g:{source:string}}
    result.push({questKey:q.quest_key,sourceKey:q.quest_key,nameCn:q.name_cn,nameJp:q.name_jp,fields:[{label:'区分',value:detail.levelNameCn}],
      sourceNote:detail.p2g.source==='native'?'原生任务配置；个体体力等 Wiki 数值未收录':'Wiki 主要怪物；个体数值未收录',linked:true})
  }
  return result
}
