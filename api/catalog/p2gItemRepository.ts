import { questItemMatches, questItemRelations } from './p2gQuestLinks'
import { hasP2gQuests } from './p2gQuestRepository'
import type Database from 'better-sqlite3'
import type { ItemTermRepository } from '../terminology/itemTermRepository'
import type { CatalogItemDetail, CatalogItemSummary, ItemCatalogFilters, ItemRelation, PageResult, P2gItemIdentity } from './types'

type Row = Record<string, any>
const requiredColumns: Record<string, string[]> = {
  catalog_items: ['game_id','item_id','save_id','dex_id','name_cn','name_en','name_jp','description','rarity','max_stack','buy_price','sell_price','icon_path','is_placeholder','mapping_status'],
  catalog_item_relations: ['id','source_key','item_id','source_kind','usage_kind','target_name','quantity','probability','metadata','pending_target'],
  catalog_item_relation_targets: ['relation_id','position','item_id'],
}
export class P2gItemCatalogRepository {
  private readonly localized: boolean
  private readonly monsters: boolean
  constructor(private readonly db: Database.Database, private readonly terminology?: ItemTermRepository) {
    const meta = db.prepare("SELECT value FROM meta WHERE key='catalog_schema'").get() as Row | undefined
    if (meta?.value !== 'mhp2g-items-v1') throw new Error('P2G 道具资料库版本不匹配，请重新构建。')
    for (const [table, names] of Object.entries(requiredColumns)) {
      const columns = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Row[]).map(row => row.name))
      if (names.some(name => !columns.has(name))) throw new Error(`P2G 道具资料库缺少字段：${table}`)
    }
    this.localized = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_item_localization' AND type='table'").get())
    this.monsters = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_monster_drops' AND type='table'").get())
    terminology?.bindCatalog(db, 'mhp2g')
  }
  searchItems(filters: ItemCatalogFilters): PageResult<CatalogItemSummary> {
    const values: unknown[] = [], where = ['1=1']
    if (filters.targetItemId != null) { where.push('item_id=?'); values.push(filters.targetItemId) }
    if (!filters.includePlaceholders) where.push('is_placeholder=0')
    const matches = this.terminology?.matchItems('mhp2g', filters.query) ?? new Map<number, string>()
    const taskMatches = questItemMatches(this.db, filters.query)
    const monsterMatches = new Map<number, string>()
    if (this.monsters && filters.query?.trim()) {
      const query = filters.query.trim().toLowerCase()
      const rows = this.db.prepare(`SELECT DISTINCT d.item_id,m.name_cn FROM catalog_monster_drops d JOIN catalog_monsters m USING(monster_id)
        WHERE instr(lower(m.name_cn),?)>0 OR instr(lower(m.name_jp),?)>0 OR instr(lower(m.name_en),?)>0
        OR EXISTS(SELECT 1 FROM json_each(m.aliases) WHERE instr(lower(value),?)>0) ORDER BY m.monster_id`).all(query,query,query,query) as Row[]
      for (const row of rows) if (!monsterMatches.has(row.item_id)) monsterMatches.set(row.item_id, row.name_cn)
    }
    if (filters.query?.trim()) {
      const alias = this.localized ? ' OR item_id IN (SELECT item_id FROM catalog_item_localization WHERE instr(original_name,?)>0)' : ''
      where.push(`(name_cn LIKE ? OR name_jp LIKE ? OR CAST(item_id AS TEXT)=? OR item_id IN (SELECT value FROM json_each(?)) OR item_id IN (SELECT value FROM json_each(?)) OR item_id IN (SELECT value FROM json_each(?))${alias})`)
      values.push(`%${filters.query.trim()}%`, `%${filters.query.trim()}%`, filters.query.trim(), JSON.stringify([...matches.keys()]), JSON.stringify([...monsterMatches.keys()]), JSON.stringify([...taskMatches.keys()]))
      if (this.localized) values.push(filters.query.trim())
    }
    if (filters.rarity != null) { where.push('rarity=?'); values.push(filters.rarity) }
    if (filters.maxStack != null) { where.push('max_stack=?'); values.push(filters.maxStack) }
    const kinds = [...(filters.sourceKinds ?? []), ...(filters.usageKinds ?? [])]
    if (kinds.length) { where.push(`(EXISTS(SELECT 1 FROM catalog_item_relations r WHERE r.item_id=catalog_items.item_id AND r.source_kind IN (${kinds.map(()=>'?').join(',')}))${kinds.includes('quest') && hasP2gQuests(this.db) ? ' OR EXISTS(SELECT 1 FROM p2g_quest_items qi WHERE qi.item_id=catalog_items.item_id)' : ''})`); values.push(...kinds) }
    const condition = where.join(' AND '), page = filters.page ?? 1, pageSize = Math.min(filters.pageSize ?? 100, 100)
    const total = (this.db.prepare(`SELECT count(*) AS total FROM catalog_items WHERE ${condition}`).get(...values) as Row).total
    const order = filters.sort === 'name' ? `${this.terminology ? 'item_display_name(game_id,item_id,name_cn)' : 'name_cn'},item_id` : filters.sort === 'rarity' ? 'rarity IS NULL,rarity,item_id' : 'item_id'
    const rows = this.db.prepare(`SELECT * FROM catalog_items WHERE ${condition} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...values, pageSize, (page-1)*pageSize) as Row[]
    return { items: rows.map(row => ({...(this.terminology?.project(summary(row), filters.query, matches.get(row.item_id)) ?? summary(row)), ...(taskMatches.has(row.item_id) ? {matchReason:`命中：来源任务·${taskMatches.get(row.item_id)}`} : {}), ...(monsterMatches.has(row.item_id) ? {matchReason:`命中：来源怪物·${monsterMatches.get(row.item_id)}`} : {})})), total, page, pageSize, hasNext: page*pageSize < total }
  }
  getItem(identity: P2gItemIdentity): CatalogItemDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_items WHERE item_id=?').get(identity.itemId) as Row | undefined
    if (!row) return null
    const rows = this.db.prepare(this.monsters
      ? `SELECT r.*,m.monster_id,m.name_cn AS monster_name_cn,m.name_en AS monster_name_en,m.icon_path AS monster_icon_path
         FROM catalog_item_relations r LEFT JOIN catalog_monster_drops d ON d.relation_id=r.id
         LEFT JOIN catalog_monsters m ON m.monster_id=d.monster_id WHERE r.item_id=? ORDER BY r.source_kind,r.id`
      : 'SELECT * FROM catalog_item_relations WHERE item_id=? ORDER BY source_kind,id').all(identity.itemId) as Row[]
    const targetRows = this.db.prepare(`SELECT t.relation_id,i.item_id,i.name_cn FROM catalog_item_relation_targets t JOIN catalog_items i USING(item_id) JOIN catalog_item_relations r ON r.id=t.relation_id WHERE r.item_id=? ORDER BY t.relation_id,t.position`).all(identity.itemId) as Row[]
    const targets = new Map<number, ItemRelation['relatedItems']>()
    for (const target of targetRows) targets.set(target.relation_id, [...(targets.get(target.relation_id) ?? []), { gameId:'mhp2g',itemId:target.item_id,nameCn:target.name_cn,nameEn:'' }])
    const translation = this.localized ? this.db.prepare('SELECT * FROM catalog_item_localization WHERE item_id=?').get(identity.itemId) as Row : null
    const hasQuests = hasP2gQuests(this.db)
    const item: CatalogItemDetail = { ...summary(row), nameJp:row.name_jp, description:row.description, buyPrice:row.buy_price, sellPrice:row.sell_price, hexId:null, mappingStatus:row.mapping_status,
      ...(translation ? { localization: { nameSource: translation.name_source, namePending: translation.name_status === 'pending', descriptionSource: translation.description_source, descriptionPending: translation.description_status === 'pending', descriptionJp: translation.description_jp.replaceAll('\\n', '\n') } } : {}),
      relations:rows.filter(r => !hasQuests || r.source_kind !== 'quest').map(r => ({id:r.id,sourceKind:r.source_kind,usageKind:r.usage_kind,targetId:r.monster_id??null,targetName:r.target_name,quantity:r.quantity,probability:r.probability,rank:null,metadata:JSON.parse(r.metadata),relatedItems:targets.get(r.id)??[],pendingTarget:r.pending_target?JSON.parse(r.pending_target):null,
        relatedMonster:r.monster_id==null?null:{gameId:'mhp2g' as const,monsterId:r.monster_id,nameCn:r.monster_name_cn,nameEn:r.monster_name_en,iconPath:r.monster_icon_path}})) }
    item.relations.push(...questItemRelations(this.db,identity.itemId))
    return this.terminology?.detail(item) ?? item
  }
  getItemFacets() {
    const distinct = (column: string) => (this.db.prepare(`SELECT DISTINCT ${column} AS value FROM catalog_items WHERE ${column} IS NOT NULL ORDER BY ${column}`).all() as Row[]).map(row=>row.value as number)
    return { rarities:distinct('rarity'), maxStacks:distinct('max_stack'), relations:(this.db.prepare('SELECT DISTINCT source_kind,usage_kind FROM catalog_item_relations ORDER BY source_kind').all() as Row[]).map(r=>({sourceKind:String(r.source_kind),usageKind:r.usage_kind as string|null})) }
  }
}
function summary(row: Row): CatalogItemSummary {
  return {gameId:'mhp2g',itemId:row.item_id,dexId:null,nameCn:row.name_cn,nameEn:'',rarity:row.rarity,maxStack:row.max_stack,iconPath:row.icon_path || null,isPlaceholder:Boolean(row.is_placeholder)}
}
