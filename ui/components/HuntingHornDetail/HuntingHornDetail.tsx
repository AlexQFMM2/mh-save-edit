import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import './HuntingHornDetail.css'

export function HuntingHornDetail({ weapon }: { weapon: ExtractWeaponDetail<'huntingHorn'> }) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  return <section className="hunting-horn-detail"><div className="hunting-horn-detail__notes"><span>音色</span>{weapon.notes.map((note, index) => <strong key={`${note.id}-${index}`} title={note.nameEn}>{note.nameCn}</strong>)}</div><button type="button" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((value) => !value)}><span>可演奏旋律</span><small>{weapon.songs.length}</small><ChevronDown aria-hidden="true" /></button>{expanded && <ul id={bodyId}>{weapon.songs.map((song) => <li key={`${song.songId}-${song.rankId}`}><strong>{song.notes} · {song.effectNameCn}</strong><span>{song.encoreEffectNameCn && `重奏：${song.encoreEffectNameCn}`}{song.duration != null && ` · ${song.duration}s`}</span></li>)}</ul>}</section>
}
