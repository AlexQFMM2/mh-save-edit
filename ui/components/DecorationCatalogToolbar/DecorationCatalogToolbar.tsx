import { Search } from 'lucide-react'
import './DecorationCatalogToolbar.css'

type Props = { query: string; sort: 'saveId'|'name'|'slots'|'skillPoints'; onQueryChange: (value: string) => void; onSortChange: (value: Props['sort']) => void }
export function DecorationCatalogToolbar({ query, sort, onQueryChange, onSortChange }: Props) {
  return <div className="decoration-catalog-toolbar"><label><span className="sr-only">搜索装饰品</span><span className="decoration-catalog-toolbar__input"><Search aria-hidden="true" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="名称、英文名、ID 或技能" /></span></label><label className="decoration-catalog-toolbar__sort"><span>排序</span><select value={sort} onChange={(event) => onSortChange(event.target.value as Props['sort'])}><option value="saveId">存档 ID</option><option value="name">中文名称</option><option value="slots">孔位</option><option value="skillPoints">技能点（降序）</option></select></label></div>
}
