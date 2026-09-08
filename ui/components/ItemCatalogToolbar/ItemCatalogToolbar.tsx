import { Search } from 'lucide-react'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ItemCatalogToolbar.css'

type ItemCatalogToolbarProps = {
  query: string
  sort: 'saveId' | 'name' | 'rarity'
  onQueryChange: (value: string) => void
  onSortChange: (value: 'saveId' | 'name' | 'rarity') => void
}

export function ItemCatalogToolbar({ query, sort, onQueryChange, onSortChange }: ItemCatalogToolbarProps) {
  return (
    <div className="item-catalog-toolbar">
      <label className="item-catalog-toolbar__search">
        <span className="item-catalog-toolbar__search-control"><Search aria-hidden="true" /><input aria-label="搜索道具" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名称、英文名、十进制 / 0x 十六进制 ID" /></span>
      </label>
      <div className="item-catalog-toolbar__sort"><SearchableSelect ariaLabel="道具排序" value={sort} options={[{value:'saveId',label:'存档 ID'},{value:'name',label:'中文名称'},{value:'rarity',label:'稀有度'}]} onChange={(value)=>onSortChange(value as typeof sort)}/></div>
    </div>
  )
}
