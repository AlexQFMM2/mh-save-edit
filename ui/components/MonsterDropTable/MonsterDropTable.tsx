import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import type { ItemIdentity, MonsterDrop } from '../../../api/catalog/types'
import './MonsterDropTable.css'

export function MonsterDropTable({ rows, direction, onDirectionChange, onSelectItem }: {
  rows: MonsterDrop[]; direction: 'asc' | 'desc'
  onDirectionChange: (value: 'asc' | 'desc') => void
  onSelectItem: (item: ItemIdentity) => void
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => a.rankId - b.rankId
    || a.methodNameCn.localeCompare(b.methodNameCn, 'zh-CN')
    || (a.probability == null ? (b.probability == null ? 0 : 1) : b.probability == null ? -1 : direction === 'desc' ? b.probability - a.probability : a.probability - b.probability)
    || a.id - b.id), [rows, direction])
  return <div className="monster-drop-table">
    {!rows.length && <p className="monster-drop-table__empty">暂无掉落资料。</p>}
    <table className="monster-drop-table__table"><thead><tr>
      {['位阶', '道具', '获取方式 / 条件', rows.some(r=>r.p3)?'每次数量':'数量'].map(label => <th className="monster-drop-table__heading" key={label}>{label}</th>)}
      <th className="monster-drop-table__heading"><button className="monster-drop-table__button" type="button"
        aria-label={`概率当前${direction === 'desc' ? '降序' : '升序'}，点击切换`}
        onClick={() => onDirectionChange(direction === 'desc' ? 'asc' : 'desc')}>
        概率 {direction === 'desc' ? <ArrowDown className="monster-drop-table__arrow" aria-hidden="true" /> : <ArrowUp className="monster-drop-table__arrow" aria-hidden="true" />}
      </button></th>
    </tr></thead><tbody>{sorted.map(row => <tr className="monster-drop-table__row" key={row.id}>
      <td className="monster-drop-table__cell">{row.rankNameCn}</td>
      <th className="monster-drop-table__cell"><button className="monster-drop-table__button" type="button" onClick={() => onSelectItem(row.item)}>{row.item.nameCn}</button></th>
      <td className="monster-drop-table__cell">{row.methodNameCn}{row.p3&&<details className="monster-drop-table__conditions"><summary>次数、条件与来源</summary><p>尝试次数：{row.p3.attemptCountJp||'未收录'}</p><p>条件（日文）：{row.p3.conditionJp||'资料未注明'}</p><p>概率来源：{row.p3.source.label}</p><p>原始权重：{row.p3.rawWeight??'未绑定'}</p>{row.p3.rawWeightSource&&<p>{row.p3.rawWeightSource}</p>}</details>}</td>
      <td className="monster-drop-table__data">{row.quantity == null ? '未知' : `× ${row.quantity}`}</td>
      <td className="monster-drop-table__data">{row.probability == null ? '未知' : `${Number.isInteger(row.probability) ? row.probability.toFixed(0) : row.probability.toFixed(2)}%`}</td>
    </tr>)}</tbody></table>
  </div>
}
