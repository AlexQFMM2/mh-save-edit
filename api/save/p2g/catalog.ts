import type Database from 'better-sqlite3'
import type { P2gArmorSummary } from '../../catalog/p2gArmorTypes'
import type { P2gWeaponSummary } from '../../catalog/p2gWeaponTypes'
import { P2gDecorationCatalogRepository } from '../../catalog/p2gDecorationRepository'
import type { SaveDocumentAdapter } from '../adapters/types'
import type { SaveEquipmentCell, SaveDiagnostic, SaveCommand } from '../types'
import type { SaveCatalogEquipmentIdentity } from '../catalogResolver'
import { p2gEquipmentKey, p2gSaveIdentity } from './identity'

export class P2gSaveCatalog {
  private readonly entries = new Map<string, P2gWeaponSummary | P2gArmorSummary>()
  private readonly decorations: P2gDecorationCatalogRepository
  constructor(db: Database.Database) {
    for (const table of ['p2g_weapons', 'p2g_armors']) for (const row of db.prepare(`SELECT detail_json FROM ${table}`).all() as { detail_json: string }[]) {
      const detail = JSON.parse(row.detail_json) as P2gWeaponSummary | P2gArmorSummary
      this.entries.set('weaponKey' in detail ? detail.weaponKey : detail.armorKey, detail)
    }
    this.decorations = new P2gDecorationCatalogRepository(db)
  }
  identity(saveType: number, saveId: number, palico: boolean): SaveCatalogEquipmentIdentity | null {
    const key = p2gEquipmentKey(saveType, saveId), entry = key ? this.entries.get(key) : undefined
    return !palico && entry && !('isPlaceholder' in entry && entry.isPlaceholder) ? { kind: saveType <= 4 ? 'armor' : 'weapon', saveType, saveId, saveLevel: null, slots: entry.slots, nameCn: entry.nameCn } : null
  }
  patch(source: Buffer, changes: Extract<SaveCommand, { kind: 'set-equipment-fields' }>['changes']): Buffer {
    const r = Buffer.from(source), saveType = changes.saveType ?? r[1], saveId = changes.saveId ?? r.readUInt16LE(2)
    if (changes.appearanceId || changes.slots != null || changes.skill1Id != null || changes.skill2Id != null || changes.skill1Points != null || changes.skill2Points != null) throw new Error('P2G 不支持护石或幻化字段')
    if ((changes.saveType != null || changes.saveId != null) && !this.identity(saveType, saveId, false)) throw new Error('P2G 装备身份尚未确认，不能创建此记录')
    if (changes.saveType != null) { r[0] = 1; r[1] = saveType }
    if (changes.saveId != null) { r[0] = 1; r.writeUInt16LE(saveId, 2) }
    if (!r[0] || saveType > 6) throw new Error('空格或未确认的特殊装备不能修改实例字段')
    const key = p2gEquipmentKey(saveType, saveId), entry = key ? this.entries.get(key) : undefined
    if (changes.level != null) {
      const level = changes.level, gun = entry && 'weaponKey' in entry && saveType === 6 && entry.typeId !== 14
      if (!Number.isInteger(level) || level < 0 || level > (gun ? 15 : 255)) throw new Error('强化次数超出字段编码范围')
      if (saveType <= 4) r[4] = level
      else if (gun) r[4] = (r[4] & 0xf0) | level
      else if (level !== 0) throw new Error('近战武器和弓没有已确认的强化次数字段')
    }
    if (changes.decorations) {
      if (changes.decorations.length > 3 || changes.decorations.some(n => !Number.isInteger(n) || n < 0 || n > 65535)) throw new Error('装饰品记录超出编码范围')
      const values = changes.decorations.filter(Boolean)
      for (let i = 0; i < 3; i++) r.writeUInt16LE(values[i] ?? 0, 6 + i * 2)
    }
    return r
  }
  equipment(cell: ReturnType<SaveDocumentAdapter['equipment']>): SaveEquipmentCell {
    const key = p2gEquipmentKey(cell.saveType, cell.saveId), entry = !cell.empty && key ? this.entries.get(key) : undefined
    const armor = entry && 'armorKey' in entry ? entry : undefined, weapon = entry && 'weaponKey' in entry ? entry : undefined
    const upgrade = armor ? { label: '防具强化次数', maximum: 255, naturalMaximum: Math.min(63, Math.floor((armor.maxDefense - armor.baseDefense) / 2)), value: cell.level }
      : weapon && cell.saveType === 6 && weapon.typeId !== 14 ? { label: '弩强化次数（等级 = 次数 + 1）', maximum: 15, naturalMaximum: 4, value: cell.level } : undefined
    const diagnostics: SaveDiagnostic[] = []
    const warn = (code: string, message: string) => diagnostics.push({ code, path: `equipment.${cell.slot}`, severity: 'warning', message })
    if (!cell.empty && !entry) warn('equipment.unknown', '未映射的装备记录；未知字段保持原样')
    if (upgrade && upgrade.value > upgrade.naturalMaximum) warn('equipment.upgrade.unusual', `强化次数 ${upgrade.value} 超过自然上限 ${upgrade.naturalMaximum}，原值保留`)
    const decorationLabels = cell.decorations.filter(Boolean).map(saveId => {
      const d = this.decorations.getDecoration({ gameId: 'mhp2g', itemId: saveId })
      if (!d) warn('equipment.decoration.unknown', `未知装饰品 #${saveId}，原值保留`)
      return { saveId, rawValue: saveId, nameCn: d?.nameCn ?? `未知装饰品 #${saveId}`, slots: d?.slots ?? null, fixed: false }
    })
    if (entry && decorationLabels.reduce((sum, d) => sum + (d.slots ?? 0), 0) > entry.slots) warn('equipment.decoration.capacity', '装饰品占孔超过装备孔位；记录可编码，但不符合自然装珠规则')
    return { ...cell, upgrade, slots: entry?.slots ?? null, nameCn: cell.empty ? '空格' : entry?.nameCn ?? `未知装备 #${cell.saveType}:${cell.saveId}`, nameEn: entry?.nameEn ?? '', typeNameCn: armor ? { head: '头部', chest: '胸部', arms: '腕部', waist: '腰部', legs: '腿部' }[armor.part] : weapon?.typeNameCn ?? '', iconPath: entry?.iconPath ?? null, weaponKey: weapon?.weaponKey ?? null, armorKey: armor?.armorKey ?? null, armorDexId: null, palicoEquipmentId: null, decorationLabels, skill1NameCn: null, skill2NameCn: null, diagnostics }
  }
  search(query: string): Set<string> {
    const q = query.trim().toLocaleLowerCase(), result = new Set<string>()
    for (const [key, value] of this.entries) if (`${value.nameCn} ${value.nameEn} ${value.nameJp}`.toLocaleLowerCase().includes(q)) {
      const { saveType, saveId } = p2gSaveIdentity(key); result.add(`${saveType}:${saveId}`)
    }
    return result
  }
}
