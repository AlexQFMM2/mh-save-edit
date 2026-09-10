import type { LoadoutDecoration, LoadoutInstanceState, LoadoutRelicLookup } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
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

type LookupFieldProps = Pick<Props, 'instance' | 'saveType' | 'lookups' | 'onChange'> & {
  offset: number
  label: string
  domain: string
  variant: string
  mask?: number
  shift?: number
}

function byteAt(instance: LoadoutInstanceState, offset: number) {
  return Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
}

function LookupField({ instance, saveType, lookups, onChange, offset, label, domain, variant, mask = 0xff, shift = 0 }: LookupFieldProps) {
  const value = (byteAt(instance, offset) & mask) >> shift
  return <div className="relic-weapon-advanced-fields__field">
    <span className="relic-weapon-advanced-fields__label">{label}</span>
    <RelicLookupSelect lookups={lookups} domain={domain} saveType={saveType} variant={variant} value={value} ariaLabel={label} onChange={next => onChange(patchRelicByte(instance, offset, next << shift, mask))} />
  </div>
}

function specialVariant(typeId: number) {
  if (typeId === 1 || typeId === 5) return 'attack_boost'
  if (typeId === 3 || typeId === 7) return 'defense_boost'
  if (typeId === 2 || typeId === 4) return 'affinity_boost'
  if (typeId === 9 || typeId === 10) return 'relic_phial'
  if (typeId === 8) return 'shelling'
  if (typeId === 12 || typeId === 13) return 'available_shots'
  if (typeId === 6) return 'notes'
  return 'reserved'
}

export function RelicWeaponAdvancedFields({ instance, weaponTypeId, saveType, lookups, decorations, onChange }: Props) {
  const byte = (offset: number) => byteAt(instance, offset)
  const isBowgun = weaponTypeId === 12 || weaponTypeId === 13
  const isRanged = isBowgun || weaponTypeId === 14
  const isInsectGlaive = weaponTypeId === 11
  const sharpnessVariant = weaponTypeId === 12 ? 'light_bowgun' : weaponTypeId === 13 ? 'heavy_bowgun' : weaponTypeId === 14 ? 'bow' : 'melee'
  const attributeVariant = weaponTypeId === 1 || weaponTypeId === 6 ? 'high' : [3, 4, 11, 14].includes(weaponTypeId) ? 'low' : 'medium'
  const attributeDomain = byte(0x05) >= 6 ? 'status_value' : 'attribute_value'
  const configurationLabel = weaponTypeId === 14 ? '弓配置' : isBowgun ? '弹匣配置' : '斩味配置'

  return <div className="relic-weapon-advanced-fields">
    <fieldset className="relic-weapon-advanced-fields__group">
      <legend className="relic-weapon-advanced-fields__legend">武器发掘参数</legend>
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x0d} label="攻击档" domain="attack_tier" variant={isRanged ? 'ranged' : 'melee'} onChange={onChange} />
      {!isBowgun && <>
        <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x05} label="属性 / 异常类型" domain="attribute_type" variant="relic" onChange={onChange} />
        <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x04} label="属性 / 异常值" domain={attributeDomain} variant={attributeVariant} onChange={onChange} />
      </>}
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x0c} label={configurationLabel} domain="sharpness" variant={sharpnessVariant} onChange={onChange} />
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x0e} label="发掘强化" domain="upgrade" variant="weapon" onChange={onChange} />
      {isInsectGlaive
        ? <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x0f} label="猎虫类型 / 效果" domain="kinsect" variant="type" onChange={onChange} />
        : weaponTypeId !== 14 && <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x0f} label="武器专项" domain="weapon_special" variant={specialVariant(weaponTypeId)} onChange={onChange} />}
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x10} label="孔位" domain="slots" variant="all" mask={0x0c} shift={2} onChange={onChange} />
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x11} label="动态稀有度" domain="rarity" variant="relic" onChange={onChange} />
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x12} label="研磨要求" domain="polish_requirement" variant="all" onChange={onChange} />
      <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x13} label="极限强化" domain="honing" variant="weapon" onChange={onChange} />
      {isInsectGlaive && <LookupField instance={instance} saveType={saveType} lookups={lookups} offset={0x01} label="猎虫等级" domain="kinsect" variant="level" onChange={onChange} />}
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
