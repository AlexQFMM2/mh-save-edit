import type Database from 'better-sqlite3'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { GameId } from '../core/loadout'
import type { SaveArmorAppearance, SaveArmorAppearanceFilters, SaveArmorAppearancePage, SaveEquipmentCell, SaveItemCell, SavePalicoGenerationRules } from './types'
import { armorFallbackIconPath, charmIconPath, weaponFallbackIconPath } from './catalogIconPaths'
import { armorPartForSaveType, ARMOR_APPEARANCE_SPRITE_PATH } from './armorParts'

const require = createRequire(import.meta.url)
const BetterSqlite = require('better-sqlite3') as typeof Database
type Row = Record<string, unknown>
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = (value: unknown, fallback = '') => value == null ? fallback : String(value)

export type SaveCatalogEquipmentIdentity = {
  kind: 'weapon' | 'armor' | 'charm' | 'palico-weapon' | 'palico-head' | 'palico-body'
  saveType: number
  saveId: number
  saveLevel: number | null
  slots: number | null
  nameCn: string
}

export class SaveCatalogResolver {
  private readonly databases = new Map<GameId, Database.Database>()
  constructor(private readonly dataDir: string) {}
  private db(gameId: GameId) {
    const cached = this.databases.get(gameId)
    if (cached) return cached
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const value = new BetterSqlite(join(this.dataDir, `${gameId}.sqlite`), { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    this.databases.set(gameId, value)
    return value
  }
  private hasTable(db: Database.Database, name: string) { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)) }
  item(gameId: GameId, cell: Omit<SaveItemCell, 'nameCn' | 'nameEn' | 'iconPath' | 'maxStack' | 'rarity' | 'diagnostics'>): SaveItemCell {
    const row = cell.itemId ? this.db(gameId).prepare('SELECT name_cn,name_en,icon_path,max_stack,rarity,is_placeholder FROM catalog_items WHERE game_id=? AND save_id=?').get(gameId, cell.itemId) as Row | undefined : undefined
    const diagnostics = !cell.empty && !row ? [{ code: 'item.unknown', path: `items.${cell.slot}`, severity: 'warning' as const, message: `未知道具 ID ${cell.itemId}，原值会被保留` }] : []
    return { ...cell, nameCn: cell.empty ? '空格' : text(row?.name_cn, `未知道具 #${cell.itemId}`), nameEn: text(row?.name_en), iconPath: row?.icon_path ? text(row.icon_path) : null, maxStack: row?.max_stack == null ? null : number(row.max_stack), rarity: row?.rarity == null ? null : number(row.rarity), diagnostics }
  }
  equipment(gameId: GameId, cell: Omit<SaveEquipmentCell, 'nameCn' | 'nameEn' | 'typeNameCn' | 'iconPath' | 'weaponKey' | 'armorDexId' | 'palicoEquipmentId' | 'decorationLabels' | 'skill1NameCn' | 'skill2NameCn' | 'diagnostics'>): SaveEquipmentCell {
    const db = this.db(gameId)
    let row: Row | undefined
    let typeNameCn = ''
    if (cell.kind === 'weapon') {
      row = db.prepare('SELECT weapon_key,name_cn,name_en,icon_path FROM catalog_weapons WHERE game_id=? AND save_type=? AND save_id=? ORDER BY CASE WHEN COALESCE(save_level,0)=? THEN 0 ELSE 1 END,COALESCE(save_level,-1) LIMIT 1').get(gameId, cell.saveType, cell.saveId, cell.level) as Row | undefined
      typeNameCn = text((db.prepare('SELECT name_cn FROM catalog_weapon_types WHERE game_id=? AND save_type=? LIMIT 1').get(gameId, cell.saveType) as Row | undefined)?.name_cn, '武器')
    }
    if (cell.kind === 'armor') {
      row = db.prepare('SELECT a.dex_id,a.name_cn,a.name_en,a.icon_path,a.part FROM catalog_armor_save_identities i JOIN catalog_armors a ON a.game_id=i.game_id AND a.dex_id=i.armor_dex_id WHERE i.game_id=? AND i.save_type=? AND i.save_id=? ORDER BY a.dex_id LIMIT 1').get(gameId, cell.saveType, cell.saveId) as Row | undefined
      typeNameCn = ({ head: '头部', chest: '胸部', arms: '腕部', waist: '腰部', legs: '腿部' } as Record<string, string>)[text(row?.part)] ?? '防具'
    } else if (cell.kind === 'charm') {
      row = this.hasTable(db, 'charm_classes')
        ? db.prepare("SELECT name_cn,name_en FROM charm_classes WHERE save_id=? LIMIT 1").get(cell.saveId) as Row | undefined
        : db.prepare("SELECT name name_cn,english name_en FROM cn__talismans WHERE id=? LIMIT 1").get(cell.saveId) as Row | undefined
      typeNameCn = '护石'
    } else if (cell.kind === 'palico-weapon') {
      row = db.prepare('SELECT equipment_id,name_cn,name_en,icon_path FROM catalog_palico_weapons WHERE game_id=? AND save_id=? LIMIT 1').get(gameId, cell.saveId) as Row | undefined
      typeNameCn = '猫武器'
    } else if (cell.kind === 'palico-head' || cell.kind === 'palico-body') {
      row = db.prepare('SELECT equipment_id,name_cn,name_en,icon_path,part FROM catalog_palico_armors WHERE game_id=? AND save_id=? AND part=? LIMIT 1').get(gameId, cell.saveId, cell.kind === 'palico-head' ? 'head' : 'body') as Row | undefined
      typeNameCn = cell.kind === 'palico-head' ? '猫头部' : '猫身体'
    } else if (cell.kind === 'kinsect') typeNameCn = '猎虫'
    else if (cell.kind === 'unknown') typeNameCn = `未知类型 ${cell.saveType}`
    const diagnostics = !cell.empty && !row && cell.kind !== 'kinsect' ? [{ code: 'equipment.unknown', path: `equipment.${cell.slot}`, severity: 'warning' as const, message: `未映射的${typeNameCn || '装备'}记录，原始字节会被保留` }] : []
    const decorationLabels = cell.decorations.filter(Boolean).map(rawValue => {
      const fixed = gameId === 'mh4g' && Boolean(rawValue & 0x8000)
      const saveId = fixed ? rawValue & 0x7fff : rawValue
      const value = db.prepare('SELECT name_cn,slots FROM catalog_decorations WHERE game_id=? AND save_id=? LIMIT 1').get(gameId, saveId) as Row | undefined
      return { saveId, rawValue, nameCn: text(value?.name_cn, `未知装饰珠 #${saveId}`), slots: value?.slots == null ? null : number(value.slots), fixed }
    })
    const skillName = (skillId: number | null) => skillId ? text((db.prepare('SELECT name_cn FROM catalog_skills WHERE game_id=? AND skill_id=? LIMIT 1').get(gameId, skillId) as Row | undefined)?.name_cn, `未知技能 #${skillId}`) : null
    const typeId = cell.kind === 'weapon'
      ? number((db.prepare('SELECT type_id FROM catalog_weapon_types WHERE game_id=? AND save_type=? LIMIT 1').get(gameId, cell.saveType) as Row | undefined)?.type_id)
      : 0
    const armorPart = (text(row?.part) || armorPartForSaveType(gameId, cell.saveType)) as 'head' | 'chest' | 'arms' | 'waist' | 'legs' | undefined
    const iconPath = cell.kind === 'charm' ? charmIconPath(gameId, cell.saveId) : row?.icon_path ? text(row.icon_path) : cell.kind === 'weapon' ? weaponFallbackIconPath(gameId, typeId) : cell.kind === 'armor' && armorPart ? armorFallbackIconPath(gameId, armorPart) : null
    const appearance = !cell.empty && !cell.kind.toString().startsWith('palico') && (gameId === 'mhgu') && cell.kind === 'armor' && cell.appearanceId ? this.resolveArmorAppearance(gameId, cell.saveType, cell.appearanceId) : null
    if (cell.kind === 'armor' && cell.appearanceId && gameId === 'mhgu' && !appearance) diagnostics.push({ code: 'equipment.appearance.unknown', path: `equipment.${cell.slot}.appearanceId`, severity: 'warning', message: `未映射的防具幻化 ID ${cell.appearanceId}，原值会被保留` })
    return { ...cell, appearance, nameCn: cell.empty ? '空格' : text(row?.name_cn, cell.kind === 'kinsect' ? `猎虫 #${cell.saveId}` : `${typeNameCn || '装备'} #${cell.saveId}`), nameEn: text(row?.name_en), typeNameCn: cell.empty ? '空格' : typeNameCn, iconPath, weaponKey: row?.weapon_key ? text(row.weapon_key) : null, armorDexId: row?.dex_id == null ? null : number(row.dex_id), palicoEquipmentId: row?.equipment_id == null ? null : number(row.equipment_id), decorationLabels, skill1NameCn: skillName(cell.skill1Id), skill2NameCn: skillName(cell.skill2Id), diagnostics }
  }
  searchArmorAppearances(filters: SaveArmorAppearanceFilters): SaveArmorAppearancePage {
    const part = armorPartForSaveType(filters.gameId, filters.saveType)
    if (filters.gameId !== 'mhgu' || !part) throw new Error('幻化查询只支持 GU/XX 猎人防具部位')
    const table = `cn__armor_${part}`
    const page = Math.max(1, filters.page ?? 1); const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 100))
    const query = filters.query?.trim() ?? ''; const like = `%${query}%`; const numericId = /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(query) ? Number(query) : -1
    const where = 'id>0 AND (name LIKE ? OR english LIKE ? OR CAST(id AS TEXT) LIKE ? OR id=?)'
    const args = [like, like, like, numericId]
    const db = this.db('mhgu')
    const total = number((db.prepare(`SELECT count(*) total FROM ${table} WHERE ${where}`).get(...args) as Row).total)
    const rows = db.prepare(`SELECT id,name,english,rarity FROM ${table} WHERE ${where} ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END,id LIMIT ? OFFSET ?`).all(...args, numericId, pageSize, (page - 1) * pageSize) as Row[]
    const items = rows.map(row => this.appearanceFromRow(part, row))
    return { items, total, page, pageSize, hasNext: page * pageSize < total }
  }
  private appearanceFromRow(part: SaveArmorAppearance['part'], row: Row): SaveArmorAppearance {
    return { appearanceId: number(row.id), nameCn: text(row.name), nameEn: text(row.english), nameJp: '', part, rarity: row.rarity == null ? null : number(row.rarity), iconPath: ARMOR_APPEARANCE_SPRITE_PATH, iconSource: 'custom-appearance-sprite', sourceStatus: 'confirmed', iconFallback: false }
  }
  resolveArmorAppearance(gameId: GameId, saveType: number, appearanceId: number): SaveArmorAppearance | null {
    const part = armorPartForSaveType(gameId, saveType)
    if (gameId !== 'mhgu' || !Number.isInteger(appearanceId) || appearanceId <= 0 || !part) return null
    const table = { head: 'cn__armor_head', chest: 'cn__armor_chest', arms: 'cn__armor_arms', waist: 'cn__armor_waist', legs: 'cn__armor_legs' }[part]
    const row = this.db(gameId).prepare(`SELECT id,name,english,rarity FROM ${table} WHERE id=?`).get(appearanceId) as Row | undefined
    if (!row) return null
    return this.appearanceFromRow(part, row)
  }
  palicoLabels(forte: number, target: number) {
    const db = this.db('mhgu')
    const forteRow = db.prepare('SELECT name_cn FROM catalog_palico_types WHERE game_id=? AND type_id=?').get('mhgu', forte) as Row | undefined
    const targetRow = db.prepare('SELECT name FROM cn__palico_targets WHERE id=?').get(target) as Row | undefined
    return { forteNameCn: text(forteRow?.name_cn, `倾向 ${forte}`), targetNameCn: text(targetRow?.name, `目标 ${target}`) }
  }
  palicoGenerationRules(): SavePalicoGenerationRules | null {
    const db = this.db('mhgu')
    if (!this.hasTable(db, 'catalog_palico_generation_patterns') || !this.hasTable(db, 'catalog_palico_forte_grants') || !this.hasTable(db, 'catalog_palico_generation_pool')) return null
    const patterns = db.prepare('SELECT scope,pattern_id,sequence,valid_length,weight FROM catalog_palico_generation_patterns WHERE game_id=? ORDER BY scope,pattern_id').all('mhgu') as Row[]
    const grants = db.prepare('SELECT forte_id,kind,role,entry_id FROM catalog_palico_forte_grants WHERE game_id=? ORDER BY forte_id,kind,role,entry_id').all('mhgu') as Row[]
    const pools = db.prepare('SELECT kind,generation_group,entry_id FROM catalog_palico_generation_pool WHERE game_id=? ORDER BY kind,generation_group,entry_id').all('mhgu') as Row[]
    if (!patterns.length || !grants.length || !pools.length) return null
    return {
      patterns: patterns.map(row => ({ scope: text(row.scope) as SavePalicoGenerationRules['patterns'][number]['scope'], patternId: number(row.pattern_id), sequence: text(row.sequence), validLength: number(row.valid_length), weight: number(row.weight) })),
      grants: grants.map(row => ({ forteId: number(row.forte_id), kind: text(row.kind) as SavePalicoGenerationRules['grants'][number]['kind'], role: text(row.role) as SavePalicoGenerationRules['grants'][number]['role'], entryId: number(row.entry_id) })),
      pools: pools.map(row => ({ kind: text(row.kind) as SavePalicoGenerationRules['pools'][number]['kind'], group: text(row.generation_group) as SavePalicoGenerationRules['pools'][number]['group'], entryId: number(row.entry_id) })),
      source: 'MHGU/XX 原生猎猫生成表',
    }
  }
  itemSearchIds(gameId: GameId, query: string): Set<number> {
    const like = `%${query.trim()}%`
    const rows = this.db(gameId).prepare('SELECT save_id FROM catalog_items WHERE game_id=? AND (name_cn LIKE ? OR name_en LIKE ? OR name_jp LIKE ?)').all(gameId, like, like, like) as Row[]
    return new Set(rows.map(row => number(row.save_id)))
  }
  itemKnown(gameId: GameId, saveId: number): boolean { if (!saveId) return true; try { return Boolean(this.db(gameId).prepare('SELECT 1 FROM catalog_items WHERE game_id=? AND save_id=?').get(gameId, saveId)) } catch { return false } }
  requireItem(gameId: GameId, saveId: number): { maxStack: number | null; nameCn: string } {
    const row = this.db(gameId).prepare('SELECT name_cn,max_stack FROM catalog_items WHERE game_id=? AND save_id=? AND is_placeholder=0').get(gameId, saveId) as Row | undefined
    if (!row) throw new Error(`道具 ID ${saveId} 不属于 ${gameId.toUpperCase()} 的可用图鉴资料`)
    return { maxStack: row.max_stack == null ? null : number(row.max_stack), nameCn: text(row.name_cn) }
  }
  resolveEquipmentIdentity(gameId: GameId, saveType: number, saveId: number, palico: boolean, saveLevel?: number): SaveCatalogEquipmentIdentity | null {
    if (!saveType || !saveId) return null
    const db = this.db(gameId)
    if (palico) {
      if (gameId !== 'mhgu') return null
      if (saveType === 22) {
        const row = db.prepare('SELECT name_cn FROM catalog_palico_weapons WHERE game_id=? AND save_id=?').get(gameId, saveId) as Row | undefined
        return row ? { kind: 'palico-weapon', saveType, saveId, saveLevel: null, slots: null, nameCn: text(row.name_cn) } : null
      }
      if (saveType === 23 || saveType === 24) {
        const part = saveType === 23 ? 'head' : 'body'
        const row = db.prepare('SELECT name_cn FROM catalog_palico_armors WHERE game_id=? AND save_id=? AND part=?').get(gameId, saveId, part) as Row | undefined
        return row ? { kind: saveType === 23 ? 'palico-head' : 'palico-body', saveType, saveId, saveLevel: null, slots: null, nameCn: text(row.name_cn) } : null
      }
      return null
    }
    if (saveType === 6) {
      const row = this.hasTable(db, 'charm_classes')
        ? db.prepare('SELECT name_cn,NULL max_slots FROM charm_classes WHERE save_id=?').get(saveId) as Row | undefined
        : db.prepare('SELECT name name_cn,max_slots FROM cn__talismans WHERE id=?').get(saveId) as Row | undefined
      return row ? { kind: 'charm', saveType, saveId, saveLevel: null, slots: row.max_slots == null ? null : number(row.max_slots), nameCn: text(row.name_cn) } : null
    }
    if (saveType >= 7) {
      const levelClause = saveLevel == null ? '' : ' AND COALESCE(save_level,0)=?'
      const values = saveLevel == null ? [gameId, saveType, saveId] : [gameId, saveType, saveId, saveLevel]
      const row = db.prepare(`SELECT name_cn,COALESCE(save_level,0) save_level,slots FROM catalog_weapons WHERE game_id=? AND save_type=? AND save_id=? AND is_placeholder=0${levelClause} ORDER BY COALESCE(save_level,0) LIMIT 1`).get(...values) as Row | undefined
      return row ? { kind: 'weapon', saveType, saveId, saveLevel: number(row.save_level), slots: row.slots == null ? null : number(row.slots), nameCn: text(row.name_cn) } : null
    }
    if (saveType >= 1 && saveType <= 5) {
      const expectedPart = armorPartForSaveType(gameId, saveType)
      const row = db.prepare('SELECT a.name_cn,a.slots FROM catalog_armor_save_identities i JOIN catalog_armors a ON a.game_id=i.game_id AND a.dex_id=i.armor_dex_id WHERE i.game_id=? AND i.save_type=? AND i.save_id=? AND a.part=? AND a.is_placeholder=0 ORDER BY a.dex_id LIMIT 1').get(gameId, saveType, saveId, expectedPart) as Row | undefined
      return row ? { kind: 'armor', saveType, saveId, saveLevel: null, slots: row.slots == null ? null : number(row.slots), nameCn: text(row.name_cn) } : null
    }
    return null
  }
  requireEquipmentIdentity(gameId: GameId, saveType: number, saveId: number, palico: boolean, saveLevel?: number): SaveCatalogEquipmentIdentity {
    const value = this.resolveEquipmentIdentity(gameId, saveType, saveId, palico, saveLevel)
    if (!value) throw new Error(`装备类型 ${saveType} / ID ${saveId}${saveLevel == null ? '' : ` / 等级 ${saveLevel}`} 不属于 ${gameId.toUpperCase()} 的可用图鉴资料`)
    return value
  }
  equipmentKnown(gameId: GameId, saveType: number, saveId: number, palico: boolean): boolean {
    if (!saveType) return true
    try { return this.resolveEquipmentIdentity(gameId, saveType, saveId, palico) != null } catch { return false }
  }
  equipmentSearchKeys(gameId: GameId, query: string, palico: boolean): Set<string> {
    const db = this.db(gameId); const like = `%${query.trim()}%`; const result = new Set<string>()
    if (palico) {
      for (const row of db.prepare('SELECT 22 save_type,save_id FROM catalog_palico_weapons WHERE game_id=? AND (name_cn LIKE ? OR name_en LIKE ? OR name_jp LIKE ?) UNION ALL SELECT CASE part WHEN \'head\' THEN 23 ELSE 24 END save_type,save_id FROM catalog_palico_armors WHERE game_id=? AND (name_cn LIKE ? OR name_en LIKE ? OR name_jp LIKE ?)').all(gameId, like, like, like, gameId, like, like, like) as Row[]) result.add(`${number(row.save_type)}:${number(row.save_id)}`)
      return result
    }
    for (const row of db.prepare('SELECT save_type,save_id FROM catalog_weapons WHERE game_id=? AND (name_cn LIKE ? OR name_en LIKE ? OR name_jp LIKE ?) UNION SELECT i.save_type,i.save_id FROM catalog_armor_save_identities i JOIN catalog_armors a ON a.game_id=i.game_id AND a.dex_id=i.armor_dex_id WHERE i.game_id=? AND (a.name_cn LIKE ? OR a.name_en LIKE ? OR a.name_jp LIKE ?)').all(gameId, like, like, like, gameId, like, like, like) as Row[]) result.add(`${number(row.save_type)}:${number(row.save_id)}`)
    const charms = this.hasTable(db, 'charm_classes')
      ? db.prepare('SELECT save_id FROM charm_classes WHERE name_cn LIKE ? OR name_en LIKE ?').all(like, like) as Row[]
      : db.prepare('SELECT id save_id FROM cn__talismans WHERE name LIKE ? OR english LIKE ?').all(like, like) as Row[]
    for (const row of charms) result.add(`6:${number(row.save_id)}`)
    return result
  }
  close() { for (const database of this.databases.values()) database.close(); this.databases.clear() }
}
