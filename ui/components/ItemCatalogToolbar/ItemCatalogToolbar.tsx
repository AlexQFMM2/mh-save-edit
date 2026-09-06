import { Search } from 'lucide-react'
import type { ChangeEvent } from 'react'
import './ItemCatalogToolbar.css'

type ItemCatalogToolbarProps = {
  query: string
  sort: 'saveId' | 'name' | 'rarity'
  onQueryChange: (value: string) => void
  onSortChange: (value: 'saveId' | 'name' | 'rarity') => void
}

export function ItemCatalogToolbar({ query, sort, onQueryChange, onSortChange }: ItemCatalogToolbarProps) {
  const handleSort = (event: ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value as typeof sort)
  return (
    <div className="item-catalog-toolbar">
      <label className="item-catalog-toolbar__search">
        <span className="item-catalog-toolbar__search-control"><Search aria-hidden="true" /><input aria-label="搜索道具" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名称、英文名、十进制 / 0x 十六进制 ID" /></span>
      </label>
      <label className="item-catalog-toolbar__sort"><select aria-label="排序" value={sort} onChange={handleSort}><option value="saveId">存档 ID</option><option value="name">中文名称</option><option value="rarity">稀有度</option></select></label>
    </div>
  )
}
