import type Database from 'better-sqlite3'
import type { GameId } from '../core/loadout'
import { MonsterCatalogRepository } from './monsterRepository'
import type {
  EvidenceStatus, HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtDetail, HunterArtIdentity,
  HunterArtSummary, HunterArtUnlock, HunterArtUnlockCondition, HunterArtUnlockKind, PageResult,
  QuestCatalogFacets, QuestCatalogFilters, QuestDetail, QuestIdentity, QuestKeyStatus, QuestRank,
  QuestRelation, QuestReward, QuestSearchMatch, QuestSearchMatchKind, QuestSpecialReward, QuestSummary,
} from './types'

type Row = Record<string, unknown>
const int = (value: unknown): number => Number(value)
const nullableInt = (value: unknown): number | null => value == null ? null : Number(value)
const bool = (value: unknown): boolean => value === 1 || value === true || value === '1'

export function normalizeCatalogSearch(value: string): string {
  return value.trim().replace(/^狩技\s*[：:]\s*/u, '')
    .replace(/Ⅲ/gu, '3').replace(/Ⅱ/gu, '2').replace(/Ⅰ/gu, '1')
    .replace(/\bIII\b/giu, '3').replace(/\bII\b/giu, '2').replace(/\bI\b/giu, '1')
    .normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]+/gu, '')
}

const matchReasons: Record<QuestSearchMatchKind, string> = {
  name: '任务名称', id: '任务 ID', goal: '主目标', subGoal: '副目标', map: '地图', monster: '出现怪物',
  reward: '报酬道具', supply: '支给道具', hunterArt: '解锁狩技', special: '特殊奖励', relatedQuest: '关联任务',
}

const hunterArtMatchReasons: Record<string, string> = {
  name: '狩技名称',
  id: '狩技 ID',
  quest: '解锁任务',
  description: '狩技说明',
  weapon: '武器类型',
  unlock: '解锁条件',
}

export class QuestCatalogRepository {
  private readonly monsters: MonsterCatalogRepository
  constructor(private readonly db: Database.Database) { this.monsters = new MonsterCatalogRepository(db) }

  searchQuests(filters: QuestCatalogFilters): PageResult<QuestSummary> {
    const page = filters.page ?? 1; const pageSize = Math.min(filters.pageSize ?? 100, 100)
    const where = ['q.game_id=?']; const values: unknown[] = [filters.gameId]
    if (filters.targetQuestKey) { where.push('q.quest_key=?'); values.push(filters.targetQuestKey) }
    else {
      if (!filters.includePlaceholders) where.push('q.is_placeholder=0')
      for (const [field,value] of [['q.system_key',filters.system],['q.rank_key',filters.rank],['q.key_status',filters.keyStatus],['q.availability',filters.availability]] as const) if (value !== undefined) { where.push(`${field}=?`); values.push(value) }
      for (const [field,value] of [['q.level_id',filters.levelId],['q.quest_type_id',filters.questTypeId],['q.location_id',filters.locationId]] as const) if (value != null) { where.push(`${field}=?`); values.push(value) }
      const query = filters.query ? normalizeCatalogSearch(filters.query) : ''
      if (query) { where.push('q.quest_key IN (SELECT st.quest_key FROM catalog_quest_search_terms st WHERE st.game_id=? AND st.normalized_text LIKE ?)'); values.push(filters.gameId,`%${query}%`) }
    }
    const clause = where.join(' AND ')
    const total = int((this.db.prepare(`SELECT count(*) count FROM catalog_quests q WHERE ${clause}`).get(...values) as Row).count)
    const rows = this.db.prepare(`SELECT q.* FROM catalog_quests q WHERE ${clause} ORDER BY q.source_order,q.quest_key LIMIT ? OFFSET ?`).all(...values,pageSize,(page-1)*pageSize) as Row[]
    const query = filters.query ? normalizeCatalogSearch(filters.query) : ''
    return { items: rows.map(row=>this.toSummary(row,query)), page, pageSize, total, hasNext: page*pageSize<total }
  }

