import type Database from 'better-sqlite3'
import { normalizeCatalogSearch } from './questRepository'
import type { P2gQuestData, P2gQuestCondition } from './p2gQuestTypes'
import type { QuestDetail, QuestSummary, QuestCatalogFilters, QuestCatalogFacets, PageResult, QuestSearchMatchKind, MonsterRelationTarget, QuestRelationTarget } from './types'

type Stored = Omit<QuestDetail, 'p2g'> & { monsterIds: number[]; locationNameJp: string; goalJp: string; p2g: Omit<P2gQuestData,'supplies'> }
type Row = { quest_key: string; detail_json: string }
const labels: Partial<Record<QuestSearchMatchKind,string>> = {name:'任务名称',id:'任务 ID',goal:'目标',map:'地图',monster:'出现怪物',reward:'报酬道具',supply:'支给道具',relatedQuest:'关联任务'}
export const hasP2gQuests = (db: Database.Database) => Boolean(db.prepare("SELECT 1 FROM meta WHERE key='quest_schema' AND value='mhp2g-quests-v1'").get())

export class P2gQuestCatalogRepository {
  constructor(private readonly db: Database.Database) {
    if(!hasP2gQuests(db))throw new Error('P2G 任务资料尚未安装，请构建并安装任务资料库后重启应用；道具和怪物图鉴仍可使用。')
  }
  resolveKey(key: string): string {
    return (this.db.prepare('SELECT quest_key FROM p2g_quest_aliases WHERE alias=?').get(key) as {quest_key:string}|undefined)?.quest_key ?? key
  }
  private rows(): Stored[] {
    return (this.db.prepare('SELECT detail_json FROM p2g_quests ORDER BY source_order').all() as Row[]).map(r=>JSON.parse(r.detail_json) as Stored)
  }
  searchQuests(filters: QuestCatalogFilters): PageResult<QuestSummary> {
    const page=filters.page??1,pageSize=Math.min(filters.pageSize??100,100),query=normalizeCatalogSearch(filters.query??'')
    const target=filters.targetQuestKey?this.resolveKey(filters.targetQuestKey):null
    const matches=new Map<string,{kind:QuestSearchMatchKind;label:string}>()
    if(query)for(const r of this.db.prepare('SELECT quest_key,kind,label FROM p2g_quest_search WHERE instr(normalized_text,?)>0 ORDER BY id').all(query) as {quest_key:string;kind:QuestSearchMatchKind;label:string}[])if(!matches.has(r.quest_key))matches.set(r.quest_key,r)
    const rows=filters.gameId!=='mhp2g'?[]:this.rows().filter(q=>target?q.questKey===target:
      (!query||matches.has(q.questKey))&&(!filters.system||q.systemKey===filters.system)&&(!filters.rank||q.rank===filters.rank)&&
      (!filters.keyStatus||q.keyStatus===filters.keyStatus)&&(filters.levelId==null||q.levelId===filters.levelId)&&
      (filters.questTypeId==null||q.questTypeId===filters.questTypeId)&&(filters.locationId==null||q.locationId===filters.locationId)&&
      (!filters.availability||filters.availability==='common'))
    return {items:rows.slice((page-1)*pageSize,page*pageSize).map(q=>{
      const hit=matches.get(q.questKey)
      return {gameId:'mhp2g',questKey:q.questKey,dexId:null,availability:'common',nameCn:q.nameCn,nameEn:'',
        levelId:q.levelId,levelNameCn:q.levelNameCn,systemKey:q.systemKey,systemNameCn:q.systemNameCn,rank:q.rank,star:q.star,
        questTypeId:q.questTypeId,questTypeNameCn:q.questTypeNameCn,locationId:q.locationId,locationNameCn:q.locationNameCn,
        goalCn:q.goalCn,keyStatus:q.keyStatus,isPlaceholder:false,match:hit?{kind:hit.kind,label:hit.label,reason:`命中：${labels[hit.kind]}·${hit.label}`}:null}
    }),page,pageSize,total:rows.length,hasNext:page*pageSize<rows.length}
  }
  private monster(mid: number): MonsterRelationTarget {
    const m=this.db.prepare('SELECT name_cn,name_jp,icon_path FROM catalog_monsters WHERE monster_id=?').get(mid) as {name_cn:string;name_jp:string;icon_path:string}
    return {gameId:'mhp2g',monsterId:mid,nameCn:m.name_cn,nameEn:m.name_jp,iconPath:m.icon_path}
  }
  private quest(key: string): QuestRelationTarget {
    const q=this.db.prepare('SELECT name_cn,name_jp FROM p2g_quests WHERE quest_key=?').get(key) as {name_cn:string;name_jp:string}
    return {gameId:'mhp2g',questKey:key,nameCn:q.name_cn,nameEn:q.name_jp}
  }
  private item(id: number) {
    const i=this.db.prepare('SELECT name_cn,name_jp FROM catalog_items WHERE item_id=?').get(id) as {name_cn:string;name_jp:string}
    return {gameId:'mhp2g' as const,itemId:id,nameCn:i.name_cn,nameEn:i.name_jp}
  }
  getQuest(key: string): QuestDetail | null {
    key=this.resolveKey(key)
    const row=this.db.prepare('SELECT detail_json FROM p2g_quests WHERE quest_key=?').get(key) as Row|undefined
    if(!row)return null
    const q=JSON.parse(row.detail_json) as Stored
    const itemRows=this.db.prepare('SELECT * FROM p2g_quest_items WHERE quest_key=? ORDER BY item_kind,ordinal').all(key) as {id:number;item_id:number;item_kind:string;group_key:string;quantity:number|null;probability:number|null;guaranteed:number|null}[]
    const rewards=itemRows.filter(r=>r.item_kind==='reward').map(r=>({id:r.id,groupKey:r.group_key,region:'',item:this.item(r.item_id),quantity:r.quantity,probability:r.probability,guaranteed:r.guaranteed==null?null:Boolean(r.guaranteed)}))
    const conditions=new Set<string>(),conditionMonsters=new Set<number>()
    const visit=(node:P2gQuestCondition)=>{if(node.questKey)conditions.add(node.questKey);for(const mid of node.monsterIds??[])conditionMonsters.add(mid);node.children?.forEach(visit)}
    visit(q.p2g.condition)
    const transitionIds=new Set<number>()
    for(const t of q.p2g.transitions){if(t.condition.itemId)transitionIds.add(t.condition.itemId);if(t.condition.monsterId)conditionMonsters.add(t.condition.monsterId)}
    const appearances=(this.db.prepare('SELECT monster_id,record_json FROM p2g_quest_legacy_monsters WHERE quest_key=? ORDER BY monster_id,ordinal').all(key) as {monster_id:number;record_json:string}[]).map(r=>{const record=JSON.parse(r.record_json) as {fields:{label:string;value:string}[];basis:string};return {monster:this.monster(r.monster_id),fields:record.fields,sourceNote:record.basis}})
    const relations=(this.db.prepare('SELECT * FROM p2g_quest_relations WHERE source_key=? OR target_key=? ORDER BY id').all(key,key) as {id:number;source_key:string;target_key:string;condition_text:string;operator:'all'|'any'}[]).map(r=>({id:r.id,direction:r.target_key===key?'prerequisite' as const:'unlocks' as const,operator:r.operator,
      quest:this.quest(r.target_key===key?r.source_key:r.target_key),sourceText:r.condition_text,evidenceStatus:'verified' as const}))
    return {...q,gameId:'mhp2g',dexId:null,availability:'common',nameEn:'',goalEn:q.goalJp,subGoalCn:'',subGoalEn:'',
      levelNameEn:'',questTypeNameEn:'',locationNameEn:q.locationNameJp,reward2:null,hrp2:null,
      monsters:q.monsterIds.map((mid,slot)=>({...this.monster(mid),slot,sourceKind:q.p2g.source})),modifiers:[],rewards,specialRewards:[],relations,
      p2g:{...q.p2g,appearances,conditionQuests:[...conditions].map(k=>this.quest(k)),conditionMonsters:[...conditionMonsters].map(mid=>this.monster(mid)),
        transitionItems:[...transitionIds].map(id=>this.item(id)),supplies:q.p2g.source==='wiki'?null:itemRows.filter(r=>r.item_kind==='supply').map(r=>({item:this.item(r.item_id),quantity:r.quantity!}))}}
  }
  getQuestFacets(): QuestCatalogFacets {
    const rows=this.rows()
    const distinct=<T>(values:T[],key:(v:T)=>string|number):T[]=>[...new Map(values.map(v=>[key(v),v])).values()]
    return {systems:distinct(rows.map(q=>({key:q.systemKey,nameCn:q.systemNameCn,keywords:{village:'村長 ネコート',guild:'集会所',training:'訓練所',treasure:'トレジャー',event:'イベント',challenge:'チャレンジ'}[q.systemKey]})),v=>v.key),
      levels:distinct(rows.map(q=>({id:q.levelId,nameCn:q.levelNameCn,keywords:`${{village:'村長 ネコート',guild:'集会所',training:'訓練所 個人 集団',treasure:'トレジャー',event:'イベント',challenge:'チャレンジ'}[q.systemKey]} ★${q.star??''} ${q.rank==='g'?'G級':''}`})),v=>v.id),ranks:distinct(rows.map(q=>q.rank),v=>v),
      questTypes:distinct(rows.map(q=>({id:q.questTypeId,nameCn:q.questTypeNameCn,keywords:{1:'討伐',2:'採集',4:'狩猟',5:'連続狩猟',16:'トレジャー',136:'特殊'}[q.questTypeId]})),v=>v.id),
      locations:distinct(rows.map(q=>({id:q.locationId,nameCn:q.locationNameCn,keywords:q.locationNameJp})),v=>v.id),availabilities:['common']}
  }
}
