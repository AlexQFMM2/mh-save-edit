import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { P3MonsterAppearance } from '../../../api/catalog/p3MonsterTypes'
import type { MonsterSummary } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import './P3MonsterAppearances.css'

export function P3MonsterAppearanceList({ rows, onSelect }: { rows: P3MonsterAppearance[]; onSelect: (key: string) => void }) {
  return <div className="p3-monster-appearances"><p className="p3-monster-appearances__note">本作独立资料的出没观察。点击查看该任务中这只怪物的数值与条件。</p>
    {!rows.length ? <p className="p3-monster-appearances__note">尚未收录此原生身份的逐任务出没资料。</p> : <table className="p3-monster-appearances__table"><thead><tr>{['任务', '类别／难度', '体力'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.sourceKey} data-appearance-key={r.sourceKey}><th><button type="button" className="p3-monster-appearances__link" onClick={() => onSelect(r.sourceKey)}>{r.nameCn || r.nameJp}</button></th><td>{r.fields.filter(f => ['任务类别', '位阶', '难度'].includes(f.label)).map(f => f.value).join(' · ')}</td><td className="p3-monster-appearances__data">{r.fields.find(f => f.label === '体力')?.value || '未知'}</td></tr>)}</tbody></table>}
  </div>
}
export function P3MonsterAppearanceDrawer({ sourceKey, appearance, monster, onClose }: { sourceKey: string | null; appearance?: P3MonsterAppearance; monster: MonsterSummary | null; onClose: () => void }) {
  const navigate = useNavigate()
  if (!sourceKey) return null
  return createPortal(<DetailDrawer title="P3 出没资料" onClose={onClose}><div className="p3-monster-appearances p3-monster-appearances--drawer">
    {appearance && monster ? <><h2>{appearance.nameCn || appearance.nameJp}</h2><p className="p3-monster-appearances__note">以下为此任务中的关联怪物观察；缺项保留未知。倍率与防御率保留资料原值，未作换算。来源：{appearance.source.label}。</p>
      <button type="button" className="p3-monster-appearances__link" onClick={() => { onClose(); navigate(`/game/mhp3/catalog/monsters?monster=${monster.monsterId}&target=${monster.monsterId}&tab=quests&appearance=${encodeURIComponent(appearance.sourceKey)}`) }}>{monster.nameCn} · 定位出没资料</button>
      <dl className="p3-monster-appearances__fields">{appearance.fields.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value || '未知'}</dd></div>)}</dl></> : <p className="p3-monster-appearances__note">未找到此怪物的出没观察。</p>}
  </div></DetailDrawer>, document.body)
}
