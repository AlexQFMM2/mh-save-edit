import type { P3ItemCategory, P3QuantityKind } from '../../../api/catalog/p3ItemTypes'
import { p3ItemCategories, p3QuantityKinds } from '../../utils/p3ItemPresentation'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ItemFilterBar.css'

type ItemFilterBarProps = {
  categories?: P3ItemCategory[]; quantityKinds?: P3QuantityKind[]; category?: string; quantityKind?: string;
  rarities: number[]; maxStacks: number[]; availableSources: string[]; availableUsages: string[]; rarity?: number; maxStack?: number; source?: string; usage?: string; includePlaceholders: boolean
  onChange: (key: string, value?: string) => void
  onReset: () => void
}

export function ItemFilterBar(props: ItemFilterBarProps) {
  return (
    <div className="item-filter-bar" aria-label="道具筛选器">
      {props.categories && <label className="item-filter-bar__field"><span>大类</span><SearchableSelect ariaLabel="筛选道具大类" value={props.category ?? ''} options={[{value:'',label:'全部'},...props.categories.map(value=>({value,label:p3ItemCategories[value],keywords:[value]}))]} onChange={value=>props.onChange('category',value||undefined)}/></label>}
      {props.quantityKinds && <label className="item-filter-bar__field"><span>数量类型</span><SearchableSelect ariaLabel="筛选道具数量类型" value={props.quantityKind ?? ''} options={[{value:'',label:'全部'},...props.quantityKinds.map(value=>({value,label:p3QuantityKinds[value],keywords:[value]}))]} onChange={value=>props.onChange('quantity',value||undefined)}/></label>}
      <label className="item-filter-bar__field"><span>稀有度</span><SearchableSelect ariaLabel="筛选道具稀有度" value={String(props.rarity ?? '')} options={[{value:'',label:'全部'},...props.rarities.map(value=>({value:String(value),label:`RARE ${value}`}))]} onChange={(value)=>props.onChange('rarity',value||undefined)}/></label>
      <label className="item-filter-bar__field"><span>持有上限</span><SearchableSelect ariaLabel="筛选道具持有上限" value={String(props.maxStack ?? '')} options={[{value:'',label:'全部'},...props.maxStacks.map(value=>({value:String(value),label:String(value)}))]} onChange={(value)=>props.onChange('stack',value||undefined)}/></label>
      <label className="item-filter-bar__field"><span>{props.categories ? '已收录来源' : '获取来源'}</span><SearchableSelect ariaLabel="筛选道具获取来源" value={props.source ?? ''} options={[{value:'',label:'全部'},...[['combination','调合'],['monster','怪物'],['location','采集'],['quest','任务'],['exchange','山菜爷'],['shop','商店购买']].filter(([value])=>props.availableSources.includes(value)).map(([value,label])=>({value,label}))]} onChange={(value)=>props.onChange('source',value||undefined)}/></label>
      <label className="item-filter-bar__field"><span>用途</span><SearchableSelect ariaLabel="筛选道具用途" value={props.usage ?? ''} options={[{value:'',label:'全部'},...[['combination','调合材料'],['weapon','武器'],['armor','防具'],['decoration','装饰珠'],['palico-weapon','猫武器'],['palico-armor','猫防具'],['kinsect','猎虫']].filter(([value])=>props.availableUsages.includes(value)).map(([value,label])=>({value,label}))]} onChange={(value)=>props.onChange('usage',value||undefined)}/></label>
      <label className="item-filter-bar__debug"><input className="item-filter-bar__checkbox" type="checkbox" checked={props.includePlaceholders} onChange={(event) => props.onChange('debug', event.target.checked ? '1' : undefined)} /><span>显示占位条目</span></label>
      <CatalogResetButton onReset={props.onReset} />
    </div>
  )
}
