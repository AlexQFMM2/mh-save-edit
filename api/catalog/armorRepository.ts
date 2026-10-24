import type Database from 'better-sqlite3'
import { monsterNameQuery } from './monsterNaming.mjs'
import type { GameId } from '../core/loadout'
import type {
  ArmorCatalogFacets, ArmorCatalogFilters, ArmorDetail, ArmorIdentity, ArmorMaterial,
  ArmorSetFilters, ArmorSetMember, ArmorSetRow, ArmorSetSummary, ArmorSkill, ArmorSummary,
  PageResult,
} from './types'

type Row = Record<string, unknown>

const int = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0
const bool = (value: unknown): boolean => value === 1 || value === true || value === '1'
const direction = (value: unknown): 'ASC' | 'DESC' => value === 'desc' ? 'DESC' : 'ASC'

export class ArmorCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  searchArmors(filters: ArmorCatalogFilters): PageResult<ArmorSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const where = ['a.game_id=?']
    const values: unknown[] = [filters.gameId]
    if (filters.targetDexId != null) { where.push('a.dex_id=?'); values.push(filters.targetDexId) }
    if (!filters.includePlaceholders) where.push('a.is_placeholder=0')
    if (filters.targetDexId == null) {
      const query = monsterNameQuery(filters.query)?.trim()
      if (query) {
        const numeric = /^0x[0-9a-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
        const parts = ['a.name_cn LIKE ?', 'a.name_en LIKE ?', 'a.name_jp LIKE ?']
        const like = `%${query}%`; values.push(like, like, like)
        if (numeric != null) { parts.push('a.dex_id=?'); values.push(numeric) }
        where.push(`(${parts.join(' OR ')})`)
      }
      if (filters.part) { where.push('a.part=?'); values.push(filters.part) }
      if (filters.combat) { where.push(filters.combat === 'both' ? 'a.combat=\'both\'' : '(a.combat=\'both\' OR a.combat=?)'); if (filters.combat !== 'both') values.push(filters.combat) }
      if (filters.gender) { where.push(filters.gender === 'both' ? 'a.gender=\'both\'' : '(a.gender=\'both\' OR a.gender=?)'); if (filters.gender !== 'both') values.push(filters.gender) }
      if (filters.rarity != null) { where.push('a.rarity=?'); values.push(filters.rarity) }
      if (filters.slots != null) { where.push('a.slots=?'); values.push(filters.slots) }
      if (filters.skillId != null) {
        where.push('EXISTS (SELECT 1 FROM catalog_armor_skills sk WHERE sk.game_id=a.game_id AND sk.armor_dex_id=a.dex_id AND sk.skill_id=? AND sk.points>0)')
        values.push(filters.skillId)
      }
    }
    const column = ({ name: 'name_cn COLLATE NOCASE', rarity: 'rarity', slots: 'slots', baseDefense: 'base_defense', maxDefense: 'max_defense', fireRes: 'fire_res', waterRes: 'water_res', thunderRes: 'thunder_res', iceRes: 'ice_res', dragonRes: 'dragon_res' } as Record<string, string>)[filters.sort ?? ''] ?? 'dex_id'
    const base = `FROM catalog_armors a WHERE ${where.join(' AND ')}`
    const total = int((this.db.prepare(`SELECT count(*) count ${base}`).get(...values) as Row).count)
    const order = filters.sort === 'skillPoints' && filters.skillId != null ? 'COALESCE((SELECT sk.points FROM catalog_armor_skills sk WHERE sk.game_id=a.game_id AND sk.armor_dex_id=a.dex_id AND sk.skill_id=?),-2147483648)' : `a.${column}`
    const orderValues = filters.sort === 'skillPoints' && filters.skillId != null ? [...values, filters.skillId] : values
    const rows = this.db.prepare(`SELECT a.* ${base} ORDER BY ${order} ${direction(filters.direction)},a.dex_id ASC LIMIT ? OFFSET ?`).all(...orderValues, pageSize, (page - 1) * pageSize) as Row[]
    return { items: this.decorate(rows), page, pageSize, total, hasNext: page * pageSize < total }
  }

  searchArmorSets(filters: ArmorSetFilters): PageResult<ArmorSetSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const where = ['s.game_id=?']
    const values: unknown[] = [filters.gameId]
    const memberConditions: string[] = []
    if (!filters.includePlaceholders) memberConditions.push('a.is_placeholder=0')
    if (filters.targetDexId != null) { memberConditions.push('a.dex_id=?'); values.push(filters.targetDexId) }
    if (filters.targetDexId == null) {
      const query = monsterNameQuery(filters.query)?.trim()
      if (query) {
        const numeric = /^0x[0-9a-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
        const parts = ['s.blademaster_name_cn LIKE ?', 's.gunner_name_cn LIKE ?', 'a.name_cn LIKE ?', 'a.name_en LIKE ?', 'a.name_jp LIKE ?']
        const like = `%${query}%`; values.push(like, like, like, like, like)
        if (numeric != null) { parts.push('a.dex_id=?'); values.push(numeric) }
        memberConditions.push(`(${parts.join(' OR ')})`)
      }
      if (filters.combat) {
        if (filters.combat === 'both') memberConditions.push('a.combat=\'both\'')
        else { memberConditions.push('m.combat_row=?'); values.push(filters.combat) }
      }
      if (filters.gender) { memberConditions.push(filters.gender === 'both' ? 'a.gender=\'both\'' : '(a.gender=\'both\' OR a.gender=?)'); if (filters.gender !== 'both') values.push(filters.gender) }
      if (filters.rarity != null) { memberConditions.push('a.rarity=?'); values.push(filters.rarity) }
      if (filters.slots != null) { memberConditions.push('a.slots=?'); values.push(filters.slots) }
      if (filters.skillId != null) {
        memberConditions.push('EXISTS (SELECT 1 FROM catalog_armor_skills sk WHERE sk.game_id=a.game_id AND sk.armor_dex_id=a.dex_id AND sk.skill_id=? AND sk.points>0)')
        values.push(filters.skillId)
      }
    }
    if (memberConditions.length) where.push(`EXISTS (SELECT 1 FROM catalog_armor_set_members m JOIN catalog_armors a ON a.game_id=m.game_id AND a.dex_id=m.armor_dex_id WHERE m.game_id=s.game_id AND m.set_key=s.set_key AND ${memberConditions.join(' AND ')})`)
    const sort = ({ name: 'COALESCE(NULLIF(s.blademaster_name_cn,\'\'),s.gunner_name_cn) COLLATE NOCASE', rarity: 's.rarity', slots: 's.total_slots', baseDefense: 's.total_base_defense', maxDefense: 's.total_max_defense' } as Record<string, string>)[filters.sort ?? ''] ?? 's.sort_order'
    const base = `FROM catalog_armor_sets s WHERE ${where.join(' AND ')}`
    const total = int((this.db.prepare(`SELECT count(*) count ${base}`).get(...values) as Row).count)
    let order = sort
    let orderValues = [...values]
    if (filters.sort === 'skillPoints' && filters.skillId != null) {
      const sum = () => `(SELECT COALESCE(SUM(sk.points),0) FROM catalog_armor_set_members sm JOIN catalog_armor_skills sk ON sk.game_id=sm.game_id AND sk.armor_dex_id=sm.armor_dex_id WHERE sm.game_id=s.game_id AND sm.set_key=s.set_key AND sm.combat_row=? AND sk.skill_id=?)`
      if (filters.combat === 'blademaster' || filters.combat === 'gunner') {
        order = sum()
        orderValues.push(filters.combat, filters.skillId)
      } else {
        order = `MAX(${sum()},${sum()})`
        orderValues.push('blademaster', filters.skillId, 'gunner', filters.skillId)
      }
    }
    const rows = this.db.prepare(`SELECT s.* ${base} ORDER BY ${order} ${direction(filters.direction)},s.sort_order ASC LIMIT ? OFFSET ?`).all(...orderValues, pageSize, (page - 1) * pageSize) as Row[]
    return { items: this.decorateSets(filters.gameId, rows), page, pageSize, total, hasNext: page * pageSize < total }
  }

  getArmor(identity: ArmorIdentity): ArmorDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_armors WHERE game_id=? AND dex_id=?').get(identity.gameId, identity.dexId) as Row | undefined
    if (!row) return null
    const summary = this.decorate([row])[0]
    const skills = this.skillRows(identity.gameId, [identity.dexId]).get(identity.dexId) ?? []
    const materials = (this.db.prepare(`SELECT m.quantity,i.save_id,i.name_cn,i.name_en FROM catalog_armor_materials m JOIN catalog_items i ON i.game_id=m.game_id AND i.save_id=m.item_save_id WHERE m.game_id=? AND m.armor_dex_id=? ORDER BY m.row_id`).all(identity.gameId, identity.dexId) as Row[]).map((value): ArmorMaterial => ({ gameId: identity.gameId, saveId: int(value.save_id), nameCn: String(value.name_cn), nameEn: String(value.name_en), quantity: int(value.quantity) }))
    const saveIdentities = (this.db.prepare('SELECT save_type,save_id,mapping_status FROM catalog_armor_save_identities WHERE game_id=? AND armor_dex_id=? ORDER BY save_type,save_id').all(identity.gameId, identity.dexId) as Row[]).map((value) => ({ saveType: int(value.save_type), saveId: int(value.save_id), mappingStatus: String(value.mapping_status) }))
    return { ...summary, skills, materials, saveIdentities, mappingStatus: String(row.mapping_status) }
  }

  getArmorFacets(gameId: GameId): ArmorCatalogFacets {
    const rarities = (this.db.prepare('SELECT DISTINCT rarity value FROM catalog_armors WHERE game_id=? AND is_placeholder=0 ORDER BY rarity').all(gameId) as Row[]).map((row) => int(row.value))
    const slots = (this.db.prepare('SELECT DISTINCT slots value FROM catalog_armors WHERE game_id=? AND is_placeholder=0 ORDER BY slots').all(gameId) as Row[]).map((row) => int(row.value))
    const skills = (this.db.prepare('SELECT skill_id,name_cn,name_en FROM catalog_armor_skills WHERE game_id=? AND points>0 GROUP BY skill_id,name_cn,name_en ORDER BY name_cn').all(gameId) as Row[]).map((row) => ({ skillId: int(row.skill_id), nameCn: String(row.name_cn), nameEn: String(row.name_en) }))
    return { rarities, slots, skills }
  }

  private decorate(rows: Row[]): ArmorSummary[] {
    if (!rows.length) return []
    const gameId = String(rows[0].game_id) as GameId
    const skills = this.skillRows(gameId, rows.map((row) => int(row.dex_id)))
    return rows.map((row) => ({
      gameId, dexId: int(row.dex_id), nameCn: String(row.name_cn), nameEn: String(row.name_en), nameJp: String(row.name_jp),
      part: row.part as ArmorSummary['part'], combat: row.combat as ArmorSummary['combat'], gender: row.gender as ArmorSummary['gender'],
      rarity: int(row.rarity), slots: int(row.slots), baseDefense: int(row.base_defense), maxDefense: int(row.max_defense),
      fireRes: int(row.fire_res), waterRes: int(row.water_res), thunderRes: int(row.thunder_res), iceRes: int(row.ice_res), dragonRes: int(row.dragon_res),
      price: row.price == null ? null : int(row.price), iconPath: row.icon_path ? String(row.icon_path) : null, isPlaceholder: bool(row.is_placeholder),
      skills: (skills.get(int(row.dex_id)) ?? []).map(({ skillId, nameCn, nameEn, points }) => ({ skillId, nameCn, nameEn, points })),
    }))
  }

  private skillRows(gameId: GameId, dexIds: number[]): Map<number, ArmorSkill[]> {
    const result = new Map<number, ArmorSkill[]>()
    if (!dexIds.length) return result
    const marks = dexIds.map(() => '?').join(',')
    const rows = this.db.prepare(`SELECT * FROM catalog_armor_skills WHERE game_id=? AND armor_dex_id IN (${marks}) ORDER BY armor_dex_id,skill_id`).all(gameId, ...dexIds) as Row[]
    for (const row of rows) result.set(int(row.armor_dex_id), [...(result.get(int(row.armor_dex_id)) ?? []), { skillId: int(row.skill_id), nameCn: String(row.name_cn), nameEn: String(row.name_en), points: int(row.points), activeSkillNameCn: row.active_skill_name_cn == null ? null : String(row.active_skill_name_cn), activeSkillNameEn: row.active_skill_name_en == null ? null : String(row.active_skill_name_en) }])
    return result
  }

  private decorateSets(gameId: GameId, rows: Row[]): ArmorSetSummary[] {
    if (!rows.length) return []
    const keys = rows.map((row) => String(row.set_key)); const marks = keys.map(() => '?').join(',')
    const members = this.db.prepare(`SELECT m.set_key,m.combat_row,a.* FROM catalog_armor_set_members m JOIN catalog_armors a ON a.game_id=m.game_id AND a.dex_id=m.armor_dex_id WHERE m.game_id=? AND m.set_key IN (${marks}) ORDER BY m.set_key,m.combat_row,m.part_order`).all(gameId, ...keys) as Row[]
    const bySet = new Map<string, Map<string, Partial<Record<ArmorSummary['part'], ArmorSetMember>>>>()
    for (const row of members) {
      const setKey = String(row.set_key); const combat = String(row.combat_row)
      const combatRows = bySet.get(setKey) ?? new Map(); const values = combatRows.get(combat) ?? {}
      values[row.part as ArmorSummary['part']] = { gameId, dexId: int(row.dex_id), nameCn: String(row.name_cn), nameEn: String(row.name_en), part: row.part as ArmorSummary['part'], iconPath: row.icon_path ? String(row.icon_path) : null, rarity: int(row.rarity), slots: int(row.slots), baseDefense: int(row.base_defense), maxDefense: int(row.max_defense) }
      combatRows.set(combat, values); bySet.set(setKey, combatRows)
    }
    return rows.map((row) => {
      const setKey = String(row.set_key); const values = bySet.get(setKey) ?? new Map()
      const setRows: ArmorSetRow[] = (['blademaster', 'gunner'] as const).map((combat) => ({ combat, nameCn: String(row[`${combat}_name_cn`]), members: values.get(combat) ?? {} }))
      return { gameId, setKey, sortOrder: int(row.sort_order), rows: setRows, rarity: int(row.rarity), totalSlots: int(row.total_slots), totalBaseDefense: int(row.total_base_defense), totalMaxDefense: int(row.total_max_defense) }
    })
  }
}
