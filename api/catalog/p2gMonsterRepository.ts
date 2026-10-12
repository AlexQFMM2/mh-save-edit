import { monsterQuestReferences } from './p2gQuestLinks'
import { normalizeCatalogSearch } from './questRepository'
import type Database from 'better-sqlite3'
import type { MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterDrop, MonsterSummary, MonsterWeakness, MonsterAilment, MonsterTrap, P2gMonsterQuest } from './types'

type Row = { monster_id:number; name_cn:string; name_jp:string; name_en:string; icon_path:string; detail_json:string; aliases:string }
const summary = (row:Row):MonsterSummary => ({ gameId:'mhp2g',monsterId:row.monster_id,nameCn:row.name_cn,
  nameJp:row.name_jp,nameEn:row.name_en,iconSmallPath:row.icon_path,iconLargePath:row.icon_path,isPlaceholder:false })

export class P2gMonsterCatalogRepository {
  constructor(private readonly db:Database.Database) {
    const version=db.prepare("SELECT value FROM meta WHERE key='monster_schema'").get() as {value:string}|undefined
    if(version?.value!=='mhp2g-monsters-v1')throw new Error('P2G 怪物资料尚未安装，请按 README 构建并安装怪物资料库。')
  }
  searchMonsters(filters:MonsterCatalogFilters):MonsterSummary[] {
    const rows = this.db.prepare('SELECT * FROM catalog_monsters ORDER BY monster_id').all() as Row[]
    if(filters.targetMonsterId!=null)return rows.filter(r=>r.monster_id===filters.targetMonsterId).map(summary)
    const query=filters.query?.trim().toLocaleLowerCase()
    if(!query)return rows.map(summary)
    const numeric=/^0x[0-9a-f]+$/i.test(query)?parseInt(query.slice(2),16):/^\d+$/.test(query)?Number(query):-1
    const itemMatches = new Map<number,string>()
    for(const item of this.db.prepare(`SELECT d.monster_id,i.name_cn FROM catalog_monster_drops d JOIN catalog_items i USING(item_id)
      WHERE instr(lower(i.name_cn),?)>0 OR instr(lower(i.name_jp),?)>0 OR instr(lower(i.name_en),?)>0 ORDER BY d.id`).all(query,query,query) as {monster_id:number;name_cn:string}[]){
      if(!itemMatches.has(item.monster_id))itemMatches.set(item.monster_id,item.name_cn)
    }
    return rows.flatMap(row=>{
      const names=[row.name_cn,row.name_jp,row.name_en,...JSON.parse(row.aliases) as string[]]
      if(row.monster_id===numeric||names.some(name=>name.toLocaleLowerCase().includes(query)))return [summary(row)]
      const item=itemMatches.get(row.monster_id)
      if(item)return [{...summary(row),matchReason:`命中：掉落道具·${item}`}]
      const detail=JSON.parse(row.detail_json) as {p2gQuests:P2gMonsterQuest[]}
      const quest=monsterQuestReferences(this.db,row.monster_id,detail.p2gQuests).find(q=>[q.nameCn??'',q.nameJp].some(n=>normalizeCatalogSearch(n).includes(normalizeCatalogSearch(query))))
      return quest?[{...summary(row),matchReason:`命中：出没任务·${quest.nameCn??quest.nameJp}`}]:[]
    })
  }

  getMonster(monsterId:number):MonsterDetail|null {
    const row=this.db.prepare('SELECT * FROM catalog_monsters WHERE monster_id=?').get(monsterId) as Row|undefined
    if(!row)return null
    const stored=JSON.parse(row.detail_json) as {
      weakness: (MonsterWeakness & {partOrdinal:number})[]
      ailments: MonsterAilment[]; traps: MonsterTrap[]; p2gQuests: P2gMonsterQuest[]
    }
    const drops=(this.db.prepare(`SELECT d.*,i.name_cn,i.name_en FROM catalog_monster_drops d JOIN catalog_items i USING(item_id) WHERE d.monster_id=? ORDER BY d.rank_id,d.method_id,d.probability DESC,d.id`).all(monsterId) as {
      id:number;item_id:number;rank_id:number;rank_name_cn:string;method_id:number;method_name_cn:string;quantity:number|null;probability:number;name_cn:string;name_en:string
    }[]).map((r):MonsterDrop=>({id:r.id,rankId:r.rank_id,rankNameCn:r.rank_name_cn,rankNameEn:'',methodId:r.method_id,methodNameCn:r.method_name_cn,methodNameEn:'',
      item:{gameId:'mhp2g',itemId:r.item_id,nameCn:r.name_cn,nameEn:r.name_en},quantity:r.quantity,probability:r.probability}))
    return {...summary(row),weakness:stored.weakness.map((r,id)=>({id,partId:r.partOrdinal,partOrder:id,partNameCn:r.partNameCn,partNameEn:'',conditionCn:r.conditionCn,conditionEn:'',
        cut:r.cut,impact:r.impact,shot:r.shot,fire:r.fire,water:r.water,thunder:r.thunder,ice:r.ice,dragon:r.dragon,stun:r.stun})),
      ailments:stored.ailments.map((r,id)=>({id,statusId:r.statusId,nameCn:r.nameCn,nameEn:r.nameEn,toleranceInitial:r.toleranceInitial,
        toleranceIncrease:r.toleranceIncrease,toleranceMax:r.toleranceMax,duration:r.duration,damage:r.damage,applicable:r.applicable})),
      traps:stored.traps.map((r,id)=>({id,trapId:r.trapId,nameCn:r.nameCn,nameEn:r.nameEn,isEffective:r.isEffective,
        duration:r.duration,durationEnraged:r.durationEnraged,durationFatigued:null,noteJp:r.noteJp})),drops,quests:[],
      p2gQuests:monsterQuestReferences(this.db,monsterId,stored.p2gQuests.map(q=>({questKey:q.questKey,nameJp:q.nameJp,fields:q.fields.map(f=>({label:f.label,value:f.value}))})))}
  }
  getMonsterFacets():MonsterCatalogFacets {
    const count=this.db.prepare('SELECT count(*) AS n FROM catalog_monsters').get() as {n:number}
    return {monsterCount:count.n,statusNames:[],trapNames:[],questAvailabilities:[]}
  }
}