  getQuest(identity: QuestIdentity): QuestDetail | null {
    if(identity.gameId==='mhp2g')return null
    const base = this.monsters.getQuest(identity)
    if (!base) return null
    const row = this.db.prepare('SELECT * FROM catalog_quests WHERE game_id=? AND quest_key=?').get(identity.gameId,identity.questKey) as Row
    const rewards = (this.db.prepare('SELECT * FROM catalog_quest_rewards WHERE game_id=? AND quest_key=? ORDER BY group_key,probability DESC,row_id').all(identity.gameId,identity.questKey) as Row[]).map((value):QuestReward=>({id:int(value.row_id),groupKey:String(value.group_key),region:String(value.region),item:{gameId:identity.gameId as GameId,saveId:int(value.item_save_id),nameCn:String(value.item_name_cn),nameEn:String(value.item_name_en)},quantity:int(value.quantity),probability:Number(value.probability)*100}))
    const specialRewards = (this.db.prepare(`SELECT s.*,a.name_cn art_name_cn,a.name_en art_name_en FROM catalog_quest_special_rewards s LEFT JOIN catalog_hunter_arts a ON a.game_id=s.game_id AND a.hunter_art_id=s.hunter_art_id WHERE s.game_id=? AND s.quest_key=? AND s.evidence_status!='conflict' ORDER BY s.row_id`).all(identity.gameId,identity.questKey) as Row[]).map((value):QuestSpecialReward=>({id:int(value.row_id),kind:String(value.reward_kind),nameCn:String(value.name_cn),nameEn:String(value.name_en),nameJp:String(value.name_jp),hunterArt:value.hunter_art_id==null?null:{hunterArtId:int(value.hunter_art_id),nameCn:String(value.art_name_cn),nameEn:String(value.art_name_en)},evidenceStatus:String(value.evidence_status) as EvidenceStatus}))
    const relations = this.relations(identity)
    return {...base,keyStatus:String(row.key_status) as QuestKeyStatus,systemKey:String(row.system_key),systemNameCn:String(row.system_name_cn),rank:String(row.rank_key) as QuestRank,star:nullableInt(row.star),rewards,specialRewards,relations}
  }

  getQuestFacets(gameId: GameId): QuestCatalogFacets {
    const pairs=(sql:string,key:string,name:string)=>(this.db.prepare(sql).all(gameId) as Row[]).map(row=>({key:String(row[key]),nameCn:String(row[name])}))
    return {
      systems:pairs('SELECT system_key,system_name_cn FROM catalog_quests WHERE game_id=? GROUP BY system_key,system_name_cn ORDER BY min(source_order)','system_key','system_name_cn'),
      levels:(this.db.prepare('SELECT level_id id,level_name_cn name FROM catalog_quests WHERE game_id=? GROUP BY level_id,level_name_cn ORDER BY min(source_order)').all(gameId) as Row[]).map(row=>({id:int(row.id),nameCn:String(row.name)})),
      ranks:(this.db.prepare('SELECT rank_key value FROM catalog_quests WHERE game_id=? GROUP BY rank_key ORDER BY min(source_order)').all(gameId) as Row[]).map(row=>String(row.value) as QuestRank),
      questTypes:(this.db.prepare('SELECT quest_type_id id,quest_type_name_cn name FROM catalog_quests WHERE game_id=? GROUP BY quest_type_id,quest_type_name_cn ORDER BY quest_type_id').all(gameId) as Row[]).map(row=>({id:int(row.id),nameCn:String(row.name)})),
      locations:(this.db.prepare('SELECT location_id id,location_name_cn name FROM catalog_quests WHERE game_id=? GROUP BY location_id,location_name_cn ORDER BY name').all(gameId) as Row[]).map(row=>({id:int(row.id),nameCn:String(row.name)})),
      availabilities:(this.db.prepare('SELECT availability FROM catalog_quests WHERE game_id=? GROUP BY availability ORDER BY availability').all(gameId) as Row[]).map(row=>String(row.availability) as QuestCatalogFacets['availabilities'][number]),
    }
  }

