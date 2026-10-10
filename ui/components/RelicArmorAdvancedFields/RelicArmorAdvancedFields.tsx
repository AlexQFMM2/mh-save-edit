import type { LoadoutDecoration, LoadoutInstanceState, LoadoutRelicLookup } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
import { readRelicField, relicArmorFields } from '../../../api/loadout/relicFields'
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

export function RelicArmorAdvancedFields({ instance, saveType, lookups, decorations, onChange }: Props) {
  const byte = (offset: number) => readRelicField(instance.recordHex, { offset })

  return <div className="relic-armor-advanced-fields">
    <fieldset className="relic-armor-advanced-fields__group">
      <legend className="relic-armor-advanced-fields__legend">防具发掘参数</legend>
      {relicArmorFields.map(field => <div className="relic-armor-advanced-fields__field" key={field.offset}>
        <span className="relic-armor-advanced-fields__label">{field.label}</span>
        <RelicLookupSelect lookups={lookups} domain={field.domain} saveType={saveType} variant={field.variant} value={readRelicField(instance.recordHex, field)} ariaLabel={field.label} onChange={next => onChange(patchRelicByte(instance, field.offset, next << (field.shift ?? 0), field.mask))} />
      </div>)}
      <div className="relic-armor-advanced-fields__checks">
        <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 1)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 1 : 0, 1))} /><span>未研磨 / 锈蚀</span></label>
        <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 2)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 2 : 0, 2))} /><span>发光</span></label>
      </div>
    </fieldset>
    <RelicDecorationRecordFields instance={instance} decorations={decorations} onChange={onChange} />
    <small className="relic-armor-advanced-fields__note">防御和耐性直接显示换算结果；未识别位会自动保持，不需要填写代码。</small>
  </div>
}
