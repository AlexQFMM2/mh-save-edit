import { useEffect, useState } from 'react'
import type { LoadoutArmorCandidate, LoadoutInstanceState, LoadoutRelicLookup, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import { replaceRelicRecord } from '../../../api/loadout/relic'
import { RelicArmorAdvancedFields } from '../RelicArmorAdvancedFields/RelicArmorAdvancedFields'
import { RelicWeaponAdvancedFields } from '../RelicWeaponAdvancedFields/RelicWeaponAdvancedFields'
import './RelicEquipmentEditor.css'

type Candidate = LoadoutWeaponCandidate | LoadoutArmorCandidate
export function RelicEquipmentEditor({ candidate, lookups, onChange }: { candidate: Candidate; lookups: LoadoutRelicLookup[]; onChange: (value: Candidate) => void }) {
  const instance = candidate.instance
  const [raw, setRaw] = useState(instance?.recordHex ?? '')
  useEffect(() => setRaw(instance?.recordHex ?? ''), [candidate.candidateKey, instance?.recordHex])
  if (!instance) return null
  const update = (value: LoadoutInstanceState) => {
    setRaw(value.recordHex)
    const byte = (offset: number) => Number.parseInt(value.recordHex.slice(offset * 2, offset * 2 + 2), 16)
    if (candidate.kind === 'weapon') {
      const common: LoadoutWeaponCandidate = { ...candidate, instance: value, slots: (byte(0x10) >> 2) & 3, rarity: byte(0x11) + 1 }
      const match = lookups.find(item => item.kind === 'relic_weapon_attack_values' && Number(item.payload.save_type) === candidate.saveType && Number(item.payload.code) === byte(0x0d))
      onChange(match ? { ...common, attack: Number(match.payload.true_attack), affinity: Number(match.payload.affinity), defense: Number(match.payload.defense) } : common)
      return
    }
    const common: LoadoutArmorCandidate = { ...candidate, instance: value, slots: (byte(0x10) >> 2) & 3, rarity: byte(0x11) + 1 }
    const defense = lookups.find(item => item.kind === 'relic_armor_defense_values' && Number(item.payload.code) === byte(0x0d))
    const resistance = lookups.find(item => item.kind === 'relic_armor_resistance_values' && Number(item.payload.code) === byte(0x0c))
    onChange({ ...common, baseDefense: defense ? Number(defense.payload.defense) : common.baseDefense, maxDefense: defense ? Number(defense.payload.defense) : common.maxDefense, fireRes: resistance ? Number(resistance.payload.fire_res) : common.fireRes, waterRes: resistance ? Number(resistance.payload.water_res) : common.waterRes, thunderRes: resistance ? Number(resistance.payload.thunder_res) : common.thunderRes, iceRes: resistance ? Number(resistance.payload.ice_res) : common.iceRes, dragonRes: resistance ? Number(resistance.payload.dragon_res) : common.dragonRes })
  }
  return <section className="relic-equipment-editor"><h3 className="relic-equipment-editor__title">发掘装备高级编辑</h3>{candidate.kind === 'weapon' ? <RelicWeaponAdvancedFields instance={instance} weaponTypeId={candidate.typeId} onChange={update} /> : <RelicArmorAdvancedFields instance={instance} onChange={update} />}<label className="relic-equipment-editor__raw"><span className="relic-equipment-editor__raw-label">完整 28 字节记录</span><input className="relic-equipment-editor__raw-input" value={raw} aria-invalid={instance.encoding === 'blocked'} onChange={event => { const value = replaceRelicRecord(instance, event.target.value); setRaw(event.target.value); if (value.encoding === 'blocked') onChange({ ...candidate, instance: value }); else update(value) }} /></label><div className="relic-equipment-editor__diagnostics" aria-live="polite">{instance.encoding === 'blocked' ? '结构不可编码；请修正为 56 位十六进制。' : `${instance.patches?.length ?? 0} 个字段补丁；未知位保持原样。`}</div></section>
}
