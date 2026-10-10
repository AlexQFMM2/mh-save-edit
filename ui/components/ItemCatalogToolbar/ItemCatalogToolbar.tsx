import { Search } from 'lucide-react'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ItemCatalogToolbar.css'

type ItemCatalogToolbarProps = {
  nativeIdentity?: boolean
  query: string
  sort: 'saveId' | 'itemId' | 'name' | 'rarity'
  onQueryChange: (value: string) => void
  onSortChange: (value: 'saveId' | 'itemId' | 'name' | 'rarity') => void
}

export function ItemCatalogToolbar({ nativeIdentity = false, query, sort, onQueryChange, onSortChange }: ItemCatalogToolbarProps) {
  return (
    <div className="item-catalog-toolbar">
      <label className="item-catalog-toolbar__search">
        <span className="item-catalog-toolbar__search-control"><Search aria-hidden="true" /><input aria-label="搜索道具" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={nativeIdentity ? "名称、旧译名、日文、道具编号" : "名称、旧译名、日文、英文或 ID"} /></span>
      </label>
      <div className="item-catalog-toolbar__sort"><SearchableSelect ariaLabel="道具排序" value={sort} options={[{value:nativeIdentity?'itemId':'saveId',label:nativeIdentity?'道具编号':'存档 ID'},{value:'name',label:'中文名称'},{value:'rarity',label:'稀有度'}]} onChange={(value)=>onSortChange(value as typeof sort)}/></div>
    </div>
  )
}
