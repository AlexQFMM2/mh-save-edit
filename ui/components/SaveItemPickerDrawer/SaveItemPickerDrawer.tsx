import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ItemSummary } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { SAVE_BOX_ITEM_STACK_MAX } from '../../../api/save/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'
import './SaveItemPickerDrawer.css'

type Props = {
  gameId: GameId
  selectedId: number
  initialCount: number
  onApply(item: ItemSummary, count: number): void
  onClose(): void
}

export function SaveItemPickerDrawer({ gameId, selectedId, initialCount, onApply, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ItemSummary[]>([])
  const [selected, setSelected] = useState<ItemSummary>()
  const [count, setCount] = useState(Math.min(SAVE_BOX_ITEM_STACK_MAX, Math.max(1, initialCount || 1)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    let live = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(undefined)
      void window.mhSaveEditor.catalog.searchItems({ gameId, query, pageSize: 100 }).then(result => {
        if (!live) return
        setItems(result.items)
        setSelected(current => result.items.find(item => item.saveId === current?.saveId) ?? result.items.find(item => item.saveId === selectedId) ?? result.items[0])
      }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '道具候选读取失败') }).finally(() => { if (live) setLoading(false) })
    }, query ? 120 : 0)
    return () => { live = false; window.clearTimeout(timer) }
  }, [gameId, query, selectedId])

  const maximum = SAVE_BOX_ITEM_STACK_MAX
  const apply = (item: ItemSummary) => onApply(item, Math.max(1, Math.min(count, maximum)))
  const select = (item: ItemSummary) => { setSelected(item); setCount(value => Math.max(1, Math.min(value, maximum))) }
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Enter') { event.preventDefault(); apply(items[index]); return }
    else return
    event.preventDefault()
    const item = items[next]
    if (item) { select(item); buttons.current[next]?.focus() }
  }

  return <WorkspaceDrawer title="替换道具" onClose={onClose} footer={<>
      <label className="save-item-picker__count">数量 <input aria-label="替换后的数量" type="number" min="1" max={maximum} value={count} onChange={event => setCount(Number(event.target.value))} /><small>箱格上限 {maximum}</small></label>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" disabled={!selected || count < 1 || count > maximum} onClick={() => selected && apply(selected)}>应用选择</button>
  </>}>
    <div className="save-item-picker">
      <label><Search aria-hidden="true" /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称、英文名或 ID" /></label>
      {error && <p role="alert">{error}</p>}
      <div role="listbox" aria-label="道具结果" aria-busy={loading}>{items.map((item, index) => <button ref={element => { buttons.current[index] = element }} type="button" role="option" tabIndex={selected?.saveId === item.saveId || (!selected && index === 0) ? 0 : -1} aria-selected={selected?.saveId === item.saveId} key={item.saveId} onClick={() => select(item)} onDoubleClick={() => apply(item)} onKeyDown={event => move(event, index)}><CatalogIcon path={item.iconPath} name={item.nameCn} /><span><strong>{item.nameCn}</strong><small>{item.nameEn || `ID ${item.saveId}`} · 稀有度 {item.rarity ?? '—'} · 携带上限 {item.maxStack ?? '—'}</small></span></button>)}</div>
    </div>
  </WorkspaceDrawer>
}
