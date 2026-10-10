import { useEffect, useState } from 'react'
import { validateRelicRecordHex } from '../../../api/loadout/relic'
import { readRelicField, relicArmorFields, relicWeaponFields } from '../../../api/loadout/relicFields'
import type { LoadoutRelicLookup } from '../../../api/loadout/types'
import type { SaveEquipmentCell } from '../../../api/save/types'
import { relicLookupOptions } from '../RelicLookupSelect/relicLookupOptions'
import { getRelicSharpnessProfile, RelicSharpnessBar } from '../RelicSharpnessBar/RelicSharpnessBar'
import './RelicEquipmentDetail.css'

export function RelicEquipmentDetail({ cell }: { cell: SaveEquipmentCell }) {
  const [lookups, setLookups] = useState<LoadoutRelicLookup[]>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    void window.mhSaveEditor.loadout.getRelicLookups('mh4g').then(values => {
      if (!values.some(value => value.kind === 'equipment_lookup')) throw new Error('发掘参数资料不可用。')
      if (live) setLookups(values)
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '发掘参数读取失败') })
    return () => { live = false }
  }, [])

  const recordError = validateRelicRecordHex(cell.recordHex)[0]?.message
  const fields = cell.kind === 'weapon' ? relicWeaponFields(cell.relic?.weaponTypeId ?? 0, cell.recordHex) : relicArmorFields
  const byte = (offset: number) => readRelicField(cell.recordHex, { offset })
  const bowgun = [12, 13].includes(cell.relic?.weaponTypeId ?? 0)
  const flags = [byte(0x10) & 1 ? '未研磨 / 锈蚀' : '已研磨', byte(0x10) & 2 ? '发光' : '不发光']
  if (bowgun) flags.push(byte(1) & 0x20 ? '限制解除' : '未解除限制', byte(1) & 8 ? '有弩配件标记' : '无弩配件标记')

  return <section className="relic-equipment-detail" aria-label="当前发掘装备参数">
    <h3 className="relic-equipment-detail__title">当前发掘装备参数</h3>
    {error || recordError ? <p className="relic-equipment-detail__state" role="alert">{error ?? recordError}</p> : !lookups ? <p className="relic-equipment-detail__state" role="status">正在读取发掘参数…</p> : <>
      <dl className="relic-equipment-detail__fields">{fields.map(field => {
        const value = readRelicField(cell.recordHex, field)
        const label = relicLookupOptions(lookups, field.domain, cell.saveType, field.variant, value).find(option => option.value === String(value))!.label
        const sharpness = field.domain === 'sharpness' && field.variant === 'melee' && getRelicSharpnessProfile(value)
        return <div className="relic-equipment-detail__field" key={field.offset}>
          <dt className="relic-equipment-detail__label">{field.label}</dt>
          <dd className="relic-equipment-detail__value">{sharpness ? <RelicSharpnessBar code={value} compact /> : label}</dd>
        </div>
      })}</dl>
      <p className="relic-equipment-detail__flags">{flags.join(' · ')}</p>
      {cell.relic?.weaponTypeId === 11 && <p className="relic-equipment-detail__flags">猎虫：{['力量', '耐力', '速度', '火', '水', '雷', '冰', '龙'].map((label, index) => `${label} ${byte(0x14 + index)}`).join(' · ')}</p>}
      <p className="relic-equipment-detail__note">显示当前存档草稿中的参数；编辑后需保存文件。</p>
    </>}
  </section>
}
