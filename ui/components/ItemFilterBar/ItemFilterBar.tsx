import './ItemFilterBar.css'

type ItemFilterBarProps = {
  rarities: number[]; maxStacks: number[]; availableSources: string[]; availableUsages: string[]; rarity?: number; maxStack?: number; source?: string; usage?: string; includePlaceholders: boolean
  onChange: (key: string, value?: string) => void
}

export function ItemFilterBar(props: ItemFilterBarProps) {
  return (
    <div className="item-filter-bar" aria-label="道具筛选器">
      <label><span>稀有度</span><select value={props.rarity ?? ''} onChange={(event) => props.onChange('rarity', event.target.value || undefined)}><option value="">全部</option>{props.rarities.map((value) => <option key={value} value={value}>RARE {value}</option>)}</select></label>
      <label><span>持有上限</span><select value={props.maxStack ?? ''} onChange={(event) => props.onChange('stack', event.target.value || undefined)}><option value="">全部</option>{props.maxStacks.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>获取来源</span><select value={props.source ?? ''} onChange={(event) => props.onChange('source', event.target.value || undefined)}><option value="">全部</option>{[['combination','调合'],['monster','怪物'],['location','采集'],['quest','任务'],['exchange','山菜爷']].filter(([value]) => props.availableSources.includes(value)).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>用途</span><select value={props.usage ?? ''} onChange={(event) => props.onChange('usage', event.target.value || undefined)}><option value="">全部</option>{[['weapon','武器'],['armor','防具'],['decoration','装饰珠'],['palico-weapon','猫武器'],['palico-armor','猫防具'],['kinsect','猎虫']].filter(([value]) => props.availableUsages.includes(value)).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="item-filter-bar__debug"><input type="checkbox" checked={props.includePlaceholders} onChange={(event) => props.onChange('debug', event.target.checked ? '1' : undefined)} /><span>显示占位条目</span></label>
    </div>
  )
}
