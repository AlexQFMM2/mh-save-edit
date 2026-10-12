import type Database from 'better-sqlite3'
import type {
  DecorationCatalogFacets,
  DecorationCatalogFilters,
  DecorationDetail,
  LegacyDecorationIdentity,
  DecorationMaterial,
  DecorationSkill,
  DecorationSummary,
  PageResult,
} from './types'
import type { GameId } from '../core/loadout'

type RawRow = Record<string, unknown>

const asInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (value == null || value === '') return null
  const result = Number(value)
  return Number.isInteger(result) ? result : null
}

const asBool = (value: unknown): boolean => value === true || value === 1 || value === '1'

export class DecorationCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  searchDecorations(filters: DecorationCatalogFilters & { gameId: GameId }): PageResult<DecorationSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const values: unknown[] = [filters.gameId]
    const where = ['d.game_id = ?']
    if (filters.targetSaveId != null) { where.push('d.save_id = ?'); values.push(filters.targetSaveId) }

    if (!filters.includePlaceholders) where.push('d.is_placeholder = 0')
    if (filters.query?.trim()) {
      const query = filters.query.trim()
      const like = `%${query}%`
      const numericId = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number.parseInt(query, 10) : -1
      where.push(`(
        d.name_cn LIKE ? OR d.name_en LIKE ? OR d.save_id = ? OR d.dex_id = ?
        OR EXISTS (SELECT 1 FROM catalog_decoration_skills qs WHERE qs.game_id = d.game_id AND qs.decoration_save_id = d.save_id
          AND (qs.name_cn LIKE ? OR qs.name_en LIKE ? OR COALESCE(qs.active_skill_name_cn, '') LIKE ? OR COALESCE(qs.active_skill_name_en, '') LIKE ?))
      )`)
      values.push(like, like, numericId, numericId, like, like, like, like)
    }
    if (filters.skillId != null) {
      where.push('EXISTS (SELECT 1 FROM catalog_decoration_skills fs WHERE fs.game_id = d.game_id AND fs.decoration_save_id = d.save_id AND fs.skill_id = ? AND fs.points > 0)')
      values.push(filters.skillId)
    }
    if (filters.slots != null) {
      where.push('d.slots = ?')
      values.push(filters.slots)
    }

    const order = filters.sort === 'name'
      ? 'd.name_cn COLLATE NOCASE ASC, d.save_id ASC'
      : filters.sort === 'slots'
        ? 'd.slots ASC, d.save_id ASC'
        : filters.sort === 'skillPoints' && filters.skillId != null
          ? 'COALESCE((SELECT MAX(ss.points) FROM catalog_decoration_skills ss WHERE ss.game_id = d.game_id AND ss.decoration_save_id = d.save_id AND ss.skill_id = ?), -2147483648) DESC, d.slots ASC, d.save_id ASC'
          : 'd.save_id ASC'
    const orderValues = filters.sort === 'skillPoints' && filters.skillId != null ? [...values, filters.skillId] : values
    const base = `FROM catalog_decorations d WHERE ${where.join(' AND ')}`
    const total = asInt((this.db.prepare(`SELECT count(*) AS count ${base}`).get(...values) as RawRow | undefined)?.count) ?? 0
    const rows = this.db.prepare(`SELECT d.* ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...orderValues, pageSize, (page - 1) * pageSize) as RawRow[]
    const skills = this.skillsFor(rows.map((row) => asInt(row.save_id) ?? 0), filters.gameId)
    return {
      items: rows.map((row) => toSummary(row, skills.get(asInt(row.save_id) ?? 0) ?? [])),
      page,
      pageSize,
      total,
      hasNext: page * pageSize < total,
    }
  }

  getDecoration(identity: LegacyDecorationIdentity): DecorationDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_decorations WHERE game_id = ? AND save_id = ?').get(identity.gameId, identity.saveId) as RawRow | undefined
    if (!row) return null
    const skills = this.skillsFor([identity.saveId], identity.gameId).get(identity.saveId) ?? []
    const materials = this.materialsFor(identity)
    const dexIds = (this.db.prepare('SELECT dex_id FROM catalog_decoration_dex_sources WHERE game_id = ? AND decoration_save_id = ? ORDER BY dex_id').all(identity.gameId, identity.saveId) as RawRow[]).map((value) => asInt(value.dex_id)).filter((value): value is number => value != null)
    return { ...toSummary(row, skills), dexIds, skills, materials, mappingStatus: String(row.mapping_status ?? '') }
  }

  getDecorationFacets(gameId: GameId): DecorationCatalogFacets {
    const slots = (this.db.prepare('SELECT DISTINCT slots FROM catalog_decorations WHERE game_id = ? AND is_placeholder = 0 ORDER BY slots').all(gameId) as RawRow[])
      .map((row) => asInt(row.slots)).filter((value): value is number => value != null)
    const skills = (this.db.prepare(`SELECT DISTINCT s.skill_id, s.name_cn, s.name_en
      FROM catalog_decoration_skills s JOIN catalog_decorations d ON d.game_id=s.game_id AND d.save_id=s.decoration_save_id
      WHERE s.game_id = ? AND s.points > 0 AND d.is_placeholder = 0
      ORDER BY s.name_cn COLLATE NOCASE, s.skill_id`).all(gameId) as RawRow[])
      .map((row) => ({ skillId: asInt(row.skill_id) ?? 0, nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? '') }))
    return { slots, skills }
  }

  private skillsFor(saveIds: number[], gameId: GameId): Map<number, DecorationSkill[]> {
    if (!saveIds.length) return new Map()
    const placeholders = saveIds.map(() => '?').join(',')
    const rows = this.db.prepare(`SELECT decoration_save_id, skill_id, name_cn, name_en, points, active_skill_name_cn, active_skill_name_en
      FROM catalog_decoration_skills WHERE game_id = ? AND decoration_save_id IN (${placeholders}) ORDER BY skill_id, points DESC`).all(gameId, ...saveIds) as RawRow[]
    const result = new Map<number, DecorationSkill[]>()
    for (const row of rows) {
      const saveId = asInt(row.decoration_save_id) ?? 0
      const list = result.get(saveId) ?? []
      list.push({
        skillId: asInt(row.skill_id) ?? 0,
        nameCn: String(row.name_cn ?? ''),
        nameEn: String(row.name_en ?? ''),
        points: asInt(row.points) ?? 0,
        activeSkillNameCn: row.active_skill_name_cn ? String(row.active_skill_name_cn) : null,
        activeSkillNameEn: row.active_skill_name_en ? String(row.active_skill_name_en) : null,
      })
      result.set(saveId, list)
    }
    return result
  }

  private materialsFor(identity: LegacyDecorationIdentity): DecorationMaterial[] {
    const rows = this.db.prepare(`SELECT m.recipe_index, m.quantity, i.game_id, i.save_id, i.name_cn, i.name_en
      FROM catalog_decoration_materials m
      LEFT JOIN catalog_items i ON i.game_id = m.game_id AND i.save_id = m.item_save_id
      WHERE m.game_id = ? AND m.decoration_save_id = ? ORDER BY m.row_id`).all(identity.gameId, identity.saveId) as RawRow[]
    return rows
      .filter((row) => asInt(row.save_id) != null)
      .map((row) => ({ gameId: String(row.game_id) as GameId, saveId: asInt(row.save_id) ?? 0, nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), quantity: asInt(row.quantity) ?? 0, recipeIndex: asInt(row.recipe_index) ?? 1 }))
  }
}

function toSummary(row: RawRow, skills: DecorationSkill[]): DecorationSummary {
  return {
    gameId: String(row.game_id) as GameId,
    saveId: asInt(row.save_id) ?? 0,
    dexId: asInt(row.dex_id),
    itemSaveId: asInt(row.item_save_id),
    itemDexId: asInt(row.item_dex_id),
    nameCn: String(row.name_cn ?? ''),
    nameEn: String(row.name_en ?? ''),
    slots: asInt(row.slots) ?? 0,
    price: asInt(row.price),
    iconPath: row.icon_path ? String(row.icon_path) : null,
    isPlaceholder: asBool(row.is_placeholder),
    skills: skills.map(({ skillId, nameCn, nameEn, points }) => ({ skillId, nameCn, nameEn, points })),
  }
}
