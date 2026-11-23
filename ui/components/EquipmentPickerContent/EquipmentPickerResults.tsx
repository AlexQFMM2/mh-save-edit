import { useRef, type KeyboardEvent } from 'react'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'

type Result = { key: string; name: string; subtitle: string; tooltip: string; iconPath: string | null; slots: number; source?: string }
type Props = {
  rows: Result[]
  selected?: string
  loading: boolean
  error?: string
  page: number
  pageCount: number
  hasNext: boolean
  onSelect(index: number): void
  onPage(page: number): void
  onRetry(): void
}

export function EquipmentPickerResults({ rows, selected, loading, error, page, pageCount, hasNext, onSelect, onPage, onRetry }: Props) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const visibleSelected = rows.some(row => row.key === selected)

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    switch (event.key) {
      case 'ArrowDown': next = Math.min(rows.length - 1, index + 1); break
      case 'ArrowUp': next = Math.max(0, index - 1); break
      case 'Home': next = 0; break
      case 'End': next = rows.length - 1; break
      case 'PageDown': next = Math.min(rows.length - 1, index + 10); break
      case 'PageUp': next = Math.max(0, index - 10); break
      case 'Enter': case ' ': break
      default: return
    }
    event.preventDefault()
    onSelect(next)
    if (next !== index) buttons.current[next]?.focus()
  }

  return <div className="equipment-picker-content__candidate-pane">
    <div className="equipment-picker-content__body" aria-busy={loading}>
      {error && <p className="equipment-picker-content__empty" role="alert">{error}<button className="equipment-picker-content__retry" type="button" onClick={onRetry}>重试</button></p>}
      {!error && rows.map((row, index) => <button
        ref={element => { buttons.current[index] = element }}
        type="button" tabIndex={row.key === selected || (!visibleSelected && index === 0) ? 0 : -1}
        className={`equipment-picker-content__item${row.key === selected ? ' equipment-picker-content__item--selected' : ''}`}
        aria-pressed={row.key === selected} key={row.key}
        onKeyDown={event => move(event, index)} onClick={() => onSelect(index)}
      >
        <CatalogIcon path={row.iconPath} name={row.name} />
        <span className="equipment-picker-content__item-copy" title={row.tooltip}>
          <strong className="equipment-picker-content__item-name">{row.name}</strong>
          <small className="equipment-picker-content__item-detail">{row.subtitle}</small>
        </span>
        <EquipmentSlotIndicator slots={row.slots} />
        <em className="equipment-picker-content__source">{row.source}</em>
      </button>)}
      {!loading && !error && !rows.length && <p className="equipment-picker-content__empty">没有符合条件的候选。</p>}
    </div>
    <nav className="equipment-picker-content__pagination" aria-label="候选分页">
      <button className="equipment-picker-content__pagination-button" type="button" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>上一页</button>
      <span>{page} / {pageCount}</span>
      <button className="equipment-picker-content__pagination-button" type="button" disabled={!hasNext || loading} onClick={() => onPage(page + 1)}>下一页</button>
    </nav>
  </div>
}
