import type { LoadoutDecoration, LoadoutInstanceState, LoadoutRelicLookup } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
import { RelicDecorationRecordFields } from '../RelicDecorationRecordFields/RelicDecorationRecordFields'
import { RelicLookupSelect } from '../RelicLookupSelect/RelicLookupSelect'
import './RelicArmorAdvancedFields.css'

type Props = {
  instance: LoadoutInstanceState
  saveType: number
  lookups: LoadoutRelicLookup[]
  decorations: LoadoutDecoration[]
  onChange: (value: LoadoutInstanceState) => void
}

function byteAt(instance: LoadoutInstanceState, offset: number) {
  return Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
}

export function RelicArmorAdvancedFields({ instance, saveType, lookups, decorations, onChange }: Props) {
  const byte = (offset: number) => byteAt(instance, offset)
  const field = (offset: number, label: string, domain: string, variant: string, mask = 0xff, shift = 0) => <div className="relic-armor-advanced-fields__field" key={label}>
    <span className="relic-armor-advanced-fields__label">{label}</span>
    <RelicLookupSelect lookups={lookups} domain={domain} saveType={saveType} variant={variant} value={(byte(offset) & mask) >> shift} ariaLabel={label} onChange={value => onChange(patchRelicByte(instance, offset, value << shift, mask))} />
  </div>

  return <div className="relic-armor-advanced-fields">
    <fieldset className="relic-armor-advanced-fields__group">
      <legend className="relic-armor-advanced-fields__legend">防具发掘参数</legend>
      {field(0x0d, '防御档', 'relic_defense', 'armor')}
      {field(0x0c, '五属性耐性档', 'relic_resistance', 'armor')}
      {field(0x0e, '发掘强化', 'upgrade', 'armor')}
      {field(0x10, '孔位', 'slots', 'all', 0x0c, 2)}
      {field(0x11, '动态稀有度', 'rarity', 'relic')}
      {field(0x12, '研磨要求', 'polish_requirement', 'all')}
      <div className="relic-armor-advanced-fields__checks">
        <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 1)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 1 : 0, 1))} /><span>未研磨 / 锈蚀</span></label>
        <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 2)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 2 : 0, 2))} /><span>发光</span></label>
      </div>
    </fieldset>
    <RelicDecorationRecordFields instance={instance} decorations={decorations} onChange={onChange} />
    <small className="relic-armor-advanced-fields__note">防御和耐性直接显示换算结果；未识别位会自动保持，不需要填写代码。</small>
  </div>
}
