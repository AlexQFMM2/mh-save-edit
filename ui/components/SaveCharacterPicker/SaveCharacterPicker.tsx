import { Clock3, UserRound } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { SaveCharacterSummary } from '../../../api/save/types'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'
import './SaveCharacterPicker.css'

export function SaveCharacterPicker({ characters, busy, selectedSlot: initialSelectedSlot, onSelect, onClose }: { characters: SaveCharacterSummary[]; busy: boolean; selectedSlot?: number | null; onSelect(slot: number): void; onClose(): void }) {
  const used = useMemo(() => characters.filter(value => value.used), [characters])
  const [selectedSlot, setSelectedSlot] = useState(used.some(value => value.slot === initialSelectedSlot) ? initialSelectedSlot! : used[0]?.slot ?? -1)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, slot: number) => {
    const index = used.findIndex(value => value.slot === slot)
    let next = index
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(used.length - 1, index + 1)
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = used.length - 1
    else if (event.key === 'Enter' && slot === selectedSlot) { event.preventDefault(); onSelect(slot); return }
    else return
    event.preventDefault()
    const candidate = used[next]
    if (!candidate) return
    setSelectedSlot(candidate.slot)
    buttons.current[candidate.slot]?.focus()
  }
  return <WorkspaceDrawer title="选择要修改的角色" busy={busy} onClose={onClose}><div className="save-character-picker"><p>这份存档包含多个角色。单击预览，双击或在选中项上按 Enter 确认。</p><div role="listbox" aria-label="角色槽">{characters.map(value => <button ref={element => { buttons.current[value.slot] = element }} key={value.slot} type="button" role="option" aria-selected={value.slot === selectedSlot} tabIndex={value.used && value.slot === selectedSlot ? 0 : -1} disabled={!value.used || busy} onDoubleClick={() => onSelect(value.slot)} onClick={() => setSelectedSlot(value.slot)} onKeyDown={event => move(event, value.slot)}><UserRound aria-hidden="true" /><span><strong>{value.used ? value.name || '未命名角色' : '空角色槽'}</strong><small>角色槽 {value.slot + 1} · HR {value.hunterRank}</small></span><span><Clock3 aria-hidden="true" />{Math.floor(value.playTimeSeconds / 3600)} 小时</span></button>)}</div><span className="save-character-picker__hint">确认后编辑当前角色，其他角色保持原样。</span></div></WorkspaceDrawer>
}
