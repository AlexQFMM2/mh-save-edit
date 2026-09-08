import type { MonsterDetail } from '../../../api/catalog/types'
import { MonsterIcon } from '../MonsterIcon/MonsterIcon'
import './MonsterDetailHeader.css'

export function MonsterDetailHeader({ monster, updating }: { monster: MonsterDetail; updating: boolean }) {
  const counts=[['肉质',monster.weakness.length],['异常',monster.ailments.length+monster.traps.length],['掉落',monster.drops.length],['任务',monster.quests.length]] as const
  return <header className="monster-detail-header"><MonsterIcon path={monster.iconLargePath} name={monster.nameCn} size="large"/><div className="monster-detail-header__identity"><small>怪物 #{monster.monsterId} · 0x{monster.monsterId.toString(16).toUpperCase()}</small><h2>{monster.nameCn}</h2>{monster.nameEn&&<p>{monster.nameEn}</p>}{monster.nameJp&&<p>{monster.nameJp}</p>}{updating&&<span className="monster-detail-header__updating" aria-live="polite">正在更新资料…</span>}</div><dl className="monster-detail-header__counts">{counts.map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl></header>
}
