import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import type { SharpnessStage, SortDirection, WeaponSort, WeaponViewMode } from '../../../api/catalog/types'
import { WeaponViewToggle } from '../WeaponViewToggle/WeaponViewToggle'
import './WeaponCatalogToolbar.css'

type Props = { query: string; sort: WeaponSort; direction: SortDirection; sharpnessStage: SharpnessStage; sharpnessStages: SharpnessStage[]; view: WeaponViewMode; total: number; onQueryChange: (value: string) => void; onChange: (key: string, value: string) => void }

export function WeaponCatalogToolbar(props: Props) {
  return <div className="weapon-catalog-toolbar">
    <label className="weapon-catalog-toolbar__search"><Search aria-hidden="true" /><input aria-label="搜索武器" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="名称、英文名、十进制 / 0x ID" /></label>
    <span className="weapon-catalog-toolbar__count">{props.total.toLocaleString()} 把</span>
    <label><span>排序</span><select value={props.sort} onChange={(event) => props.onChange('sort', event.target.value)}><option value="saveId">存档顺序</option><option value="name">名称</option><option value="rarity">稀有度</option><option value="attack">攻击</option><option value="slots">孔数</option><option value="sharpness">斩味</option><option value="affinity">会心率</option></select></label>
    <button className="weapon-catalog-toolbar__direction" type="button" onClick={() => props.onChange('direction', props.direction === 'asc' ? 'desc' : 'asc')} aria-label={props.direction === 'asc' ? '当前升序，点击切换降序' : '当前降序，点击切换升序'}>{props.direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}{props.direction === 'asc' ? '升序' : '降序'}</button>
    <label><span>斩味口径</span><select value={props.sharpnessStage} onChange={(event) => props.onChange('sharpness', event.target.value)}>{props.sharpnessStages.map((stage) => <option key={stage} value={stage}>{stage === 'base' ? '基础' : stage === 'handicraft1' ? '匠+1' : '匠+2'}</option>)}</select></label>
    <WeaponViewToggle value={props.view} onChange={(value) => props.onChange('view', value)} />
  </div>
}
