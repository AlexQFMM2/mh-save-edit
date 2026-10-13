import { useId, useState } from 'react'
import type { P2gWeaponSpecial } from '../../../api/catalog/p2gWeaponTypes'
import { p2gNoteLabels } from '../../../api/catalog/p2gWeaponPresentation'
import { DetailSection } from '../DetailSection/DetailSection'
import { P2gHornSongDetail } from '../P2gHornSongDetail/P2gHornSongDetail'
import './P2gHuntingHornDetail.css'

const note = (id: number) => p2gNoteLabels[id] || `音符 ${id}`
export function P2gHuntingHornDetail({ special }: { special: Extract<P2gWeaponSpecial, { kind: 'huntingHorn' }> }) {
  const [expanded, setExpanded] = useState(false), id = useId()
  return <DetailSection title="音色与旋律" className="p2g-hunting-horn-detail">
    <div className="p2g-hunting-horn-detail__notes" aria-label={`音色：${special.notes.map(note).join('、')}`}>{special.notes.map((n, i) => <span className={`p2g-hunting-horn-detail__note p2g-hunting-horn-detail__note--${n}`} key={i}>♪ {note(n)}</span>)}</div>
    <button className="p2g-hunting-horn-detail__toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(v => !v)}>{expanded ? '收起' : '展开'}旋律（{special.songs.length}）</button>
    {expanded && <ul className="p2g-hunting-horn-detail__songs" id={id}>{special.songs.map(song => <li key={song.patternIndex}><P2gHornSongDetail song={song} /></li>)}</ul>}
  </DetailSection>
}
