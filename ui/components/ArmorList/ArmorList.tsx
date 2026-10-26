import { useCatalogScroll } from '../../utils/useCatalogScroll'
import { armorKey, type CatalogArmorSummary, type CatalogArmorKey } from '../../utils/catalogArmor'
import { ArmorListRow } from '../ArmorListRow/ArmorListRow'
import './ArmorList.css'

export function ArmorList({ mode = 'browse', items, selectedDexId, loading, error, onRetry, scrollKey, onSelect }: { mode?: 'browse' | 'select'; items: CatalogArmorSummary[]; selectedDexId?: CatalogArmorKey; loading: boolean; error?: string; onRetry?: () => void; scrollKey?: string; onSelect: (dexId: CatalogArmorKey) => void }) {
  const scroll = useCatalogScroll(scrollKey, !loading && !error)
  if (error)return <div className="armor-list armor-list--state" role="alert"><p>{error}</p>{onRetry&&<button className="armor-list__retry" type="button" onClick={onRetry}>重试列表</button>}</div>
  if (!items.length&&loading)return <div className="armor-list armor-list--state" role="status">正在读取防具列表…</div>
  if (!items.length)return <div className="armor-list armor-list--state">没有符合条件的防具。</div>
  return <div {...scroll} className={`armor-list${loading?' armor-list--loading':''}`} aria-busy={loading} aria-label={mode === 'select' ? '选择防具候选' : '防具列表'}>
    <table className="armor-list__table"><thead className="armor-list__head"><tr><th className="armor-list__heading">防具</th><th className="armor-list__heading">部位</th><th className="armor-list__heading">职业</th><th className="armor-list__heading">性别</th><th className="armor-list__heading">稀有</th><th className="armor-list__heading">孔</th><th className="armor-list__heading">基础防御</th><th className="armor-list__heading">最大防御</th><th className="armor-list__heading">火</th><th className="armor-list__heading">水</th><th className="armor-list__heading">雷</th><th className="armor-list__heading">冰</th><th className="armor-list__heading">龙</th><th className="armor-list__heading">技能</th></tr></thead><tbody className="armor-list__body">{items.map(armor=><ArmorListRow key={armorKey(armor)} armor={armor} selected={armorKey(armor)===selectedDexId} onSelect={onSelect}/>)}</tbody></table>
  </div>
}
