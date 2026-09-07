import type { WeaponAttributeFilter, WeaponCatalogFacets } from '../../../api/catalog/types'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import './WeaponFilterBar.css'

type Props = { facets: WeaponCatalogFacets; typeId?: number; attributeId?: WeaponAttributeFilter; includeHiddenAttributes: boolean; rarity?: number; slots?: number; directlyProducible: boolean; includePlaceholders: boolean; onChange: (key: string, value?: string) => void; onReset: () => void }

export function WeaponFilterBar(props: Props) {
  return <div className="weapon-filter-bar" aria-label="武器筛选器">
    <label><span>武器类型</span><select value={props.typeId ?? ''} onChange={(event) => props.onChange('type', event.target.value || undefined)}><option value="">全部类型</option>{props.facets.weaponTypes.map((type) => <option key={type.typeId} value={type.typeId}>{type.nameCn}</option>)}</select></label>
    <label><span>属性</span><select value={props.attributeId ?? ''} onChange={(event) => props.onChange('attribute', event.target.value || undefined)}><option value="">全部属性</option><option value="none">无属性</option>{props.facets.attributes.map((attribute) => <option key={`${attribute.attributeId}-${attribute.kind}`} value={attribute.attributeId}>{attribute.nameCn}</option>)}</select></label>
    <label><span>稀有度</span><select value={props.rarity ?? ''} onChange={(event) => props.onChange('rarity', event.target.value || undefined)}><option value="">全部</option>{props.facets.rarities.map((rarity) => <option key={rarity} value={rarity}>RARE {rarity}</option>)}</select></label>
    <label><span>孔位</span><select value={props.slots ?? ''} onChange={(event) => props.onChange('slots', event.target.value || undefined)}><option value="">全部</option>{props.facets.slots.map((slots) => <option key={slots} value={slots}>{slots} 孔</option>)}</select></label>
    <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.includeHiddenAttributes} onChange={(event) => props.onChange('hidden', event.target.checked ? '1' : '0')} /><span>包含觉醒</span></label>
    <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.directlyProducible} onChange={(event) => props.onChange('producible', event.target.checked ? '1' : undefined)} /><span>可直接生产</span></label>
    <label className="weapon-filter-bar__check"><input type="checkbox" checked={props.includePlaceholders} onChange={(event) => props.onChange('debug', event.target.checked ? '1' : undefined)} /><span>占位条目</span></label>
    <CatalogResetButton onReset={props.onReset} />
  </div>
}
