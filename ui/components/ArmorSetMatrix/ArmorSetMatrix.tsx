import type { ArmorSetSummary } from '../../../api/catalog/types'
import { ArmorSetRow } from '../ArmorSetRow/ArmorSetRow'
import './ArmorSetMatrix.css'

export function ArmorSetMatrix({ sets, selectedDexId, loading, error, onSelect }: { sets: ArmorSetSummary[]; selectedDexId?: number; loading: boolean; error?: string; onSelect: (dexId: number) => void }) {
  if(!sets.length&&loading)return <div className="armor-set-matrix armor-set-matrix--state" role="status">正在整理套装…</div>
  if(!sets.length&&error)return <div className="armor-set-matrix armor-set-matrix--state" role="alert">{error}</div>
  if(!sets.length)return <div className="armor-set-matrix armor-set-matrix--state">没有符合条件的套装。</div>
  return <div className={`armor-set-matrix${loading?' armor-set-matrix--loading':''}`} aria-busy={loading}><table><thead><tr><th>套装名</th><th>头</th><th>胸</th><th>手</th><th>腰</th><th>腿</th><th>类型</th></tr></thead>{sets.map(set=><tbody key={set.setKey}><tr><th className="armor-set-matrix__name" rowSpan={2}><strong>{set.rows[0].nameCn||set.rows[1].nameCn}</strong>{set.rows[1].nameCn&&set.rows[1].nameCn!==set.rows[0].nameCn&&<small>{set.rows[1].nameCn}</small>}<span>RARE {set.rarity} · 总孔 {set.totalSlots}</span></th><ArmorSetRow row={set.rows[0]} selectedDexId={selectedDexId} onSelect={onSelect}/></tr><tr><ArmorSetRow row={set.rows[1]} selectedDexId={selectedDexId} onSelect={onSelect}/></tr></tbody>)}</table></div>
}
