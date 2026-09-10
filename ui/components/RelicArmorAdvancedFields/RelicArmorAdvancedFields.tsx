import type { LoadoutInstanceState } from '../../../api/loadout/types'
import { patchRelicByte } from '../../../api/loadout/relic'
import { RelicDecorationRecordFields } from '../RelicDecorationRecordFields/RelicDecorationRecordFields'
import './RelicArmorAdvancedFields.css'

type Props = { instance: LoadoutInstanceState; onChange: (value: LoadoutInstanceState) => void }
type ByteFieldProps = Props & { offset: number; label: string }
function ByteField({ instance, offset, label, onChange }: ByteFieldProps) {
  const value = Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
  return <label className="relic-armor-advanced-fields__field"><span className="relic-armor-advanced-fields__label">{label}</span><input className="relic-armor-advanced-fields__input" aria-label={label} type="number" min={0} max={255} value={value} onChange={event => onChange(patchRelicByte(instance, offset, Number(event.target.value)))} /><span className="relic-armor-advanced-fields__hex">0x{value.toString(16).toUpperCase().padStart(2, '0')}</span></label>
}

export function RelicArmorAdvancedFields({ instance, onChange }: Props) {
  const byte = (offset: number) => Number.parseInt(instance.recordHex.slice(offset * 2, offset * 2 + 2) || '0', 16)
  return <div className="relic-armor-advanced-fields"><fieldset className="relic-armor-advanced-fields__group"><legend className="relic-armor-advanced-fields__legend">防具发掘字段</legend>
    <ByteField instance={instance} offset={0x0c} label="五属性耐性档" onChange={onChange} />
    <ByteField instance={instance} offset={0x0d} label="防御档" onChange={onChange} />
    <ByteField instance={instance} offset={0x0e} label="发掘升级档" onChange={onChange} />
    <label className="relic-armor-advanced-fields__field"><span className="relic-armor-advanced-fields__label">孔位</span><input className="relic-armor-advanced-fields__input" type="number" min={0} max={3} value={(byte(0x10) >> 2) & 3} onChange={event => onChange(patchRelicByte(instance, 0x10, Number(event.target.value) << 2, 0x0c))} /><span className="relic-armor-advanced-fields__hex">bits 2–3</span></label>
    <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 1)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 1 : 0, 1))} /><span>未研磨 / 锈蚀</span></label>
    <label className="relic-armor-advanced-fields__check"><input className="relic-armor-advanced-fields__checkbox" type="checkbox" checked={Boolean(byte(0x10) & 2)} onChange={event => onChange(patchRelicByte(instance, 0x10, event.target.checked ? 2 : 0, 2))} /><span>发光</span></label>
    <ByteField instance={instance} offset={0x11} label="动态稀有度（-1）" onChange={onChange} />
    <ByteField instance={instance} offset={0x12} label="研磨要求档" onChange={onChange} />
  </fieldset><RelicDecorationRecordFields instance={instance} onChange={onChange} /><small className="relic-armor-advanced-fields__note">防御与耐性档仅显示原始代码；命中私有换算表时由候选摘要显示真实值。未知代码可无损保存。</small></div>
}
