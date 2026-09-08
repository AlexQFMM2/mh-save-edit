import type { ArmorSummary } from '../../../api/catalog/types'
import { ArmorListRow } from '../ArmorListRow/ArmorListRow'
import './ArmorList.css'

export function ArmorList({ items, selectedDexId, loading, error, onSelect }: { items: ArmorSummary[]; selectedDexId?: number; loading: boolean; error?: string; onSelect: (dexId: number) => void }) {
  if (!items.length&&loading)return <div className="armor-list armor-list--state" role="status">正在读取防具列表…</div>
  if (!items.length&&error)return <div className="armor-list armor-list--state" role="alert">{error}</div>
  if (!items.length)return <div className="armor-list armor-list--state">没有符合条件的防具。</div>
  return <div className={`armor-list${loading?' armor-list--loading':''}`} aria-busy={loading}>
    <table><thead><tr><th>防具</th><th>部位</th><th>职业</th><th>性别</th><th>稀有</th><th>孔</th><th>基础防御</th><th>最大防御</th><th>火</th><th>水</th><th>雷</th><th>冰</th><th>龙</th><th>技能</th></tr></thead><tbody>{items.map(armor=><ArmorListRow key={armor.dexId} armor={armor} selected={armor.dexId===selectedDexId} onSelect={onSelect}/>)}</tbody></table>
  </div>
}
