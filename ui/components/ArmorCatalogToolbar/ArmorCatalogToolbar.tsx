import { Search } from 'lucide-react'
import type { ArmorSetSort, ArmorSort, ArmorViewMode, SortDirection } from '../../../api/catalog/types'
import { ArmorViewToggle } from '../ArmorViewToggle/ArmorViewToggle'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ArmorCatalogToolbar.css'

type Props = { mode?: 'browse' | 'select'; nativeIdentity?: boolean; query: string; view: ArmorViewMode; sort: ArmorSort | ArmorSetSort; direction: SortDirection; total: number; skillSelected: boolean; onQueryChange: (value: string) => void; onChange: (key: string, value?: string) => void }
export function ArmorCatalogToolbar({ mode = 'browse', nativeIdentity = false, query, view, sort, direction, total, skillSelected, onQueryChange, onChange }: Props) {
  const listSorts = [['dexId',nativeIdentity?'原生顺序':'Dex ID'],['name','名称'],['rarity','稀有度'],['slots','孔位'],['baseDefense','基础防御'],['maxDefense','最大防御'],['fireRes','火耐性'],['waterRes','水耐性'],['thunderRes','雷耐性'],['iceRes','冰耐性'],['dragonRes','龙耐性']]
  const setSorts = [['source','原始顺序'],['name','套装名称'],['rarity','稀有度'],['slots','总孔位'],['baseDefense','总基础防御'],['maxDefense','总最大防御']]
  const sortOptions=(view==='list'?listSorts:setSorts).map(([value,label])=>({value,label}));if(skillSelected)sortOptions.push({value:'skillPoints',label:view==='list'?'技能点':'套装技能点'})
  return <div className="armor-catalog-toolbar">
    <label className="armor-catalog-toolbar__field armor-catalog-toolbar__search"><span className="sr-only">搜索防具</span><Search className="armor-catalog-toolbar__search-icon" aria-hidden="true"/><input className="armor-catalog-toolbar__input" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={nativeIdentity?'名称、原生键、技能或材料':'名称、英文名或 Dex ID'} /></label>
    <span className="armor-catalog-toolbar__total">{total} 条</span>
    {mode !== 'select' && <ArmorViewToggle value={view} onChange={(value) => onChange('view', value)} />}
    <label className="armor-catalog-toolbar__field"><span>排序</span><SearchableSelect ariaLabel="防具排序" value={sort} options={sortOptions} onChange={(value)=>onChange('sort',value)}/></label>
    <label className="armor-catalog-toolbar__field"><span className="sr-only">排序方向</span><SearchableSelect ariaLabel="防具排序方向" value={direction} options={[{value:'asc',label:'升序'},{value:'desc',label:'降序'}]} onChange={(value)=>onChange('direction',value)}/></label>
  </div>
}
