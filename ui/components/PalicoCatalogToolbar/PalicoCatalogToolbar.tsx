import { RotateCcw, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import './PalicoCatalogToolbar.css'

export function PalicoCatalogToolbar({query,onQueryChange,onReset,children,placeholder='名称、说明或 ID'}:{query:string;onQueryChange:(value:string)=>void;onReset:()=>void;children?:ReactNode;placeholder?:string}){return <div className="palico-catalog-toolbar"><label className="palico-catalog-toolbar__search"><Search className="palico-catalog-toolbar__search-icon" aria-hidden="true"/><span className="sr-only">搜索猎猫资料</span><input className="palico-catalog-toolbar__search-input" value={query} onChange={event=>onQueryChange(event.target.value)} placeholder={placeholder}/></label>{children}<button className="palico-catalog-toolbar__reset" type="button" onClick={onReset}><RotateCcw className="palico-catalog-toolbar__reset-icon" aria-hidden="true"/>重置</button></div>}
export function PalicoToolbarField({label,children}:{label:string;children:ReactNode}){return <label className="palico-catalog-toolbar__field"><span className="palico-catalog-toolbar__label">{label}</span>{children}</label>}
