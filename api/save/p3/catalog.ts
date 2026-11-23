import type Database from 'better-sqlite3'
import { p3ArmorKeySchema } from '../../catalog/p3ArmorSchemas'
import { p3WeaponKeySchema } from '../../catalog/p3WeaponSchemas'
import { P3ArmorCatalogRepository } from '../../catalog/p3ArmorRepository'
import { P3DecorationCatalogRepository } from '../../catalog/p3DecorationRepository'
import { P3ItemCatalogRepository } from '../../catalog/p3ItemRepository'
import { P3SkillCatalogRepository } from '../../catalog/p3SkillRepository'
import { P3WeaponCatalogRepository } from '../../catalog/p3WeaponRepository'
import type { SaveDocumentAdapter } from '../adapters/types'
import type { P3EquipmentChanges, SaveDiagnostic, SaveEquipmentCell } from '../types'
import { P3_CHARM_GRADES, P3_CHARM_TYPE, p3EquipmentKey, p3WeaponBoostMask, readP3Charm, writeP3Charm } from './equipment'

export class P3SaveCatalog {
  private items?: P3ItemCatalogRepository
  private armors?: P3ArmorCatalogRepository
  private weapons?: P3WeaponCatalogRepository
  private decorations?: P3DecorationCatalogRepository
  private skills?: P3SkillCatalogRepository

  constructor(private readonly db: Database.Database) {}

  private itemRepo() { return this.items ??= new P3ItemCatalogRepository(this.db) }
  private armorRepo() { return this.armors ??= new P3ArmorCatalogRepository(this.db) }
  private weaponRepo() { return this.weapons ??= new P3WeaponCatalogRepository(this.db) }
  private decorationRepo() { return this.decorations ??= new P3DecorationCatalogRepository(this.db, this.itemRepo()) }
  private skillRepo() { return this.skills ??= new P3SkillCatalogRepository(this.db, this.decorationRepo()) }

  private lookup(key: string) {
    if (p3ArmorKeySchema.safeParse(key).success) return this.armorRepo().getArmor({ gameId: 'mhp3', armorKey: key })
    if (p3WeaponKeySchema.safeParse(key).success) return this.weaponRepo().getWeapon({ gameId: 'mhp3', weaponKey: key })
    return null
  }

  private entry(type: number, id: number) {
    const key = p3EquipmentKey(type, id)
    if (!key) return null
    return this.lookup(key)
  }

  known(type: number, id: number) {
    return type === P3_CHARM_TYPE || this.entry(type, id) != null
  }

  itemSearch(query: string): Set<number> {
    const ids = new Set<number>()
    for (let page = 1; ; page++) {
      const result = this.itemRepo().searchItems({ gameId: 'mhp3', query, includePlaceholders: true, page, pageSize: 100 })
      for (const item of result.items) ids.add(item.itemId)
      if (!result.hasNext) return ids
    }
  }

  equipmentSearch(query: string): Set<string> {
    const keys = new Set<string>()
    P3_CHARM_GRADES.forEach((name, grade) => {
      if (name.includes(query)) keys.add(`${P3_CHARM_TYPE}:${grade}`)
    })
    for (let page = 1; ; page++) {
      const result = this.armorRepo().searchArmors({ gameId: 'mhp3', query, scope: 'all', page, pageSize: 100 })
      for (const armor of result.items) keys.add(`${armor.nativeType}:${armor.nativeId}`)
      if (!result.hasNext) break
    }
    for (let page = 1; ; page++) {
      const result = this.weaponRepo().searchWeapons({ gameId: 'mhp3', query, scope: 'all', page, pageSize: 100 })
      for (const weapon of result.items) keys.add(`${weapon.nativeType}:${weapon.nativeId}`)
      if (!result.hasNext) return keys
    }
  }

