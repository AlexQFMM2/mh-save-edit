import type { LoadoutInstanceState } from '../../../api/loadout/types'
import { patchRelicUint16 } from '../../../api/loadout/relic'
import './RelicDecorationRecordFields.css'

type Props = { instance: LoadoutInstanceState; onChange: (value: LoadoutInstanceState) => void }
const offsets = [0x06, 0x08, 0x0a] as const

export function RelicDecorationRecordFields({ instance, onChange }: Props) {
  const valueAt = (offset: number) => Number.parseInt(instance.recordHex.slice(offset * 2 + 2, offset * 2 + 4) + instance.recordHex.slice(offset * 2, offset * 2 + 2), 16) || 0
  return <fieldset className="relic-decoration-record-fields"><legend className="relic-decoration-record-fields__legend">原始装饰珠记录</legend>{offsets.map((offset, index) => {
    const value = valueAt(offset)
    return <label className="relic-decoration-record-fields__field" key={offset}><span className="relic-decoration-record-fields__label">珠 {index + 1}</span><input className="relic-decoration-record-fields__input" aria-label={`珠 ${index + 1} ID`} type="number" min={0} max={0x7fff} value={value & 0x7fff} onChange={event => onChange(patchRelicUint16(instance, offset, Number(event.target.value), 0x7fff))} /><span className="relic-decoration-record-fields__hex">0x{(value & 0x7fff).toString(16).toUpperCase().padStart(4, '0')}</span><input className="relic-decoration-record-fields__checkbox" aria-label={`珠 ${index + 1} 固定或内置`} type="checkbox" checked={Boolean(value & 0x8000)} onChange={event => onChange(patchRelicUint16(instance, offset, event.target.checked ? 0x8000 : 0, 0x8000))} /><span className="relic-decoration-record-fields__fixed">固定 / 内置（bit15）</span></label>
  })}</fieldset>
}
