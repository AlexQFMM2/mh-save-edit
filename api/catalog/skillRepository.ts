import type Database from 'better-sqlite3'
import { hasSkillWikiDetails, readSkillWikiDetails, wikiIdentityJoin } from './skillWikiDetails'
import type { GameId } from '../core/loadout'
import type { ArmorPartId, PageResult, SkillActivation, SkillActivationLink, SkillArmorRelation, SkillCatalogFacets, SkillCatalogFilters, SkillDecorationRelation, SkillDetail, SkillIdentity, SkillSummary, SkillTalismanRelation } from './types'

type Row = Record<string, unknown>
const int = (value: unknown, fallback = 0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback }
const str = (value: unknown) => String(value ?? '')
const bool = (value: unknown) => value === 1 || value === true
const hasTable = (db: Database.Database, name: string) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))

export class SkillCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  searchSkills(filters: SkillCatalogFilters): PageResult<SkillSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const values: unknown[] = [filters.gameId]
    const where = ['s.game_id=?']
    if (!filters.includePlaceholders) where.push('COALESCE(s.is_placeholder,0)=0')
    if (filters.targetSkillId != null) { where.push('s.skill_id=?'); values.push(filters.targetSkillId) }
    if (filters.query?.trim()) {
      const query = filters.query.trim(); const like = `%${query}%`
      const id = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : -1
      const wikiSearch = hasSkillWikiDetails(this.db) ? ` OR EXISTS (SELECT 1 FROM catalog_skill_effect_details w JOIN catalog_skill_activations a ON ${wikiIdentityJoin} WHERE a.game_id=s.game_id AND a.skill_id=s.skill_id AND w.description_cn LIKE ?)` : ''
      where.push(`(s.name_cn LIKE ? OR s.name_en LIKE ? OR COALESCE(s.name_jp,'') LIKE ? OR s.skill_id=? OR s.dex_id=? OR EXISTS (SELECT 1 FROM catalog_skill_activations a WHERE a.game_id=s.game_id AND a.skill_id=s.skill_id AND (a.name_cn LIKE ? OR a.name_en LIKE ? OR a.name_jp LIKE ? OR a.description_cn LIKE ? OR a.description_en LIKE ? OR a.description_jp LIKE ?))${wikiSearch})`)
      values.push(like, like, like, id, id, like, like, like, like, like, like)
      if (wikiSearch) values.push(like)
    }
    if (filters.direction) { where.push('EXISTS (SELECT 1 FROM catalog_skill_activations a WHERE a.game_id=s.game_id AND a.skill_id=s.skill_id AND a.direction=?)'); values.push(filters.direction) }
    if (filters.source && filters.source !== 'all') {
      const sourceTable = filters.source === 'armor' ? 'catalog_armor_skills' : filters.source === 'decoration' ? 'catalog_decoration_skills' : 'catalog_skill_talisman_ranges'
      where.push(`EXISTS (SELECT 1 FROM ${sourceTable} r WHERE r.game_id=s.game_id AND r.skill_id=s.skill_id)`)
    }
    const base = `FROM catalog_skills s WHERE ${where.join(' AND ')}`
    const total = int((this.db.prepare(`SELECT count(*) count ${base}`).get(...values) as Row | undefined)?.count)
    const order = filters.sort === 'name' ? 's.name_cn COLLATE NOCASE ASC,s.skill_id ASC' : filters.sort === 'activationCount' ? '(SELECT count(*) FROM catalog_skill_activations a WHERE a.game_id=s.game_id AND a.skill_id=s.skill_id) DESC,s.skill_id ASC' : 's.skill_id ASC'
    const rows = this.db.prepare(`SELECT s.* ${base} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize) as Row[]
    return { items: rows.map(row => this.toSummary(row, filters.gameId)), page, pageSize, total, hasNext: page * pageSize < total }
  }

  getSkill(identity: SkillIdentity): SkillDetail | null {
    const row = this.db.prepare('SELECT * FROM catalog_skills WHERE game_id=? AND skill_id=?').get(identity.gameId, identity.skillId) as Row | undefined
    if (!row) return null
    const activationRows = hasTable(this.db, 'catalog_skill_activations') ? this.db.prepare('SELECT * FROM catalog_skill_activations WHERE game_id=? AND skill_id=? ORDER BY threshold DESC,dex_activation_id').all(identity.gameId, identity.skillId) as Row[] : []
    const allComponents = hasTable(this.db, 'catalog_skill_components') ? this.db.prepare(`SELECT c.composite_activation_key,c.component_activation_key,a.name_cn,a.name_en,a.direction FROM catalog_skill_components c JOIN catalog_skill_activations a ON a.game_id=c.game_id AND a.activation_key=c.component_activation_key WHERE c.game_id=? AND c.composite_activation_key IN (SELECT activation_key FROM catalog_skill_activations WHERE game_id=? AND skill_id=?) ORDER BY c.composite_activation_key,c.component_activation_key`).all(identity.gameId, identity.gameId, identity.skillId) as Row[] : []
    const componentsByActivation = new Map<string, SkillActivationLink[]>()
    for (const value of allComponents) { const key = str(value.composite_activation_key); const links = componentsByActivation.get(key) ?? []; links.push({ activationKey: str(value.component_activation_key), nameCn: str(value.name_cn), nameEn: str(value.name_en), direction: str(value.direction) as SkillActivationLink['direction'] }); componentsByActivation.set(key, links) }
    const wikiDetails = readSkillWikiDetails(this.db, identity.gameId, identity.skillId)
    const activations = activationRows.map(value => ({ ...this.toActivation(value, componentsByActivation.get(str(value.activation_key)) ?? []), wikiDetail: wikiDetails.get(str(value.activation_key)) }))
    const components = [...componentsByActivation.values()].flat()
    const talismans = hasTable(this.db, 'catalog_skill_talisman_ranges') ? (this.db.prepare('SELECT * FROM catalog_skill_talisman_ranges WHERE game_id=? AND skill_id=? ORDER BY talisman_id,position,min_points,slot_count').all(identity.gameId, identity.skillId) as Row[]).map(row => ({ rangeKey: str(row.range_key), skillId: int(row.skill_id), skillNameCn: str(row.skill_name_cn || row.name_cn || ''), talismanId: int(row.talisman_id), talismanNameCn: str(row.talisman_name_cn), talismanNameEn: str(row.talisman_name_en), position: str(row.position) as 'A'|'B', slotCount: row.slot_count == null ? null : int(row.slot_count), minPoints: int(row.min_points), maxPoints: int(row.max_points), maxSlots: row.max_slots == null ? null : int(row.max_slots), rangeStatus: str(row.range_status) as SkillTalismanRelation['rangeStatus'], source: str(row.source) })) : []
    for (const talisman of talismans) talisman.skillNameCn = str(row.name_cn)
    return { gameId: identity.gameId, skillId: identity.skillId, nameCn: str(row.name_cn), nameEn: str(row.name_en), nameJp: str(row.name_jp), descriptionCn: row.description_cn == null ? null : str(row.description_cn), descriptionEn: row.description_en == null ? null : str(row.description_en), descriptionJp: row.description_jp == null ? null : str(row.description_jp), activations, components, decorations: this.decorations(identity), armors: this.armors(identity), talismans }
  }

  getSkillFacets(_gameId: GameId): SkillCatalogFacets { return { directions: ['positive','negative','special'], sources: ['armor','decoration','talisman'] } }

  private toSummary(row: Row, gameId: GameId): SkillSummary {
    const count = (direction?: string) => int((this.db.prepare(`SELECT count(*) count FROM catalog_skill_activations WHERE game_id=? AND skill_id=?${direction ? ' AND direction=?' : ''}`).get(...(direction ? [gameId, int(row.skill_id), direction] : [gameId, int(row.skill_id)])) as Row | undefined)?.count)
    const relationCount = (table: string) => int((this.db.prepare(`SELECT count(*) count FROM ${table} WHERE game_id=? AND skill_id=?`).get(gameId, int(row.skill_id)) as Row | undefined)?.count)
    return { gameId, skillId: int(row.skill_id), nameCn: str(row.name_cn), nameEn: str(row.name_en), nameJp: str(row.name_jp), activationCount: count(), positiveActivationCount: count('positive'), negativeActivationCount: count('negative'), specialActivationCount: count('special'), armorCount: relationCount('catalog_armor_skills'), decorationCount: relationCount('catalog_decoration_skills'), talismanCount: hasTable(this.db, 'catalog_skill_talisman_ranges') ? relationCount('catalog_skill_talisman_ranges') : 0, isPlaceholder: bool(row.is_placeholder) }
  }
  private toActivation(row: Row, components: SkillActivationLink[]): SkillActivation { return { activationKey: str(row.activation_key), dexActivationId: int(row.dex_activation_id), threshold: int(row.threshold), direction: str(row.direction) as SkillActivation['direction'], nameCn: str(row.name_cn), nameEn: str(row.name_en), nameJp: str(row.name_jp), descriptionCn: str(row.description_cn), descriptionEn: str(row.description_en), descriptionJp: str(row.description_jp), components } }
  private decorations(identity: SkillIdentity): SkillDecorationRelation[] { return (this.db.prepare('SELECT d.save_id,d.name_cn,d.name_en,d.slots,d.icon_path,sk.points FROM catalog_decoration_skills sk JOIN catalog_decorations d ON d.game_id=sk.game_id AND d.save_id=sk.decoration_save_id WHERE sk.game_id=? AND sk.skill_id=? AND d.is_placeholder=0 ORDER BY sk.points DESC,d.slots,d.save_id').all(identity.gameId, identity.skillId) as Row[]).map(row => ({ gameId: identity.gameId, saveId: int(row.save_id), nameCn: str(row.name_cn), nameEn: str(row.name_en), points: int(row.points), slots: int(row.slots), iconPath: row.icon_path ? str(row.icon_path) : null })) }
  private armors(identity: SkillIdentity): SkillArmorRelation[] { return (this.db.prepare('SELECT a.dex_id,a.name_cn,a.name_en,a.part,a.slots,a.icon_path,sk.points FROM catalog_armor_skills sk JOIN catalog_armors a ON a.game_id=sk.game_id AND a.dex_id=sk.armor_dex_id WHERE sk.game_id=? AND sk.skill_id=? AND a.is_placeholder=0 ORDER BY sk.points DESC,a.part,a.dex_id').all(identity.gameId, identity.skillId) as Row[]).map(row => ({ gameId: identity.gameId, dexId: int(row.dex_id), nameCn: str(row.name_cn), nameEn: str(row.name_en), points: int(row.points), slots: int(row.slots), part: str(row.part) as ArmorPartId, iconPath: row.icon_path ? str(row.icon_path) : null })) }
}
