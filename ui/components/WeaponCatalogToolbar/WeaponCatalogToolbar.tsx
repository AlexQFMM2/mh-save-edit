import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import type { SharpnessStage, SortDirection, WeaponSort, WeaponViewMode } from '../../../api/catalog/types'
import { WeaponViewToggle } from '../WeaponViewToggle/WeaponViewToggle'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './WeaponCatalogToolbar.css'

type Props = { mode?: 'browse' | 'select'; nativeIdentity?: boolean; query: string; sort: WeaponSort | 'nativeId'; direction: SortDirection; sharpnessStage: SharpnessStage; sharpnessStages: SharpnessStage[]; view: WeaponViewMode; total: number; showMotion?: boolean; onQueryChange: (value: string) => void; onChange: (key: string, value: string) => void }

export function WeaponCatalogToolbar(props: Props) {
  return <div className="weapon-catalog-toolbar">
    <label className="weapon-catalog-toolbar__search"><Search aria-hidden="true" /><input aria-label="搜索武器" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder={props.nativeIdentity ? "名称、日文、图鉴编号、材料" : "名称、英文名、十进制 / 0x ID"} /></label>
    <span className="weapon-catalog-toolbar__count">{props.total.toLocaleString()} 把</span>
    <label><span>排序</span><SearchableSelect ariaLabel="武器排序" value={props.sort} options={[{value:props.nativeIdentity?'nativeId':'saveId',label:props.nativeIdentity?'图鉴编号':'存档顺序'},{value:'name',label:'名称'},{value:'rarity',label:'稀有度'},{value:'attack',label:'攻击'},{value:'slots',label:'孔数'},{value:'sharpness',label:'斩味'},{value:'affinity',label:'会心率'}]} onChange={(value)=>props.onChange('sort',value)}/></label>
    <button className="weapon-catalog-toolbar__direction" type="button" onClick={() => props.onChange('direction', props.direction === 'asc' ? 'desc' : 'asc')} aria-label={props.direction === 'asc' ? '当前升序，点击切换降序' : '当前降序，点击切换升序'}>{props.direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}{props.direction === 'asc' ? '升序' : '降序'}</button>
    <label><span>斩味口径</span><SearchableSelect ariaLabel="武器斩味排序口径" value={props.sharpnessStage} options={props.sharpnessStages.map(stage=>({value:stage,label:stage==='base'?'基础':stage==='handicraft1'?(props.nativeIdentity?'匠':'匠+1'):'匠+2'}))} onChange={(value)=>props.onChange('sharpness',value)}/></label>
    {props.mode !== 'select' && <WeaponViewToggle value={props.view} showMotion={props.showMotion} onChange={(value) => props.onChange('view', value)} />}
  </div>
}