  equipment(cell: ReturnType<SaveDocumentAdapter['equipment']>): SaveEquipmentCell {
    const entry = cell.kind === 'armor' || cell.kind === 'weapon' ? this.entry(cell.saveType, cell.saveId) : null
    const armor = entry && 'armorKey' in entry ? entry : null
    const weapon = entry && 'weaponKey' in entry ? entry : null
    const grade = cell.charmGrade == null ? undefined : P3_CHARM_GRADES[cell.charmGrade]
    const slots = entry?.slots ?? cell.slots
    const diagnostics: SaveDiagnostic[] = []
    const warn = (code: string, message: string) => diagnostics.push({ code, path: `equipment.${cell.slot}`, severity: 'warning', message })
    if (!cell.empty && !entry && !grade) warn('equipment.unknown', '未映射的装备记录，原始数据已保留')
    if (cell.upgrade && cell.upgrade.value > cell.upgrade.naturalMaximum) warn('equipment.upgrade.unusual', '强化次数超过本作自然上限，原值已保留')
    if (armor && armor.acquisitionStatus !== 'obtainable' || weapon && weapon.acquisitionStatus !== 'obtainable') warn('equipment.acquisition.unverified', '装备的正常取得方式未确认')
    if (cell.kind === 'charm') warn('equipment.charm.unverified', '仅校验护石结构，随机鉴定能否取得此组合未确认')
    const decorationLabels = cell.decorations.filter(Boolean).map(itemId => {
      const d = this.decorationRepo().getDecoration({ gameId: 'mhp3', itemId })
      if (!d) warn('equipment.decoration.unknown', `未知装饰品 #${itemId}，原值已保留`)
      return { saveId: itemId, rawValue: itemId, nameCn: d?.nameCn ?? `未知装饰品 #${itemId}`, slots: d?.slots ?? null, fixed: false }
    })
    if (slots != null && decorationLabels.reduce((sum, row) => sum + (row.slots ?? 0), 0) > slots) {
      warn('equipment.decoration.capacity', '装饰品占孔超过本作天然孔位')
    }
    const skillName = (id: number | null) => id ? this.skillRepo().getSkill(id)?.nameCn ?? `未知技能 #${id}` : null
    const partNames = { chest: '胴部', arms: '腕部', waist: '腰部', legs: '脚部', head: '头部' }
    return {
      ...cell, slots, upgrade: entry ? cell.upgrade : undefined,
      nameCn: cell.empty ? '空格' : entry?.nameCn ?? grade ?? `未知装备 #${cell.saveType}:${cell.saveId}`,
      nameEn: entry?.nameEn ?? '', typeNameCn: weapon?.typeNameCn ?? (armor ? partNames[armor.part] : grade ? '护石' : ''),
      iconPath: entry?.iconPath ?? null, armorKey: armor?.armorKey ?? null, weaponKey: weapon?.weaponKey ?? null,
      armorDexId: null, palicoEquipmentId: null, decorationLabels,
      skill1NameCn: skillName(cell.skill1Id), skill2NameCn: skillName(cell.skill2Id), diagnostics,
    }
  }

  patch(source: Buffer, changes: P3EquipmentChanges): Buffer {
    const record = changes.selection ? Buffer.alloc(12) : Buffer.from(source)
    if (changes.selection) {
      record[0] = 1
      if (changes.selection.kind === 'charm') {
        if (!changes.charm) throw new Error('请选择护石属性')
        record[1] = P3_CHARM_TYPE
      } else {
        const entry = this.lookup(changes.selection.key)
        if (!entry || entry.acquisitionStatus !== 'obtainable' || ('armorKey' in entry ? 'armor' : 'weapon') !== changes.selection.kind) {
          throw new Error('装备身份与 P3 图鉴不匹配，或正常取得方式未确认')
        }
        record[1] = entry.nativeType
        record.writeUInt16LE(entry.nativeId, 2)
      }
    }
    const type = record[1], charm = type === P3_CHARM_TYPE
    if (!record[0] || !charm && !this.entry(type, record.readUInt16LE(2))) throw new Error('请选择能够识别的 P3 装备')
    if (changes.charm) {
      if (!charm) throw new Error('该记录并非 P3 护石')
      const before = readP3Charm(source)
      for (const key of ['skill1Id', 'skill2Id'] as const) {
        const id = changes.charm[key]
        if (id && (changes.selection || id !== before[key]) && !this.skillRepo().getSkill(id)) throw new Error(`P3 技能 #${id} 未收录`)
      }
      writeP3Charm(record, changes.charm)
    }
    if (changes.level != null) {
      const level = changes.level
      if (charm || !Number.isInteger(level) || level < 0 || level > (type < 5 ? 255 : 1)) throw new Error('P3 强化字段超出编码范围')
      if (type < 5) record[4] = level
      else {
        const mask = p3WeaponBoostMask(type)
        if (Boolean(record[4] & mask) !== Boolean(level)) record[4] = (record[4] & ~mask) | level
      }
    }
    if (changes.decorations) {
      if (changes.decorations.length > 3 || changes.decorations.some(id => !Number.isInteger(id) || id < 0 || id > 0xffff)) {
        throw new Error('P3 装饰品记录超出编码范围')
      }
      const previous = [6, 8, 10].map(offset => record.readUInt16LE(offset))
      const remaining = [...previous]
      for (const id of changes.decorations) {
        const existing = remaining.indexOf(id)
        if (existing >= 0) remaining.splice(existing, 1)
        else if (id && !this.decorationRepo().getDecoration({ gameId: 'mhp3', itemId: id })) throw new Error(`P3 装饰品 #${id} 未收录`)
      }
      for (const [index, offset] of [6, 8, 10].entries()) record.writeUInt16LE(changes.decorations[index] ?? 0, offset)
    }
    return record
  }
}
