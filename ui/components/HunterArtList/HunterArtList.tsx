import type { KeyboardEvent } from 'react'
import type { HunterArtSummary } from '../../../api/catalog/types'
import './HunterArtList.css'

export function HunterArtList({ items, selectedId, loading, error, onSelect }: { items: HunterArtSummary[]; selectedId?: number; loading: boolean; error?: string; onSelect: (id: number) => void }) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const next = Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
    onSelect(items[next].hunterArtId)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.hunter-art-list__item')[next]?.focus()
  }
  return (
    <div className="hunter-art-list" role="listbox" aria-label="狩技列表">
      {error && <p className="hunter-art-list__state" role="alert">{error}</p>}
      {!error && loading && items.length === 0 && <p className="hunter-art-list__state">正在读取狩技…</p>}
      {!error && !loading && items.length === 0 && <p className="hunter-art-list__state">没有符合条件的狩技。</p>}
      {items.map((item, index) => {
        const selected = selectedId === item.hunterArtId
        return (
          <button className="hunter-art-list__item" key={item.hunterArtId} type="button" role="option" aria-selected={selected} tabIndex={selected || selectedId == null && index === 0 ? 0 : -1} onClick={() => onSelect(item.hunterArtId)} onKeyDown={event => move(event, index)}>
            <span className="hunter-art-list__names"><strong className="hunter-art-list__name">{item.nameCn}</strong><small className="hunter-art-list__alternate-name">{item.nameEn}</small>{item.match && item.match.kind !== 'name' && <em className="hunter-art-list__match">{item.match.reason}</em>}</span>
            <span className="hunter-art-list__meta">{item.weaponTypeNameCn}{item.level ? ` · ${item.level}` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
