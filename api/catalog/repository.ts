import type Database from 'better-sqlite3'
import type { ItemTermRepository } from '../terminology/itemTermRepository'
import type { GameId } from '../core/loadout'
import type { ArmorRelationTarget, ItemCatalogFilters, ItemDetail, LegacyItemIdentity, ItemRelation, ItemRelationTarget, ItemSummary, MonsterRelationTarget, PageResult, PalicoEquipmentRelationTarget, QuestRelationTarget, WeaponRelationTarget } from './types'

type RawItem = Record<string, unknown>
type RawRelation = Record<string, unknown>

const allowedSourceKinds = new Set(['combination', 'monster', 'location', 'quest', 'exchange'])
const allowedUsageKinds = new Set(['weapon', 'armor', 'decoration', 'palico-weapon', 'palico-armor', 'kinsect'])

function int(value: unknown): number | null { return typeof value === 'number' && Number.isInteger(value) ? value : value == null ? null : Number(value) }
function bool(value: unknown): boolean { return value === true || value === 1 || value === '1' }
function json(value: unknown): Record<string, string> { try { return JSON.parse(String(value ?? '{}')) as Record<string, string> } catch { return {} } }

export class ItemCatalogRepository {
  constructor(private readonly db: Database.Database, private readonly terminology?: ItemTermRepository) {
    if (terminology) for (const row of db.prepare('SELECT DISTINCT game_id FROM catalog_items').all() as { game_id: GameId }[]) terminology.bindCatalog(db, row.game_id)
  }