  private toSummary(row:Row,query:string):QuestSummary {
    let match:QuestSearchMatch|null=null
    if(query){const term=this.db.prepare('SELECT term_kind,label FROM catalog_quest_search_terms WHERE game_id=? AND quest_key=? AND normalized_text LIKE ? ORDER BY CASE term_kind WHEN \'name\' THEN 0 WHEN \'id\' THEN 1 WHEN \'hunterArt\' THEN 2 WHEN \'reward\' THEN 3 ELSE 4 END,row_id LIMIT 1').get(row.game_id,row.quest_key,`%${query}%`) as Row|undefined;if(term){const kind=String(term.term_kind) as QuestSearchMatchKind;match={kind,label:String(term.label),reason:`命中：${matchReasons[kind]}·${String(term.label)}`}}}
    return {gameId:String(row.game_id) as GameId,questKey:String(row.quest_key),dexId:nullableInt(row.dex_id),availability:String(row.availability) as QuestSummary['availability'],nameCn:String(row.name_cn),nameEn:String(row.name_en),levelId:int(row.level_id),levelNameCn:String(row.level_name_cn),systemKey:String(row.system_key),systemNameCn:String(row.system_name_cn),rank:String(row.rank_key) as QuestRank,star:nullableInt(row.star),questTypeId:int(row.quest_type_id),questTypeNameCn:String(row.quest_type_name_cn),locationId:int(row.location_id),locationNameCn:String(row.location_name_cn),goalCn:String(row.goal_cn),keyStatus:String(row.key_status) as QuestKeyStatus,isPlaceholder:bool(row.is_placeholder),match}
  }

  private relations(identity:QuestIdentity):QuestRelation[]{
    const rows=this.db.prepare(`SELECT r.*,CASE WHEN r.target_quest_key=? THEN 'prerequisite' ELSE 'unlocks' END direction,q.quest_key related_key,q.name_cn,q.name_en FROM catalog_quest_relations r JOIN catalog_quests q ON q.game_id=r.game_id AND q.quest_key=CASE WHEN r.target_quest_key=? THEN r.source_quest_key ELSE r.target_quest_key END WHERE r.game_id=? AND (r.source_quest_key=? OR r.target_quest_key=?) AND r.evidence_status!='conflict' ORDER BY r.group_key,r.row_id`).all(identity.questKey,identity.questKey,identity.gameId,identity.questKey,identity.questKey) as Row[]
    return rows.map(row=>({id:int(row.row_id),direction:String(row.direction) as QuestRelation['direction'],operator:String(row.condition_operator) as QuestRelation['operator'],quest:{gameId:identity.gameId,questKey:String(row.related_key),nameCn:String(row.name_cn),nameEn:String(row.name_en)},sourceText:String(row.source_text),evidenceStatus:String(row.evidence_status) as EvidenceStatus}))
  }
}

