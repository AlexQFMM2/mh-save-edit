import type { CatalogArmorSet, CatalogArmorKey } from '../../utils/catalogArmor'
import { useCatalogScroll } from '../../utils/useCatalogScroll'
import { ArmorSetRow } from '../ArmorSetRow/ArmorSetRow'
import './ArmorSetMatrix.css'

type Props = { sets: CatalogArmorSet[]; selectedDexId?: CatalogArmorKey; loading: boolean; error?: string; onSelect: (id: CatalogArmorKey) => void; onRetry?: () => void; scrollKey?: string }
export function ArmorSetMatrix({ sets, selectedDexId, loading, error, onSelect, onRetry, scrollKey }: Props) {
  const scroll = useCatalogScroll(scrollKey, !loading && !error)
  if (error) return <div className="armor-set-matrix armor-set-matrix--state" role="alert"><p>{error}</p>{onRetry && <button className="armor-set-matrix__retry" type="button" onClick={onRetry}>重试列表</button>}</div>
  if (!sets.length && loading) return <div className="armor-set-matrix armor-set-matrix--state" role="status">正在整理套装…</div>
  if (!sets.length) return <div className="armor-set-matrix armor-set-matrix--state">没有符合条件的套装。</div>
  return <div {...scroll} className={`armor-set-matrix${loading ? ' armor-set-matrix--loading' : ''}`} aria-busy={loading}>
    <table className="armor-set-matrix__table">
      <thead className="armor-set-matrix__head"><tr>{['套装名', '头', '胸', '手', '腰', '腿', '类型'].map(label => <th className="armor-set-matrix__heading" key={label}>{label}</th>)}</tr></thead>
      {sets.map(set => <tbody className="armor-set-matrix__body" key={set.setKey}>
        {set.rows.map((row, index) => <tr key={row.combat}>
          {index === 0 && <th className="armor-set-matrix__name" rowSpan={set.rows.length}>
            <strong className="armor-set-matrix__title">{set.rows.find(r => r.nameCn)?.nameCn}</strong>
            {[...new Set(set.rows.map(r => r.nameCn).filter(Boolean))].slice(1).map(name => <small key={name} className="armor-set-matrix__secondary">{name}</small>)}
            {set.gameId === 'mhp3' && <small className="armor-set-matrix__secondary">{{ male: '男性', female: '女性', both: '男女通用' }[set.gender]}{set.standalone ? ' · 独立装备' : ''}</small>}
            <span className="armor-set-matrix__stats">RARE {set.rarity} · 总孔 {set.totalSlots}</span>
            {'matchReason' in set && set.matchReason && <small className="armor-set-matrix__match">{set.matchReason}</small>}
          </th>}
          <ArmorSetRow row={row} selectedDexId={selectedDexId} onSelect={onSelect}/>
        </tr>)}
      </tbody>)}
    </table>
  </div>
}
