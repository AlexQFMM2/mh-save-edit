import type { WeaponAttributeFilter } from '../../../api/catalog/types'
import type { CatalogWeaponFacets } from '../../utils/catalogWeapon'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './WeaponFilterBar.css'

type Props = { scope?: import('../../../api/catalog/p3WeaponTypes').P3WeaponScope; nativeIdentity?: boolean; facets: CatalogWeaponFacets; typeId?: number; attributeId?: WeaponAttributeFilter; includeHiddenAttributes: boolean; rarity?: number; slots?: number; directlyProducible: boolean; finalOnly: boolean; includePlaceholders: boolean; onChange: (key: string, value?: string) => void; onReset: () => void }

export function WeaponFilterBar(props: Props) {
  return <div className="weapon-filter-bar" aria-label="武器筛选器">
    <label><span>武器类型</span><SearchableSelect ariaLabel="筛选武器类型" value={String(props.typeId??'')} options={[{value:'',label:'全部类型'},...props.facets.weaponTypes.map(type=>({value:String(type.typeId),label:type.nameCn,keywords:[type.nameEn]}))]} onChange={(value)=>props.onChange('type',value||undefined)}/></label>
    <label><span>属性</span><SearchableSelect ariaLabel="筛选武器属性" value={String(props.attributeId??'')} options={[{value:'',label:'全部属性'},{value:'none',label:'无属性'},...props.facets.attributes.map(attribute=>({value:String(attribute.attributeId),label:attribute.nameCn,keywords:[attribute.nameEn,attribute.kind]}))]} onChange={(value)=>props.onChange('attribute',value||undefined)}/></label>
    <label><span>稀有度</span><SearchableSelect ariaLabel="筛选武器稀有度" value={String(props.rarity??'')} options={[{value:'',label:'全部'},...props.facets.rarities.map(rarity=>({value:String(rarity),label:`RARE ${rarity}`}))]} onChange={(value)=>props.onChange('rarity',value||undefined)}/></label>
    <label><span>孔位</span><SearchableSelect ariaLabel="筛选武器孔位" value={String(props.slots??'')} options={[{value:'',label:'全部'},...props.facets.slots.map(slots=>({value:String(slots),label:`${slots} 孔`}))]} onChange={(value)=>props.onChange('slots',value||undefined)}/></label>
    {!props.nativeIdentity && <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.includeHiddenAttributes} onChange={(event) => props.onChange('hidden', event.target.checked ? '1' : '0')} /><span>包含觉醒</span></label>}
    <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.directlyProducible} onChange={(event) => props.onChange('producible', event.target.checked ? '1' : undefined)} /><span>可直接生产</span></label>
    {!props.nativeIdentity && <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.includePlaceholders} onChange={(event) => props.onChange('debug', event.target.checked ? '1' : undefined)} /><span>占位条目</span></label>}
    <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.finalOnly} onChange={event => props.onChange('final', event.target.checked ? '1' : undefined)} /><span>只看无法再强化</span></label>
    {props.scope && <label><span>目录范围</span><SearchableSelect ariaLabel="筛选武器目录范围" value={props.scope} options={[{value:'obtainable',label:'正常目录'},{value:'special',label:'特殊用途'},{value:'unknown',label:'取得未确认'},{value:'all',label:'全部'}]} onChange={value=>props.onChange('scope',value)}/></label>}
    <CatalogResetButton onReset={props.onReset} />
  </div>
}
