import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import type { MonsterDrop } from '../../../api/catalog/types'
import './MonsterDropTable.css'

export function MonsterDropTable({ rows, direction, onDirectionChange, onSelectItem }: { rows: MonsterDrop[]; direction: 'asc'|'desc'; onDirectionChange: (value:'asc'|'desc')=>void; onSelectItem:(saveId:number)=>void }) {
  const sorted=useMemo(()=>[...rows].sort((a,b)=>a.rankId-b.rankId||a.methodNameCn.localeCompare(b.methodNameCn,'zh-CN')||(direction==='desc'?b.probability-a.probability:a.probability-b.probability)||a.id-b.id),[rows,direction])
  return <div className="monster-drop-table"><table><thead><tr><th>位阶</th><th>道具</th><th>获取方式 / 条件</th><th>数量</th><th><button type="button" aria-label={`概率当前${direction==='desc'?'降序':'升序'}，点击切换`} onClick={()=>onDirectionChange(direction==='desc'?'asc':'desc')}>概率 {direction==='desc'?<ArrowDown aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}</button></th></tr></thead><tbody>{sorted.map(row=><tr key={row.id}><td>{row.rankNameCn}</td><th><button type="button" onClick={()=>onSelectItem(row.item.saveId)}>{row.item.nameCn}</button></th><td>{row.methodNameCn}</td><td>× {row.quantity}</td><td>{Number.isInteger(row.probability)?row.probability.toFixed(0):row.probability.toFixed(2)}%</td></tr>)}</tbody></table></div>
}
