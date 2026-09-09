import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import type { SortDirection, WeaponMotionCategory, WeaponMotionFacets, WeaponMotionSort, WeaponStyleId, WeaponViewMode } from '../../../api/catalog/types'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { WeaponViewToggle } from '../WeaponViewToggle/WeaponViewToggle'
import './WeaponMotionToolbar.css'

type Props={query:string;weaponTypeId:number;styles:WeaponStyleId[];category?:WeaponMotionCategory;sort:WeaponMotionSort;direction:SortDirection;facets:WeaponMotionFacets;total:number;onQueryChange:(value:string)=>void;onChange:(key:string,value?:string)=>void;onStylesChange:(styles:WeaponStyleId[])=>void;onViewChange:(value:WeaponViewMode)=>void;onReset:()=>void}
export function WeaponMotionToolbar(props:Props){return <div className="weapon-motion-toolbar" aria-label="动作值筛选器">
  <label className="weapon-motion-toolbar__search"><Search className="weapon-motion-toolbar__search-icon" aria-hidden="true"/><input className="weapon-motion-toolbar__search-input" value={props.query} onChange={event=>props.onQueryChange(event.target.value)} aria-label="搜索动作" placeholder="动作名、狩技名、原生动作 ID"/></label>
  <span className="weapon-motion-toolbar__count">{props.total} 个动作</span>
  <label className="weapon-motion-toolbar__field"><span className="weapon-motion-toolbar__label">武器</span><SearchableSelect ariaLabel="动作值武器类型" value={String(props.weaponTypeId)} options={props.facets.weaponTypes.map(type=>({value:String(type.typeId),label:type.nameCn,keywords:[type.nameEn]}))} onChange={value=>props.onChange('type',value)}/></label>
  <label className="weapon-motion-toolbar__field weapon-motion-toolbar__field--styles"><span className="weapon-motion-toolbar__label">风格</span><SearchableSelect multiple ariaLabel="筛选狩猎风格" value={props.styles} options={props.facets.styles.map(style=>({value:style.id,label:style.nameCn,keywords:[style.nameEn]}))} placeholder="全部风格" onChange={values=>props.onStylesChange(values as WeaponStyleId[])}/></label>
  <label className="weapon-motion-toolbar__field"><span className="weapon-motion-toolbar__label">分类</span><SearchableSelect ariaLabel="筛选动作分类" value={props.category??''} options={[{value:'',label:'全部分类'},{value:'standard',label:'普通招式'},{value:'style',label:'风格招式'},{value:'hunterArt',label:'攻击型狩技'}]} onChange={value=>props.onChange('motionCategory',value||undefined)}/></label>
  <label className="weapon-motion-toolbar__field"><span className="weapon-motion-toolbar__label">排序</span><SearchableSelect ariaLabel="动作值排序" value={props.sort} options={[{value:'source',label:'来源顺序'},{value:'motionValue',label:'动作值'},{value:'stun',label:'气绝值'},{value:'exhaust',label:'减气值'}]} onChange={value=>props.onChange('motionSort',value)}/></label>
  <button className="weapon-motion-toolbar__direction" type="button" onClick={()=>props.onChange('motionDirection',props.direction==='asc'?'desc':'asc')} aria-label={props.direction==='asc'?'当前升序，点击切换降序':'当前降序，点击切换升序'}>{props.direction==='asc'?<ArrowUp className="weapon-motion-toolbar__direction-icon" aria-hidden="true"/>:<ArrowDown className="weapon-motion-toolbar__direction-icon" aria-hidden="true"/>}{props.direction==='asc'?'升序':'降序'}</button>
  <WeaponViewToggle value="motion" showMotion onChange={props.onViewChange}/>
  <CatalogResetButton onReset={props.onReset}/>
</div>}
