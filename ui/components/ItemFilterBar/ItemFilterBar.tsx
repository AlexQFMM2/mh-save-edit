import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './ItemFilterBar.css'

type ItemFilterBarProps = {
  rarities: number[]; maxStacks: number[]; availableSources: string[]; availableUsages: string[]; rarity?: number; maxStack?: number; source?: string; usage?: string; includePlaceholders: boolean
  onChange: (key: string, value?: string) => void
  onReset: () => void
}

export function ItemFilterBar(props: ItemFilterBarProps) {
  return (
    <div className="item-filter-bar" aria-label="道具筛选器">
      <label><span>稀有度</span><SearchableSelect ariaLabel="筛选道具稀有度" value={String(props.rarity ?? '')} options={[{value:'',label:'全部'},...props.rarities.map(value=>({value:String(value),label:`RARE ${value}`}))]} onChange={(value)=>props.onChange('rarity',value||undefined)}/></label>
      <label><span>持有上限</span><SearchableSelect ariaLabel="筛选道具持有上限" value={String(props.maxStack ?? '')} options={[{value:'',label:'全部'},...props.maxStacks.map(value=>({value:String(value),label:String(value)}))]} onChange={(value)=>props.onChange('stack',value||undefined)}/></label>
      <label><span>获取来源</span><SearchableSelect ariaLabel="筛选道具获取来源" value={props.source ?? ''} options={[{value:'',label:'全部'},...[['combination','调合'],['monster','怪物'],['location','采集'],['quest','任务'],['exchange','山菜爷'],['shop','商店购买']].filter(([value])=>props.availableSources.includes(value)).map(([value,label])=>({value,label}))]} onChange={(value)=>props.onChange('source',value||undefined)}/></label>
      <label><span>用途</span><SearchableSelect ariaLabel="筛选道具用途" value={props.usage ?? ''} options={[{value:'',label:'全部'},...[['weapon','武器'],['armor','防具'],['decoration','装饰珠'],['palico-weapon','猫武器'],['palico-armor','猫防具'],['kinsect','猎虫']].filter(([value])=>props.availableUsages.includes(value)).map(([value,label])=>({value,label}))]} onChange={(value)=>props.onChange('usage',value||undefined)}/></label>
      <label className="item-filter-bar__debug"><input type="checkbox" checked={props.includePlaceholders} onChange={(event) => props.onChange('debug', event.target.checked ? '1' : undefined)} /><span>显示占位条目</span></label>
      <CatalogResetButton onReset={props.onReset} />
    </div>
  )
}
