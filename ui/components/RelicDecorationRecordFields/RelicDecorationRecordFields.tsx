import { useMemo } from 'react'
import type { LoadoutDecoration, LoadoutInstanceState } from '../../../api/loadout/types'
import { patchRelicUint16 } from '../../../api/loadout/relic'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './RelicDecorationRecordFields.css'

type Props = {
  instance: LoadoutInstanceState
  decorations: LoadoutDecoration[]
  onChange: (value: LoadoutInstanceState) => void
}

const offsets = [0x06, 0x08, 0x0a] as const

export function RelicDecorationRecordFields({ instance, decorations, onChange }: Props) {
  const baseOptions = useMemo(() => [
    { value: '0', label: '无装饰珠' },
    ...decorations.map(item => ({
      value: String(item.saveId),
      label: `${item.nameCn}（${item.slots} 孔）`,
      keywords: [String(item.saveId), ...item.skills.map(skill => skill.nameCn)],
    })),
  ], [decorations])
  const valueAt = (offset: number) => Number.parseInt(instance.recordHex.slice(offset * 2 + 2, offset * 2 + 4) + instance.recordHex.slice(offset * 2, offset * 2 + 2), 16) || 0

  return <fieldset className="relic-decoration-record-fields">
    <legend className="relic-decoration-record-fields__legend">内置装饰珠</legend>
    {offsets.map((offset, index) => {
      const value = valueAt(offset)
      const decorationId = value & 0x7fff
      const options = baseOptions.some(option => option.value === String(decorationId))
        ? baseOptions
        : [{ value: String(decorationId), label: '当前装饰珠未识别（保持原样）' }, ...baseOptions]
      return <div className="relic-decoration-record-fields__field" key={offset}>
        <span className="relic-decoration-record-fields__label">珠 {index + 1}</span>
        <SearchableSelect className="relic-decoration-record-fields__select" ariaLabel={`珠 ${index + 1}`} value={String(decorationId)} options={options} onChange={next => onChange(patchRelicUint16(instance, offset, Number(next), 0x7fff))} />
        <label className="relic-decoration-record-fields__fixed"><input className="relic-decoration-record-fields__checkbox" aria-label={`珠 ${index + 1} 固定或内置`} type="checkbox" checked={Boolean(value & 0x8000)} onChange={event => onChange(patchRelicUint16(instance, offset, event.target.checked ? 0x8000 : 0, 0x8000))} /><span>固定 / 内置</span></label>
      </div>
    })}
  </fieldset>
}
