import { Search } from 'lucide-react'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './DecorationCatalogToolbar.css'

type Props = { query: string; nativeIdentity?: boolean; sort: 'itemId'|'saveId'|'name'|'slots'|'skillPoints'; onQueryChange: (value: string) => void; onSortChange: (value: Props['sort']) => void }
export function DecorationCatalogToolbar({ query, sort, nativeIdentity = false, onQueryChange, onSortChange }: Props) {
  return <div className="decoration-catalog-toolbar"><label><span className="sr-only">搜索装饰品</span><span className="decoration-catalog-toolbar__input"><Search aria-hidden="true" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={nativeIdentity?'名称、日文名、编号、技能或材料':'名称、英文名、ID 或技能'} /></span></label><label className="decoration-catalog-toolbar__sort"><span>排序</span><SearchableSelect ariaLabel="装饰品排序" value={sort} options={[{value:nativeIdentity?'itemId':'saveId',label:nativeIdentity?'道具编号':'存档 ID'},{value:'name',label:'中文名称'},{value:'slots',label:'孔位'},{value:'skillPoints',label:'技能点（降序）'}]} onChange={(value)=>onSortChange(value as Props['sort'])}/></label></div>
}
