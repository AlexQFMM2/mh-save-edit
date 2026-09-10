import { useMemo, useState } from 'react'
import type { AutoLoadoutResult } from '../../../api/loadout/types'
import { AutoLoadoutResultRow } from '../AutoLoadoutResultRow/AutoLoadoutResultRow'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './AutoLoadoutResultList.css'

type ResultSort = 'recommended' | 'defense' | 'slots'

function remainingSlots(result: AutoLoadoutResult): number {
  return result.calculation.slots.reduce((sum, item) => sum + Math.max(0, item.remainingSlots), 0)
}

export function AutoLoadoutResultList({ results, selected, onSelect }: { results: AutoLoadoutResult[]; selected?: string; onSelect: (value: AutoLoadoutResult) => void }) {
  const [sort, setSort] = useState<ResultSort>('recommended')
  const sorted = useMemo(() => {
    if (sort === 'recommended') return results
    return [...results].sort((a, b) => sort === 'defense'
      ? b.calculation.defense - a.calculation.defense || b.calculation.maxDefense - a.calculation.maxDefense || remainingSlots(b) - remainingSlots(a) || a.fingerprint.localeCompare(b.fingerprint)
      : remainingSlots(b) - remainingSlots(a) || b.calculation.defense - a.calculation.defense || b.calculation.maxDefense - a.calculation.maxDefense || a.fingerprint.localeCompare(b.fingerprint))
  }, [results, sort])

  return <div className="auto-loadout-result-list">
    <div className="auto-loadout-result-list__toolbar">
      <span className="auto-loadout-result-list__count">共 <b className="auto-loadout-result-list__count-data">{results.length}</b> 个结果</span>
      <label className="auto-loadout-result-list__sort"><span className="auto-loadout-result-list__sort-label">排序</span><SearchableSelect ariaLabel="自动配装结果排序" value={sort} options={[{ value: 'recommended', label: '推荐顺序' }, { value: 'defense', label: '防御力降序' }, { value: 'slots', label: '剩余孔数降序' }]} onChange={value => setSort(value as ResultSort)} /></label>
    </div>
    <div className="auto-loadout-result-list__scroller">
      {sorted.length ? sorted.map((result, index) => <AutoLoadoutResultRow index={index + 1} key={result.fingerprint} result={result} selected={selected === result.fingerprint} onSelect={() => onSelect(result)} />) : <p className="auto-loadout-result-list__empty">尚无结果。设置目标后开始搜索。</p>}
    </div>
  </div>
}
