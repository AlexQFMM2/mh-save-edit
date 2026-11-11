import type { KeyboardEvent } from 'react'
import type { MonsterSummary } from '../../../api/catalog/types'
import { MonsterIcon } from '../MonsterIcon/MonsterIcon'
import './MonsterListRow.css'

export function MonsterListRow({ monster, selected, tabIndex, onSelect, onKeyDown }: { monster: MonsterSummary; selected: boolean; tabIndex: number; onSelect: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className={`monster-list-row${selected?' monster-list-row--selected':''}`} aria-pressed={selected} tabIndex={tabIndex} onClick={onSelect} onKeyDown={onKeyDown}>
    <MonsterIcon path={monster.iconSmallPath} name={monster.nameCn} pixelated={monster.gameId==='mhp2g'||monster.gameId==='mhp3'}/><span className="monster-list-row__identity"><span className="monster-list-row__name">{monster.nameCn}{monster.sizeClass&&<small className="monster-list-row__kind">{monster.recordScope==='extended'?'扩展':monster.sizeClass==='large'?'大型':'小型'}</small>}</span>{monster.matchReason && <span className="monster-list-row__match" title={monster.matchReason}>{monster.matchReason}</span>}</span><span className="monster-list-row__id">#{monster.monsterId}</span>
  </button>
}