  searchItems(filters: ItemCatalogFilters & { gameId: GameId }): PageResult<ItemSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const values: unknown[] = [filters.gameId]
    const where = ['game_id = ?']
    if (filters.targetSaveId != null) { where.push('save_id = ?'); values.push(filters.targetSaveId) }
    if (!filters.includePlaceholders) where.push('is_placeholder = 0')
    const matches = this.terminology?.matchItems(filters.gameId, filters.query) ?? new Map<number, string>()
    if (filters.query?.trim()) {
      where.push('(name_cn LIKE ? OR name_en LIKE ? OR name_jp LIKE ? OR CAST(save_id AS TEXT) = ? OR lower(hex_id) = lower(?) OR save_id IN (SELECT value FROM json_each(?)))')
      const query = `%${filters.query.trim()}%`; values.push(query, query, query, filters.query.trim(), filters.query.trim().replace(/^0x/i, ''), JSON.stringify([...matches.keys()]))
    }
    if (filters.rarity != null) { where.push('rarity = ?'); values.push(filters.rarity) }
    if (filters.maxStack != null) { where.push('max_stack = ?'); values.push(filters.maxStack) }
    if (filters.sourceKinds?.length || filters.usageKinds?.length) {
      const relationParts: string[] = []
      if (filters.sourceKinds?.length) { const kinds = filters.sourceKinds.filter((kind) => allowedSourceKinds.has(kind)); if (kinds.length) { relationParts.push(`source_kind IN (${kinds.map(() => '?').join(',')})`); values.push(...kinds) } }
      if (filters.usageKinds?.length) { const kinds = filters.usageKinds.filter((kind) => allowedUsageKinds.has(kind)); if (kinds.length) { relationParts.push(`usage_kind IN (${kinds.map(() => '?').join(',')})`); values.push(...kinds) } }
      if (relationParts.length) { where.push(`EXISTS (SELECT 1 FROM catalog_item_relations r WHERE r.game_id = catalog_items.game_id AND r.item_save_id = catalog_items.save_id AND (${relationParts.join(' OR ')}))`) }
    }
    const order = filters.sort === 'name' ? `${this.terminology ? 'item_display_name(game_id,save_id,name_cn)' : 'name_cn'} COLLATE NOCASE ASC, save_id ASC` : filters.sort === 'rarity' ? 'rarity IS NULL, rarity ASC, save_id ASC' : 'save_id ASC'
    const base = `FROM catalog_items WHERE ${where.join(' AND ')}`
    const total = int((this.db.prepare(`SELECT count(*) AS count ${base}`).get(...values) as { count?: unknown } | undefined)?.count) ?? 0
    const rows = this.db.prepare(`SELECT * ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize) as RawItem[]
    return { items: rows.map(row => this.terminology?.project(toSummary(row), filters.query, matches.get(Number(row.save_id))) ?? toSummary(row)), page, pageSize, total, hasNext: page * pageSize < total }
  }

  getItem(identity: LegacyItemIdentity): ItemDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_items WHERE game_id = ? AND save_id = ?').get(identity.gameId, identity.saveId) as RawItem | undefined
    if (!row) return null
    const relations = this.db.prepare('SELECT * FROM catalog_item_relations WHERE game_id = ? AND item_save_id = ? ORDER BY source_kind, id').all(identity.gameId, identity.saveId) as RawRelation[]
    const relatedDexIds = [...new Set(relations.flatMap(relationRelatedDexIds))].filter((value): value is number => value != null)
    const relatedByDex = new Map<number, ItemRelationTarget>()
    if (relatedDexIds.length) {
      const placeholders = relatedDexIds.map(() => '?').join(',')
      const relatedRows = this.db.prepare(`SELECT game_id, save_id, dex_id, name_cn, name_en FROM catalog_items WHERE game_id = ? AND dex_id IN (${placeholders})`).all(identity.gameId, ...relatedDexIds) as RawItem[]
      for (const related of relatedRows) {
        const dexId = int(related.dex_id)
        if (dexId != null) relatedByDex.set(dexId, { gameId: String(related.game_id) as LegacyItemIdentity['gameId'], saveId: int(related.save_id) ?? 0, nameCn: String(related.name_cn ?? ''), nameEn: String(related.name_en ?? '') })
      }
    }
    const weaponDexIds = [...new Set(relations.filter((relation) => String(relation.usage_kind) === 'weapon').map((relation) => int(relation.target_id)).filter((value): value is number => value != null))]
    const weaponsByDex = new Map<number, WeaponRelationTarget>()
    if (weaponDexIds.length) {
      const marks = weaponDexIds.map(() => '?').join(',')
      const weaponRows = this.db.prepare(`SELECT ds.dex_id,w.weapon_key,w.type_id,w.name_cn,w.name_en FROM catalog_weapon_dex_sources ds JOIN catalog_weapons w ON w.game_id=ds.game_id AND w.weapon_key=ds.weapon_key WHERE ds.game_id=? AND ds.dex_id IN (${marks})`).all(identity.gameId, ...weaponDexIds) as RawItem[]
      for (const weapon of weaponRows) weaponsByDex.set(int(weapon.dex_id) ?? -1, { gameId: identity.gameId, weaponKey: String(weapon.weapon_key), typeId: int(weapon.type_id) ?? 0, nameCn: String(weapon.name_cn ?? ''), nameEn: String(weapon.name_en ?? '') })
    }
    const armorDexIds = [...new Set(relations.filter((relation) => String(relation.usage_kind) === 'armor').map((relation) => int(relation.target_id)).filter((value): value is number => value != null))]
    const armorsByDex = new Map<number, ArmorRelationTarget>()
    if (armorDexIds.length) {
      const marks = armorDexIds.map(() => '?').join(',')
      const armorRows = this.db.prepare(`SELECT dex_id,part,name_cn,name_en FROM catalog_armors WHERE game_id=? AND dex_id IN (${marks})`).all(identity.gameId, ...armorDexIds) as RawItem[]
      for (const armor of armorRows) armorsByDex.set(int(armor.dex_id) ?? -1, { gameId: identity.gameId, dexId: int(armor.dex_id) ?? 0, part: armor.part as ArmorRelationTarget['part'], nameCn: String(armor.name_cn), nameEn: String(armor.name_en) })
    }
    const palicoWeaponsByDex = new Map<number, PalicoEquipmentRelationTarget>()
    const palicoWeaponDexIds = [...new Set(relations.filter(relation => String(relation.usage_kind) === 'palico-weapon').map(relation => int(relation.target_id)).filter((value): value is number => value != null))]
    if (palicoWeaponDexIds.length && this.tableExists('catalog_palico_weapons')) {
      const rows = this.db.prepare(`SELECT dex_id,equipment_id,name_cn,name_en,icon_path FROM catalog_palico_weapons WHERE game_id=? AND dex_id IN (${palicoWeaponDexIds.map(()=>'?').join(',')})`).all(identity.gameId,...palicoWeaponDexIds) as RawItem[]
      for (const value of rows) palicoWeaponsByDex.set(int(value.dex_id)??-1,{gameId:'mhgu',kind:'weapon',equipmentId:int(value.equipment_id)??0,nameCn:String(value.name_cn),nameEn:String(value.name_en),iconPath:value.icon_path?String(value.icon_path):null})
    }
    const palicoArmorsByDex = new Map<number, PalicoEquipmentRelationTarget>()
    const palicoArmorDexIds = [...new Set(relations.filter(relation => String(relation.usage_kind) === 'palico-armor').map(relation => int(relation.target_id)).filter((value): value is number => value != null))]
    if (palicoArmorDexIds.length && this.tableExists('catalog_palico_armors')) {
      const rows = this.db.prepare(`SELECT dex_id,equipment_id,name_cn,name_en,icon_path FROM catalog_palico_armors WHERE game_id=? AND dex_id IN (${palicoArmorDexIds.map(()=>'?').join(',')})`).all(identity.gameId,...palicoArmorDexIds) as RawItem[]
      for (const value of rows) palicoArmorsByDex.set(int(value.dex_id)??-1,{gameId:'mhgu',kind:'armor',equipmentId:int(value.equipment_id)??0,nameCn:String(value.name_cn),nameEn:String(value.name_en),iconPath:value.icon_path?String(value.icon_path):null})
    }
    const monstersById = new Map<number, MonsterRelationTarget>()
    const monsterIds = [...new Set(relations.filter((relation) => String(relation.source_kind) === 'monster').map((relation) => int(relation.target_id)).filter((value): value is number => value != null))]
    if (monsterIds.length && this.tableExists('catalog_monsters')) {
      const marks = monsterIds.map(() => '?').join(',')
      const monsterRows = this.db.prepare(`SELECT monster_id,name_cn,name_en,icon_small_path FROM catalog_monsters WHERE game_id=? AND monster_id IN (${marks})`).all(identity.gameId, ...monsterIds) as RawItem[]
      for (const monster of monsterRows) monstersById.set(int(monster.monster_id) ?? -1, { gameId: identity.gameId, monsterId: int(monster.monster_id) ?? 0, nameCn: String(monster.name_cn), nameEn: String(monster.name_en), iconPath: monster.icon_small_path ? String(monster.icon_small_path) : null })
    }
    const questsById = new Map<number, QuestRelationTarget>()
    const questIds = [...new Set(relations.filter((relation) => String(relation.source_kind) === 'quest').map((relation) => int(relation.target_id)).filter((value): value is number => value != null))]
    if (questIds.length && this.tableExists('catalog_quests')) {
      const marks = questIds.map(() => '?').join(',')
      const questRows = this.db.prepare(`SELECT dex_id,quest_key,name_cn,name_en FROM catalog_quests WHERE game_id=? AND dex_id IN (${marks})`).all(identity.gameId, ...questIds) as RawItem[]
      for (const quest of questRows) questsById.set(int(quest.dex_id) ?? -1, { gameId: identity.gameId, questKey: String(quest.quest_key), nameCn: String(quest.name_cn), nameEn: String(quest.name_en) })
    }
    const item: ItemDetail = { ...toSummary(row), nameJp: String(row.name_jp ?? ''), sellPrice: int(row.sell_price), buyPrice: int(row.buy_price), hexId: row.hex_id ? String(row.hex_id) : null, mappingStatus: String(row.mapping_status ?? ''), relations: relations.map((relation) => toRelation(relation, relatedByDex, weaponsByDex, armorsByDex, monstersById, questsById, palicoWeaponsByDex, palicoArmorsByDex)) }
    return this.terminology?.detail(item) ?? item
  }

  getItemFacets(gameId: GameId) {
    const values = [gameId]
    const rarities = (this.db.prepare('SELECT DISTINCT rarity FROM catalog_items WHERE game_id = ? AND rarity IS NOT NULL ORDER BY rarity').all(...values) as RawItem[]).map((row) => int(row.rarity)).filter((value): value is number => value != null)
    const maxStacks = (this.db.prepare('SELECT DISTINCT max_stack FROM catalog_items WHERE game_id = ? AND max_stack IS NOT NULL ORDER BY max_stack').all(...values) as RawItem[]).map((row) => int(row.max_stack)).filter((value): value is number => value != null)
    const relations = (this.db.prepare('SELECT DISTINCT source_kind, usage_kind FROM catalog_item_relations WHERE game_id = ?').all(...values) as RawRelation[]).map((row) => ({ sourceKind: row.source_kind as string, usageKind: row.usage_kind as string | null }))
    return { rarities, maxStacks, relations }
  }

  private tableExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
  }
}

function toSummary(row: RawItem): ItemSummary {
  return { gameId: String(row.game_id) as GameId, saveId: int(row.save_id) ?? 0, dexId: int(row.dex_id), nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), rarity: int(row.rarity), maxStack: int(row.max_stack), iconPath: row.icon_path ? String(row.icon_path) : null, isPlaceholder: bool(row.is_placeholder) }
}
function relationRelatedDexIds(row: RawRelation): number[] {
  const metadata = json(row.metadata)
  const sourceKind = String(row.source_kind)
  const direction = metadata.direction
  if (sourceKind === 'combination') return [direction === 'ingredient' ? int(metadata.ItmC_ID) : int(metadata.ItmA_ID), direction === 'ingredient' ? null : int(metadata.ItmB_ID)].filter((value): value is number => value != null)
  if (sourceKind === 'exchange') return [direction === 'input' ? int(metadata.ItmOut_ID) : int(metadata.ItmIn_ID)].filter((value): value is number => value != null)
  return []
}

function rankName(rank: number | null): string | undefined {
  return rank == null ? undefined : ({ 1: '下位', 2: '上位', 3: 'G级' } as Record<number, string>)[rank] ?? `位阶 ${rank}`
}

function toRelation(row: RawRelation, relatedByDex: Map<number, ItemRelationTarget>, weaponsByDex: Map<number, WeaponRelationTarget>, armorsByDex: Map<number, ArmorRelationTarget>, monstersById: Map<number, MonsterRelationTarget>, questsById: Map<number, QuestRelationTarget>, palicoWeaponsByDex: Map<number, PalicoEquipmentRelationTarget>, palicoArmorsByDex: Map<number, PalicoEquipmentRelationTarget>): ItemRelation {
  const metadata = json(row.metadata)
  const targetId = int(row.target_id)
  const relation: ItemRelation = { id: int(row.id) ?? 0, sourceKind: String(row.source_kind) as ItemRelation['sourceKind'], usageKind: row.usage_kind ? String(row.usage_kind) as ItemRelation['usageKind'] : null, targetId, targetName: String(row.target_name ?? ''), quantity: int(row.quantity), probability: row.probability == null ? null : Number(row.probability), rank: int(row.rank), metadata, relatedItems: relationRelatedDexIds(row).map((dexId) => relatedByDex.get(dexId)).filter((value): value is ItemRelationTarget => value != null), relatedWeapon: targetId == null ? null : weaponsByDex.get(targetId) ?? null, relatedArmor: targetId == null ? null : armorsByDex.get(targetId) ?? null, relatedMonster: targetId == null ? null : monstersById.get(targetId) ?? null, relatedQuest: targetId == null ? null : questsById.get(targetId) ?? null, relatedPalicoWeapon: targetId == null ? null : palicoWeaponsByDex.get(targetId) ?? null, relatedPalicoArmor: targetId == null ? null : palicoArmorsByDex.get(targetId) ?? null }
  const namedRank = metadata.Rank_Name || rankName(relation.rank)
  if (namedRank) relation.metadata.rankName = namedRank
  return relation
}
