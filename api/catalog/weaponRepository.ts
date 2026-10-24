import type Database from 'better-sqlite3'
import { monsterNameQuery } from './monsterNaming.mjs'
import { FINAL_WEAPON_SQL, readFinalWeaponKeys } from './finalWeapons'
import type { GameId } from '../core/loadout'
import type {
  BowCharge,
  BowgunAmmoRow,
  BowgunStats,
  HuntingHornNote,
  HuntingHornSong,
  PageResult,
  SharpnessStage,
  WeaponAttribute,
  WeaponCatalogFacets,
  WeaponCatalogFilters,
  WeaponDetail,
  WeaponIdentity,
  WeaponKind,
  WeaponLink,
  WeaponMaterial,
  WeaponSharpnessProfile,
  WeaponSummary,
  WeaponTreeResult,
  WeaponTypeDefinition,
} from './types'

type Row = Record<string, unknown>

const DATA_VERSION = 'weapon-catalog-v1'
const remoteTypes: Record<GameId, { light: number; heavy: number; bow: number }> = {
  mh3g: { light: 10, heavy: 11, bow: 12 },
  mh4g: { light: 12, heavy: 13, bow: 14 },
  mhgu: { light: 12, heavy: 13, bow: 14 },
}

function int(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function nonNegativeInt(value: unknown): number | null {
  const parsed = int(value)
  return parsed != null && parsed >= 0 ? parsed : null
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function weaponKindFor(gameId: GameId, typeId: number): WeaponKind {
  if (typeId === 6) return 'huntingHorn'
  if (typeId === 8) return 'gunlance'
  if (typeId === 9 || (gameId !== 'mh3g' && typeId === 10)) return 'phialWeapon'
  if (gameId !== 'mh3g' && typeId === 11) return 'insectGlaive'
  const remote = remoteTypes[gameId]
  if (typeId === remote.light || typeId === remote.heavy) return 'bowgun'
  if (typeId === remote.bow) return 'bow'
  return 'standardMelee'
}

function placeholders(keys: string[]): string {
  return keys.map(() => '?').join(',')
}

function pushMap<T>(map: Map<string, T[]>, key: string, value: T): void {
  map.set(key, [...(map.get(key) ?? []), value])
}

function sharpnessOrder(stage: SharpnessStage, direction: 'ASC' | 'DESC'): string {
  const cutoff = stage === 'handicraft2'
    ? 'COALESCE(s.handicraft_2_cutoff, s.handicraft_1_cutoff, s.base_cutoff)'
    : stage === 'handicraft1'
      ? 'COALESCE(s.handicraft_1_cutoff, s.base_cutoff)'
      : 's.base_cutoff'
  const cumulative = {
    red: 's.red',
    orange: '(s.red+s.orange)',
    yellow: '(s.red+s.orange+s.yellow)',
    green: '(s.red+s.orange+s.yellow+s.green)',
    blue: '(s.red+s.orange+s.yellow+s.green+s.blue)',
    white: '(s.red+s.orange+s.yellow+s.green+s.blue+s.white)',
  }
  const rank = `CASE WHEN ${cutoff}>${cumulative.white} THEN 7 WHEN ${cutoff}>${cumulative.blue} THEN 6 WHEN ${cutoff}>${cumulative.green} THEN 5 WHEN ${cutoff}>${cumulative.yellow} THEN 4 WHEN ${cutoff}>${cumulative.orange} THEN 3 WHEN ${cutoff}>${cumulative.red} THEN 2 WHEN ${cutoff}>0 THEN 1 ELSE 0 END`
  const length = `CASE WHEN ${cutoff}>${cumulative.white} THEN MIN(s.purple,${cutoff}-${cumulative.white}) WHEN ${cutoff}>${cumulative.blue} THEN MIN(s.white,${cutoff}-${cumulative.blue}) WHEN ${cutoff}>${cumulative.green} THEN MIN(s.blue,${cutoff}-${cumulative.green}) WHEN ${cutoff}>${cumulative.yellow} THEN MIN(s.green,${cutoff}-${cumulative.yellow}) WHEN ${cutoff}>${cumulative.orange} THEN MIN(s.yellow,${cutoff}-${cumulative.orange}) WHEN ${cutoff}>${cumulative.red} THEN MIN(s.orange,${cutoff}-${cumulative.red}) ELSE MIN(s.red,${cutoff}) END`
  return `s.weapon_key IS NULL ASC, ${rank} ${direction}, ${length} ${direction}, ${cutoff} ${direction}`
}

export class WeaponCatalogRepository {
  private readonly finalKeys = new Map<GameId, Set<string>>()
  private finalWeapons(gameId: GameId): Set<string> {
    if (!this.finalKeys.has(gameId)) this.finalKeys.set(gameId, readFinalWeaponKeys(this.db, gameId))
    return this.finalKeys.get(gameId)!
  }
  constructor(private readonly db: Database.Database) {}

  searchWeapons(filters: WeaponCatalogFilters): PageResult<WeaponSummary> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 100, 1), 100)
    const page = Math.max(filters.page ?? 1, 1)
    const values: unknown[] = [filters.gameId]
    const where = ['w.game_id = ?']
    const exactTarget = Boolean(filters.targetWeaponKey)
    if (filters.targetWeaponKey) {
      where.push('w.weapon_key = ?')
      values.push(filters.targetWeaponKey)
    }
    if (!filters.includePlaceholders) where.push('w.is_placeholder = 0')
    if (!exactTarget) {
      const query = monsterNameQuery(filters.query)?.trim()
      if (query) {
        const numeric = /^0x[0-9a-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
        const queryParts = ['w.name_cn LIKE ?', 'w.name_en LIKE ?', 'w.name_jp LIKE ?']
        const like = `%${query}%`
        values.push(like, like, like)
        if (numeric != null && Number.isSafeInteger(numeric)) {
          queryParts.push('w.save_id = ?', 'w.dex_id = ?')
          values.push(numeric, numeric)
        }
        where.push(`(${queryParts.join(' OR ')})`)
      }
      if (filters.weaponTypeId != null) { where.push('w.type_id = ?'); values.push(filters.weaponTypeId) }
      if (filters.rarity != null) { where.push('w.rarity = ?'); values.push(filters.rarity) }
      if (filters.slots != null) { where.push('w.slots = ?'); values.push(filters.slots) }
      if (filters.directlyProducible) where.push('w.is_directly_producible = 1')
      if (filters.finalOnly) where.push(`(${FINAL_WEAPON_SQL})`)
      if (filters.attributeId === 'none') {
        where.push(`NOT EXISTS (SELECT 1 FROM catalog_weapon_attributes a WHERE a.game_id=w.game_id AND a.weapon_key=w.weapon_key${filters.includeHiddenAttributes === false ? ' AND a.is_hidden=0' : ''})`)
      } else if (typeof filters.attributeId === 'number') {
        where.push(`EXISTS (SELECT 1 FROM catalog_weapon_attributes a WHERE a.game_id=w.game_id AND a.weapon_key=w.weapon_key AND a.attribute_id=?${filters.includeHiddenAttributes === false ? ' AND a.is_hidden=0' : ''})`)
        values.push(filters.attributeId)
      }
    }

    const direction = filters.direction === 'desc' ? 'DESC' : 'ASC'
    const order = filters.sort === 'name'
      ? `w.name_cn COLLATE NOCASE ${direction}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
      : filters.sort === 'rarity'
        ? `w.rarity IS NULL ASC, w.rarity ${direction}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
        : filters.sort === 'attack'
          ? `w.display_attack IS NULL ASC, w.display_attack ${direction}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
          : filters.sort === 'slots'
            ? `w.slots IS NULL ASC, w.slots ${direction}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
            : filters.sort === 'affinity'
              ? `w.affinity IS NULL ASC, w.affinity ${direction}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
              : filters.sort === 'sharpness'
                ? `${sharpnessOrder(filters.sharpnessStage ?? 'base', direction)}, wt.sort_order ASC, w.save_id ASC, COALESCE(w.save_level,-1) ASC`
                : `wt.sort_order ${direction}, w.save_id ${direction}, COALESCE(w.save_level,-1) ${direction}`
    const from = `FROM catalog_weapons w JOIN catalog_weapon_types wt ON wt.game_id=w.game_id AND wt.type_id=w.type_id LEFT JOIN catalog_weapon_sharpness s ON s.game_id=w.game_id AND s.weapon_key=w.weapon_key WHERE ${where.join(' AND ')}`
    const total = int((this.db.prepare(`SELECT count(DISTINCT w.weapon_key) AS count ${from}`).get(...values) as Row | undefined)?.count) ?? 0
    const rows = this.db.prepare(`SELECT w.*,wt.name_cn AS type_name_cn,wt.name_en AS type_name_en ${from} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize) as Row[]
    return { items: this.decorateRows(rows), page, pageSize, total, hasNext: page * pageSize < total }
  }

  getWeapon(identity: WeaponIdentity): WeaponDetail | null {
    const row = this.db.prepare(`SELECT w.*,wt.name_cn AS type_name_cn,wt.name_en AS type_name_en FROM catalog_weapons w JOIN catalog_weapon_types wt ON wt.game_id=w.game_id AND wt.type_id=w.type_id WHERE w.game_id=? AND w.weapon_key=?`).get(identity.gameId, identity.weaponKey) as Row | undefined
    if (!row) return null
    const summary = this.decorateRows([row])[0]
    const materials = this.getMaterials(identity)
    const links = this.getLinks(identity)
    const base = {
      ...summary,
      nameJp: String(row.name_jp ?? ''),
      productionPrice: int(row.production_price),
      upgradePrice: int(row.upgrade_price),
      mappingStatus: String(row.mapping_status ?? ''),
      materials,
      parents: links.parents,
      children: links.children,
    }
    const requireSharpness = (): WeaponSharpnessProfile => {
      if (!summary.sharpness) throw new Error(`近战武器 ${identity.weaponKey} 缺少斩味数据`)
      return summary.sharpness
    }
    if (summary.kind === 'huntingHorn') {
      const horn = this.db.prepare('SELECT * FROM catalog_weapon_hunting_horns WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
      const notes: HuntingHornNote[] = [1, 2, 3].map((position) => ({ id: int(horn[`note${position}_id`]) ?? 0, nameCn: String(horn[`note${position}_name_cn`] ?? ''), nameEn: String(horn[`note${position}_name_en`] ?? '') }))
      const songs = (this.db.prepare('SELECT * FROM catalog_weapon_horn_songs WHERE game_id=? AND weapon_key=? ORDER BY song_id,song_rank_id').all(identity.gameId, identity.weaponKey) as Row[]).map(toSong)
      return { ...base, kind: 'huntingHorn', sharpness: requireSharpness(), notes, songs }
    }
    if (summary.kind === 'gunlance') {
      const shell = this.db.prepare('SELECT * FROM catalog_weapon_gunlances WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
      return { ...base, kind: 'gunlance', sharpness: requireSharpness(), shelling: { typeId: int(shell.shot_type_id) ?? 0, nameCn: String(shell.shot_name_cn ?? ''), nameEn: String(shell.shot_name_en ?? '') } }
    }
    if (summary.kind === 'phialWeapon') {
      const phial = this.db.prepare('SELECT * FROM catalog_weapon_phials WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
      return { ...base, kind: 'phialWeapon', sharpness: requireSharpness(), weaponKind: String(phial.weapon_kind) === 'charge-blade' ? 'chargeBlade' : 'switchAxe', phial: { id: int(phial.phial_id) ?? 0, nameCn: String(phial.phial_name_cn ?? ''), nameEn: String(phial.phial_name_en ?? '') } }
    }
    if (summary.kind === 'insectGlaive') {
      const glaive = this.db.prepare('SELECT * FROM catalog_weapon_insect_glaives WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
      return { ...base, kind: 'insectGlaive', sharpness: requireSharpness(), kinsectType: { id: int(glaive.kinsect_type_id) ?? 0, nameCn: String(glaive.kinsect_type_name_cn ?? ''), nameEn: String(glaive.kinsect_type_name_en ?? '') } }
    }
    if (summary.kind === 'bowgun') {
      const gun = this.getBowgunStats(identity)
      return { ...base, kind: 'bowgun', sharpness: null, weaponKind: summary.typeId === remoteTypes[identity.gameId].light ? 'light' : 'heavy', gun, ammo: this.getAmmo(identity).filter((ammo) => ammo.actionKind !== 'coating') }
    }
    if (summary.kind === 'bow') {
      const bow = this.db.prepare('SELECT * FROM catalog_weapon_bows WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
      const charges = (this.db.prepare('SELECT * FROM catalog_weapon_bow_charges WHERE game_id=? AND weapon_key=? ORDER BY charge_level').all(identity.gameId, identity.weaponKey) as Row[]).map(toCharge)
      return { ...base, kind: 'bow', sharpness: null, bow: { shotModeId: int(bow.shot_mode_id) ?? 0, shotModeNameCn: String(bow.shot_mode_name_cn ?? ''), shotModeNameEn: String(bow.shot_mode_name_en ?? ''), loadUpChargeLevel: nonNegativeInt(bow.load_up_charge_level) }, charges, coatings: this.getAmmo(identity).filter((ammo) => ammo.actionKind === 'coating') }
    }
    return { ...base, kind: 'standardMelee', sharpness: requireSharpness() }
  }

  getWeaponFacets(gameId: GameId): WeaponCatalogFacets {
    const weaponTypes = (this.db.prepare('SELECT * FROM catalog_weapon_types WHERE game_id=? ORDER BY sort_order').all(gameId) as Row[]).map((row): WeaponTypeDefinition => ({ gameId, typeId: int(row.type_id) ?? 0, saveType: int(row.save_type) ?? 0, nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), sortOrder: int(row.sort_order) ?? 0, kind: weaponKindFor(gameId, int(row.type_id) ?? 0) }))
    const attributes = (this.db.prepare(`SELECT attribute_id,kind,name_cn,name_en,MIN(is_hidden) AS is_hidden FROM catalog_weapon_attributes WHERE game_id=? GROUP BY attribute_id,kind,name_cn,name_en ORDER BY attribute_id`).all(gameId) as Row[]).map((row) => ({ attributeId: int(row.attribute_id) ?? 0, kind: String(row.kind ?? ''), nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), isHidden: bool(row.is_hidden) }))
    const rarities = (this.db.prepare('SELECT DISTINCT rarity FROM catalog_weapons WHERE game_id=? AND is_placeholder=0 AND rarity IS NOT NULL ORDER BY rarity').all(gameId) as Row[]).map((row) => int(row.rarity)).filter((value): value is number => value != null)
    const slots = (this.db.prepare('SELECT DISTINCT slots FROM catalog_weapons WHERE game_id=? AND is_placeholder=0 AND slots IS NOT NULL ORDER BY slots').all(gameId) as Row[]).map((row) => int(row.slots)).filter((value): value is number => value != null)
    return { weaponTypes, attributes, rarities, slots, sharpnessStages: gameId === 'mhgu' ? ['base', 'handicraft1', 'handicraft2'] : ['base', 'handicraft1'] }
  }

  getWeaponTree(gameId: GameId, weaponTypeId: number): WeaponTreeResult {
    const rows = this.db.prepare(`SELECT w.*,wt.name_cn AS type_name_cn,wt.name_en AS type_name_en FROM catalog_weapons w JOIN catalog_weapon_types wt ON wt.game_id=w.game_id AND wt.type_id=w.type_id WHERE w.game_id=? AND w.type_id=? AND w.is_placeholder=0 ORDER BY w.dex_id,w.save_id,COALESCE(w.save_level,-1)`).all(gameId, weaponTypeId) as Row[]
    const nodes = this.decorateRows(rows).map((node) => ({ ...node, matchesFilter: true }))
    const edges = (this.db.prepare(`SELECT e.parent_weapon_key,e.child_weapon_key,e.branch_order FROM catalog_weapon_edges e JOIN catalog_weapons p ON p.game_id=e.game_id AND p.weapon_key=e.parent_weapon_key JOIN catalog_weapons c ON c.game_id=e.game_id AND c.weapon_key=e.child_weapon_key WHERE e.game_id=? AND p.type_id=? AND p.is_placeholder=0 AND c.is_placeholder=0 ORDER BY p.dex_id,e.branch_order`).all(gameId, weaponTypeId) as Row[]).map((row) => ({ parentWeaponKey: String(row.parent_weapon_key), childWeaponKey: String(row.child_weapon_key), branchOrder: int(row.branch_order) ?? 0 }))
    return { gameId, weaponTypeId, dataVersion: DATA_VERSION, nodes, edges }
  }

  private decorateRows(rows: Row[]): WeaponSummary[] {
    if (!rows.length) return []
    const gameId = String(rows[0].game_id) as GameId
    const keys = rows.map((row) => String(row.weapon_key))
    const list = placeholders(keys)
    const attributes = new Map<string, WeaponAttribute[]>()
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_attributes WHERE game_id=? AND weapon_key IN (${list}) ORDER BY weapon_key,position`).all(gameId, ...keys) as Row[]) {
      pushMap(attributes, String(row.weapon_key), { attributeId: int(row.attribute_id) ?? 0, kind: String(row.kind ?? ''), nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), value: int(row.value) ?? 0, isHidden: bool(row.is_hidden) })
    }
    const sharpness = new Map<string, WeaponSharpnessProfile>()
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_sharpness WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) sharpness.set(String(row.weapon_key), toSharpness(row))
    const specials = this.getSpecialSummaries(gameId, keys)
    return rows.map((row) => {
      const typeId = int(row.type_id) ?? 0
      const weaponKey = String(row.weapon_key)
      return {
        gameId,
        weaponKey,
        typeId,
        typeNameCn: String(row.type_name_cn ?? ''),
        typeNameEn: String(row.type_name_en ?? ''),
        kind: weaponKindFor(gameId, typeId),
        saveType: int(row.save_type) ?? 0,
        saveId: int(row.save_id) ?? 0,
        saveLevel: int(row.save_level),
        displayLevel: int(row.display_level),
        dexId: int(row.dex_id),
        nameCn: String(row.name_cn ?? ''),
        nameEn: String(row.name_en ?? ''),
        rarity: int(row.rarity),
        displayAttack: int(row.display_attack),
        trueRawAttack: int(row.true_raw_attack),
        affinity: row.affinity == null ? null : Number(row.affinity),
        defense: int(row.defense),
        slots: int(row.slots),
        isDirectlyProducible: bool(row.is_directly_producible),
        isFinalForm: this.finalWeapons(gameId).has(weaponKey),
        iconPath: row.icon_path ? String(row.icon_path) : null,
        isPlaceholder: bool(row.is_placeholder),
        attributes: attributes.get(weaponKey) ?? [],
        sharpness: sharpness.get(weaponKey) ?? null,
        specialSummary: specials.get(weaponKey) ?? [],
      }
    })
  }

  private getSpecialSummaries(gameId: GameId, keys: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>()
    const list = placeholders(keys)
    const add = (key: unknown, text: string) => { if (text && !result.get(String(key))?.includes(text)) pushMap(result, String(key), text) }
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_hunting_horns WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) add(row.weapon_key, [row.note1_name_cn, row.note2_name_cn, row.note3_name_cn].map(String).join(' · '))
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_gunlances WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) add(row.weapon_key, String(row.shot_name_cn ?? ''))
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_phials WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) add(row.weapon_key, String(row.phial_name_cn ?? ''))
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_insect_glaives WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) add(row.weapon_key, String(row.kinsect_type_name_cn ?? ''))
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_bowguns WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) {
      add(row.weapon_key, `装填 ${String(row.reload_name_cn ?? '')}`)
      add(row.weapon_key, `后坐 ${String(row.recoil_name_cn ?? '')}`)
      add(row.weapon_key, `偏移 ${String(row.steadiness_name_cn ?? '')}`)
    }
    const ammoCounts = new Map<string, number>()
    for (const row of this.db.prepare(`SELECT weapon_key,ammo_name_cn,action_kind FROM catalog_weapon_gun_ammo WHERE game_id=? AND weapon_key IN (${list}) AND action_kind!='standard' ORDER BY row_id`).all(gameId, ...keys) as Row[]) {
      const key = String(row.weapon_key)
      const count = ammoCounts.get(key) ?? 0
      if (count < 2) add(key, `${actionLabel(String(row.action_kind))} ${String(row.ammo_name_cn ?? '')}`)
      ammoCounts.set(key, count + 1)
    }
    for (const row of this.db.prepare(`SELECT * FROM catalog_weapon_bows WHERE game_id=? AND weapon_key IN (${list})`).all(gameId, ...keys) as Row[]) add(row.weapon_key, String(row.shot_mode_name_cn ?? ''))
    return result
  }

  private getMaterials(identity: WeaponIdentity): WeaponMaterial[] {
    const rows = this.db.prepare(`SELECT m.*,i.name_cn,i.name_en FROM catalog_weapon_materials m JOIN catalog_items i ON i.game_id=m.game_id AND i.save_id=m.item_save_id WHERE m.game_id=? AND m.weapon_key=? ORDER BY m.material_kind,m.row_id`).all(identity.gameId, identity.weaponKey) as Row[]
    return rows.map((row) => ({ gameId: identity.gameId, saveId: int(row.item_save_id) ?? 0, dexId: int(row.item_dex_id), nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), kind: String(row.material_kind) === 'production' ? 'production' : 'upgrade', quantity: int(row.quantity) ?? 0 }))
  }

  private getLinks(identity: WeaponIdentity): { parents: WeaponLink[]; children: WeaponLink[] } {
    const toLink = (row: Row): WeaponLink => ({ gameId: identity.gameId, weaponKey: String(row.weapon_key), typeId: int(row.type_id) ?? 0, nameCn: String(row.name_cn ?? ''), nameEn: String(row.name_en ?? ''), displayLevel: int(row.display_level) })
    const parents = (this.db.prepare(`SELECT w.weapon_key,w.type_id,w.name_cn,w.name_en,w.display_level FROM catalog_weapon_edges e JOIN catalog_weapons w ON w.game_id=e.game_id AND w.weapon_key=e.parent_weapon_key WHERE e.game_id=? AND e.child_weapon_key=? ORDER BY e.branch_order`).all(identity.gameId, identity.weaponKey) as Row[]).map(toLink)
    const children = (this.db.prepare(`SELECT w.weapon_key,w.type_id,w.name_cn,w.name_en,w.display_level FROM catalog_weapon_edges e JOIN catalog_weapons w ON w.game_id=e.game_id AND w.weapon_key=e.child_weapon_key WHERE e.game_id=? AND e.parent_weapon_key=? ORDER BY e.branch_order`).all(identity.gameId, identity.weaponKey) as Row[]).map(toLink)
    return { parents, children }
  }

  private getBowgunStats(identity: WeaponIdentity): BowgunStats {
    const row = this.db.prepare('SELECT * FROM catalog_weapon_bowguns WHERE game_id=? AND weapon_key=?').get(identity.gameId, identity.weaponKey) as Row
    return { reloadId: int(row.reload_id) ?? 0, reloadNameCn: String(row.reload_name_cn ?? ''), reloadNameEn: String(row.reload_name_en ?? ''), recoilId: int(row.recoil_id) ?? 0, recoilNameCn: String(row.recoil_name_cn ?? ''), recoilNameEn: String(row.recoil_name_en ?? ''), steadinessId: int(row.steadiness_id) ?? 0, steadinessNameCn: String(row.steadiness_name_cn ?? ''), steadinessNameEn: String(row.steadiness_name_en ?? '') }
  }

  private getAmmo(identity: WeaponIdentity): BowgunAmmoRow[] {
    return (this.db.prepare('SELECT * FROM catalog_weapon_gun_ammo WHERE game_id=? AND weapon_key=? ORDER BY row_id').all(identity.gameId, identity.weaponKey) as Row[]).map(toAmmo)
  }
}

function toSharpness(row: Row): WeaponSharpnessProfile {
  return { red: int(row.red) ?? 0, orange: int(row.orange) ?? 0, yellow: int(row.yellow) ?? 0, green: int(row.green) ?? 0, blue: int(row.blue) ?? 0, white: int(row.white) ?? 0, purple: int(row.purple) ?? 0, baseCutoff: int(row.base_cutoff) ?? 0, handicraft1Cutoff: int(row.handicraft_1_cutoff), handicraft2Cutoff: int(row.handicraft_2_cutoff), rawValue: String(row.raw_value ?? '') }
}

function toSong(row: Row): HuntingHornSong {
  return { songId: int(row.song_id) ?? 0, rankId: int(row.song_rank_id) ?? 0, notes: String(row.notes ?? ''), effectNameCn: String(row.effect_name_cn ?? ''), effectNameEn: String(row.effect_name_en ?? ''), encoreEffectNameCn: row.encore_effect_name_cn == null ? null : String(row.encore_effect_name_cn), encoreEffectNameEn: row.encore_effect_name_en == null ? null : String(row.encore_effect_name_en), duration: nonNegativeInt(row.duration), encoreDuration: nonNegativeInt(row.encore_duration) }
}

function toAmmo(row: Row): BowgunAmmoRow {
  const action = String(row.action_kind)
  return { itemSaveId: nonNegativeInt(row.item_save_id), itemDexId: int(row.item_dex_id) ?? 0, nameCn: String(row.ammo_name_cn ?? ''), nameEn: String(row.ammo_name_en ?? ''), loadQuantity: int(row.load_quantity) ?? 0, loadQuantityPlus: nonNegativeInt(row.load_quantity_plus), maxCarry: nonNegativeInt(row.max_carry), specialFireQuantity: nonNegativeInt(row.special_fire_quantity), rapidFireGapNameCn: row.rapid_fire_gap_name_cn == null || String(row.rapid_fire_gap_name_cn) === '---' ? null : String(row.rapid_fire_gap_name_cn), rapidFireGapNameEn: row.rapid_fire_gap_name_en == null || String(row.rapid_fire_gap_name_en) === '---' ? null : String(row.rapid_fire_gap_name_en), actionKind: action === 'rapid-fire' || action === 'siege-fire' || action === 'coating' ? action : 'standard' }
}

function toCharge(row: Row): BowCharge {
  return { level: int(row.charge_level) ?? 0, shotTypeId: int(row.shot_type_id) ?? 0, nameCn: String(row.shot_type_name_cn ?? ''), nameEn: String(row.shot_type_name_en ?? ''), requiresLoadUp: bool(row.requires_load_up) }
}

function actionLabel(action: string): string {
  return action === 'rapid-fire' ? '速射' : action === 'siege-fire' ? '蹲射' : action === 'coating' ? '瓶' : '弹'
}
