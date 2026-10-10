import { itemNumber } from '../../../api/catalog/itemIdentity'
import type { CatalogItemSummary } from '../../../api/catalog/types'
import { ItemListRow } from '../ItemListRow/ItemListRow'
import './ItemList.css'

type ItemListProps = { items: CatalogItemSummary[]; selectedId?: number; loading: boolean; error?: string; onSelect: (id: number) => void }
export function ItemList({ items, selectedId, loading, error, onSelect }: ItemListProps) {
  if (loading) return <div className="item-list__state" role="status">正在检索道具资料…</div>
  if (error) return <div className="item-list__state item-list__state--error" role="alert">{error}</div>
  if (!items.length) return <div className="item-list__state">没有符合当前条件的道具。</div>
  return <div className="item-list">
    <div className="item-list__header" aria-hidden="true"><span>图标</span><span>道具名称</span><span>稀有度</span><span>持有</span></div>
    <div className="item-list__rows" role="list" aria-label="道具列表">{items.map((item) => <div role="listitem" key={itemNumber(item)}><ItemListRow item={item} selected={itemNumber(item) === selectedId} onSelect={onSelect} /></div>)}</div>
  </div>
}
