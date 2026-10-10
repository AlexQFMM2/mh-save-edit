import type { LoadoutDecoration, LoadoutInstanceState, LoadoutRelicLookup } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
import { readRelicField, relicWeaponFields } from '../../../api/loadout/relicFields'
import { RelicDecorationRecordFields } from '../RelicDecorationRecordFields/RelicDecorationRecordFields'
import { RelicLookupSelect } from '../RelicLookupSelect/RelicLookupSelect'
import './RelicWeaponAdvancedFields.css'

type Props = {
  instance: LoadoutInstanceState
  weaponTypeId: number
  saveType: number
  lookups: LoadoutRelicLookup[]
  decorations: LoadoutDecoration[]
  onChange: (value: LoadoutInstanceState) => void
}

export function RelicWeaponAdvancedFields({ instance, weaponTypeId, saveType, lookups, decorations, onChange }: Props) {
  const byte = (offset: number) => readRelicField(instance.recordHex, { offset })
  const isBowgun = weaponTypeId === 12 || weaponTypeId === 13
  const isInsectGlaive = weaponTypeId === 11

  return <div className="relic-weapon-advanced-fields">
    <fieldset className="relic-weapon-advanced-fields__group">
      <legend className="relic-weapon-advanced-fields__legend">武器发掘参数</legend>
      {relicWeaponFields(weaponTypeId, instance.recordHex).map(field => <div className="relic-weapon-advanced-fields__field" key={field.offset}>
        <span className="relic-weapon-advanced-fields__label">{field.label}</span>
        <RelicLookupSelect lookups={lookups} domain={field.domain} saveType={saveType} variant={field.variant} value={readRelicField(instance.recordHex, field)} ariaLabel={field.label} onChange={next => onChange(patchRelicByte(instance, field.offset, next << (field.shift ?? 0), field.mask))} />
      </div>)}
      <div className="relic-weapon-advanced-fields__checks">
        <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 1)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 1 : 0, 1))} /><span>未研磨 / 锈蚀</span></label>
        <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 2)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 2 : 0, 2))} /><span>发光</span></label>
      </div>
      {isBowgun && <div className="relic-weapon-advanced-fields__checks">
        <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x01) & 0x20)} onChange={event => onChange(patchRelicByte(instance, 0x01, event.target.checked ? 0x20 : 0, 0x20))} /><span>限制解除标记</span></label>
        <label className="relic-weapon-advanced-fields__check"><input className="relic-weapon-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x01) & 0x08)} onChange={event => onChange(patchRelicByte(instance, 0x01, event.target.checked ? 0x08 : 0, 0x08))} /><span>弩配件标记</span></label>
      </div>}
    </fieldset>
    <RelicDecorationRecordFields instance={instance} decorations={decorations} onChange={onChange} />
    {isInsectGlaive && <fieldset className="relic-weapon-advanced-fields__group">
      <legend className="relic-weapon-advanced-fields__legend">猎虫能力值</legend>
      <div className="relic-weapon-advanced-fields__kinsect">{['力量', '耐力', '速度', '火', '水', '雷', '冰', '龙'].map((label, index) => <label className="relic-weapon-advanced-fields__number-field" key={label}><span>{label}</span><input className="relic-weapon-advanced-fields__number-input" aria-label={`猎虫${label}`} type="number" min={0} max={255} value={byte(0x14 + index)} onChange={event => onChange(patchRelicByte(instance, 0x14 + index, Number(event.target.value)))} /></label>)}</div>
    </fieldset>}
    <small className="relic-weapon-advanced-fields__note">已识别参数通过名称选择；未识别位和未开放的原始数据会自动保持，不需要填写代码。</small>
  </div>
}
