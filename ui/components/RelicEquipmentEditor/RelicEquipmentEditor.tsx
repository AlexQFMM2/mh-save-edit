import type { LoadoutArmorCandidate, LoadoutDecoration, LoadoutInstanceState, LoadoutRelicLookup, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import { RelicArmorAdvancedFields } from '../RelicArmorAdvancedFields/RelicArmorAdvancedFields'
import { RelicWeaponAdvancedFields } from '../RelicWeaponAdvancedFields/RelicWeaponAdvancedFields'
import './RelicEquipmentEditor.css'

type Candidate = LoadoutWeaponCandidate | LoadoutArmorCandidate
type Props = {
  candidate: Candidate
  lookups: LoadoutRelicLookup[]
  decorations: LoadoutDecoration[]
  onChange: (value: Candidate) => void
}

function decorationsFromRecord(recordHex: string, definitions: LoadoutDecoration[]): LoadoutDecoration[] {
  return [0x06, 0x08, 0x0a].flatMap(offset => {
    const littleEndian = recordHex.slice(offset * 2 + 2, offset * 2 + 4) + recordHex.slice(offset * 2, offset * 2 + 2)
    const value = Number.parseInt(littleEndian, 16) || 0
    const saveId = value & 0x7fff
    if (!saveId) return []
    const definition = definitions.find(item => item.saveId === saveId)
    return [{ ...(definition ?? { saveId, nameCn: `未知装饰珠 #${saveId}`, slots: 0, skills: [] }), fixed: Boolean(value & 0x8000) }]
  })
}

export function RelicEquipmentEditor({ candidate, lookups, decorations, onChange }: Props) {
  const instance = candidate.instance
  if (!instance) return null

  const update = (value: LoadoutInstanceState) => {
    const byte = (offset: number) => Number.parseInt(value.recordHex.slice(offset * 2, offset * 2 + 2), 16)
    const embeddedDecorations = decorationsFromRecord(value.recordHex, decorations)
    if (candidate.kind === 'weapon') {
      const common: LoadoutWeaponCandidate = { ...candidate, instance: value, decorations: embeddedDecorations, slots: (byte(0x10) >> 2) & 3, rarity: byte(0x11) + 1 }
      const match = lookups.find(item => item.kind === 'relic_weapon_attack_values' && Number(item.payload.save_type) === candidate.saveType && Number(item.payload.code) === byte(0x0d))
      onChange(match ? { ...common, attack: Number(match.payload.true_attack), affinity: Number(match.payload.affinity), defense: Number(match.payload.defense) } : common)
      return
    }
    const common: LoadoutArmorCandidate = { ...candidate, instance: value, decorations: embeddedDecorations, slots: (byte(0x10) >> 2) & 3, rarity: byte(0x11) + 1 }
    const defense = lookups.find(item => item.kind === 'relic_armor_defense_values' && Number(item.payload.code) === byte(0x0d))
    const resistance = lookups.find(item => item.kind === 'relic_armor_resistance_values' && Number(item.payload.code) === byte(0x0c))
    onChange({ ...common, baseDefense: defense ? Number(defense.payload.defense) : common.baseDefense, maxDefense: defense ? Number(defense.payload.defense) : common.maxDefense, fireRes: resistance ? Number(resistance.payload.fire_res) : common.fireRes, waterRes: resistance ? Number(resistance.payload.water_res) : common.waterRes, thunderRes: resistance ? Number(resistance.payload.thunder_res) : common.thunderRes, iceRes: resistance ? Number(resistance.payload.ice_res) : common.iceRes, dragonRes: resistance ? Number(resistance.payload.dragon_res) : common.dragonRes })
  }

  return <section className="relic-equipment-editor">
    <h3 className="relic-equipment-editor__title">发掘装备高级编辑</h3>
    {candidate.kind === 'weapon'
      ? <RelicWeaponAdvancedFields instance={instance} weaponTypeId={candidate.typeId} saveType={candidate.saveType} lookups={lookups} decorations={decorations} onChange={update} />
      : <RelicArmorAdvancedFields instance={instance} saveType={candidate.saveType ?? 0} lookups={lookups} decorations={decorations} onChange={update} />}
    <div className="relic-equipment-editor__diagnostics" aria-live="polite">{instance.encoding === 'blocked' ? '结构不可编码，请重新选择发掘模板。' : `${instance.patches?.length ?? 0} 个参数已修改；完整 28 字节记录和未知位均自动保留。`}</div>
  </section>
}