export class HunterArtCatalogRepository {
  constructor(private readonly db: Database.Database) {}
  searchHunterArts(filters:HunterArtCatalogFilters):HunterArtSummary[]{
    if(filters.gameId!=='mhgu') return []
    const where=['a.game_id=\'mhgu\''];const values:unknown[]=[]
    if(filters.targetHunterArtId!=null){where.push('a.hunter_art_id=?');values.push(filters.targetHunterArtId)}else{
      if(!filters.includePlaceholders)where.push('a.is_placeholder=0')
      if(filters.weaponTypeId!=null){where.push('a.weapon_type_id=?');values.push(filters.weaponTypeId)}
      if(filters.level==='none')where.push('a.level IS NULL');else if(filters.level!=null){where.push('a.level=?');values.push(filters.level)}
      if(filters.unlockKind){where.push('u.unlock_kind=?');values.push(filters.unlockKind)}
      const query=filters.query?normalizeCatalogSearch(filters.query):'';if(query){where.push("a.hunter_art_id IN (SELECT st.hunter_art_id FROM catalog_hunter_art_search_terms st WHERE st.game_id='mhgu' AND st.normalized_text LIKE ?)");values.push(`%${query}%`)}
    }
    const query=filters.query?normalizeCatalogSearch(filters.query):''
    return (this.db.prepare(`SELECT a.*,u.unlock_kind FROM catalog_hunter_arts a LEFT JOIN catalog_hunter_art_unlocks u USING(game_id,hunter_art_id) WHERE ${where.join(' AND ')} ORDER BY a.hunter_art_id LIMIT 200`).all(...values) as Row[]).map(row=>this.toSummary(row,query))
  }
  getHunterArt(identity:HunterArtIdentity):HunterArtDetail|null{
    const row=this.db.prepare(`SELECT a.*,u.unlock_kind FROM catalog_hunter_arts a LEFT JOIN catalog_hunter_art_unlocks u USING(game_id,hunter_art_id) WHERE a.game_id=? AND a.hunter_art_id=?`).get(identity.gameId,identity.hunterArtId) as Row|undefined;if(!row)return null
    const unlocks=(this.db.prepare("SELECT * FROM catalog_hunter_art_unlocks WHERE game_id=? AND hunter_art_id=? AND evidence_status!='conflict' ORDER BY row_id").all(identity.gameId,identity.hunterArtId) as Row[]).map((value):HunterArtUnlock=>({id:int(value.row_id),kind:String(value.unlock_kind) as HunterArtUnlockKind,condition:JSON.parse(String(value.condition_json)) as HunterArtUnlockCondition,sourceText:String(value.source_text),evidenceStatus:String(value.evidence_status) as EvidenceStatus,sourceTitle:String(value.source_title),sourceRevision:int(value.source_revision)}))
    const quests=(this.db.prepare(`SELECT r.*,q.name_cn,q.name_en FROM catalog_hunter_art_quest_refs r JOIN catalog_quests q USING(game_id,quest_key) WHERE r.game_id=? AND r.hunter_art_id=? AND r.evidence_status!='conflict' ORDER BY r.relation_order`).all(identity.gameId,identity.hunterArtId) as Row[]).map(value=>({gameId:identity.gameId,questKey:String(value.quest_key),nameCn:String(value.name_cn),nameEn:String(value.name_en),relationOrder:int(value.relation_order),operator:String(value.condition_operator) as 'all'|'any',afterNpcConversation:bool(value.after_npc_conversation),evidenceStatus:String(value.evidence_status) as EvidenceStatus}))
    return {...this.toSummary(row,''),shortDescriptionCn:String(row.short_description_cn),longDescriptionCn:String(row.long_description_cn),shortDescriptionEn:String(row.short_description_en),longDescriptionEn:String(row.long_description_en),shortDescriptionJp:String(row.short_description_jp),longDescriptionJp:String(row.long_description_jp),unlocks,quests}
  }
  getHunterArtFacets(gameId:GameId):HunterArtCatalogFacets{
    if(gameId!=='mhgu')return{weaponTypes:[],levels:[],unlockKinds:[]}
    return{weaponTypes:(this.db.prepare("SELECT weapon_type_id id,weapon_type_name_cn cn,weapon_type_name_en en FROM catalog_hunter_arts WHERE game_id='mhgu' AND is_placeholder=0 GROUP BY weapon_type_id,weapon_type_name_cn,weapon_type_name_en ORDER BY min(hunter_art_id)").all() as Row[]).map(r=>({id:int(r.id),nameCn:String(r.cn),nameEn:String(r.en)})),levels:(this.db.prepare("SELECT level FROM catalog_hunter_arts WHERE game_id='mhgu' AND is_placeholder=0 AND level IS NOT NULL GROUP BY level ORDER BY level").all() as Row[]).map(r=>int(r.level)),unlockKinds:(this.db.prepare("SELECT unlock_kind FROM catalog_hunter_art_unlocks WHERE game_id='mhgu' AND evidence_status!='conflict' GROUP BY unlock_kind ORDER BY min(row_id)").all() as Row[]).map(r=>String(r.unlock_kind) as HunterArtUnlockKind)}
  }
  private toSummary(row:Row,query:string):HunterArtSummary{
    let match:HunterArtSummary['match']=null;if(query){const term=this.db.prepare('SELECT term_kind,label FROM catalog_hunter_art_search_terms WHERE game_id=? AND hunter_art_id=? AND normalized_text LIKE ? ORDER BY CASE term_kind WHEN \'name\' THEN 0 WHEN \'id\' THEN 1 ELSE 2 END,row_id LIMIT 1').get(row.game_id,row.hunter_art_id,`%${query}%`) as Row|undefined;if(term){const kind=String(term.term_kind);const label=String(term.label);match={kind,label,reason:`命中：${hunterArtMatchReasons[kind] ?? '狩技资料'}·${label}`}}}
    return{gameId:'mhgu',hunterArtId:int(row.hunter_art_id),nameCn:String(row.name_cn),nameEn:String(row.name_en),nameJp:String(row.name_jp),weaponTypeId:int(row.weapon_type_id),weaponTypeNameCn:String(row.weapon_type_name_cn),weaponTypeNameEn:String(row.weapon_type_name_en),level:nullableInt(row.level),contentVariant:'common',isPlaceholder:bool(row.is_placeholder),unlockKind:row.unlock_kind==null?null:String(row.unlock_kind) as HunterArtUnlockKind,match}
  }
}
