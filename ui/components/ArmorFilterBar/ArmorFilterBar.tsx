import type { ArmorCatalogFacets, ArmorCombatType, ArmorGender, ArmorPartId } from '../../../api/catalog/types'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ArmorFilterBar.css'

type Props = { facets: ArmorCatalogFacets; showPart?: boolean; part?: ArmorPartId; combat?: ArmorCombatType; gender?: ArmorGender; rarity?: number; slots?: number; skillId?: number; includePlaceholders: boolean; onChange: (key: string, value?: string) => void; onReset: () => void }
export function ArmorFilterBar(props: Props) {
  return <div className="armor-filter-bar">
    {props.showPart!==false&&<label><span>部位</span><SearchableSelect ariaLabel="筛选防具部位" value={props.part??''} options={[{value:'',label:'全部'},{value:'head',label:'头'},{value:'chest',label:'胸'},{value:'arms',label:'手'},{value:'waist',label:'腰'},{value:'legs',label:'腿'}]} onChange={(value)=>props.onChange('part',value||undefined)}/></label>}
    <label><span>职业</span><SearchableSelect ariaLabel="筛选防具职业" value={props.combat??''} options={[{value:'',label:'全部'},{value:'both',label:'通用'},{value:'blademaster',label:'近战'},{value:'gunner',label:'远程'}]} onChange={(value)=>props.onChange('combat',value||undefined)}/></label>
    <label><span>性别</span><SearchableSelect ariaLabel="筛选防具性别" value={props.gender??''} options={[{value:'',label:'全部'},{value:'both',label:'通用'},{value:'male',label:'男性'},{value:'female',label:'女性'}]} onChange={(value)=>props.onChange('gender',value||undefined)}/></label>
    <label><span>稀有度</span><SearchableSelect ariaLabel="筛选防具稀有度" value={String(props.rarity??'')} options={[{value:'',label:'全部'},...props.facets.rarities.map(v=>({value:String(v),label:`RARE ${v}`}))]} onChange={(value)=>props.onChange('rarity',value||undefined)}/></label>
    <label><span>孔位</span><SearchableSelect ariaLabel="筛选防具孔位" value={String(props.slots??'')} options={[{value:'',label:'全部'},...props.facets.slots.map(v=>({value:String(v),label:`${v} 孔`}))]} onChange={(value)=>props.onChange('slots',value||undefined)}/></label>
    <label className="armor-filter-bar__skill"><span>技能</span><SearchableSelect ariaLabel="按技能筛选防具" value={String(props.skillId??'')} options={[{value:'',label:'全部技能'},...props.facets.skills.map(v=>({value:String(v.skillId),label:v.nameCn,keywords:[v.nameEn]}))]} onChange={(value)=>props.onChange('skill',value||undefined)}/></label>
    <label className="armor-filter-bar__debug"><input type="checkbox" checked={props.includePlaceholders} onChange={e=>props.onChange('debug',e.target.checked?'1':undefined)}/>占位</label>
    <CatalogResetButton onReset={props.onReset}/>
  </div>
}
