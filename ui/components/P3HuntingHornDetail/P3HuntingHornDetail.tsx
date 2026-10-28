import { useState } from 'react'
import type { P3HornTiming, P3WeaponSpecial } from '../../../api/catalog/p3WeaponTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P3HuntingHornDetail.css'

const labels: Record<string,string> = { 白:'白',紫:'紫',赤:'红',青:'蓝',緑:'绿',空:'天蓝',黄:'黄',橙:'橙' }
const colors: Record<string,string> = { 白:'white',紫:'purple',赤:'red',青:'blue',緑:'green',空:'cyan',黄:'yellow',橙:'orange' }
function Notes({ notes }: { notes: string[] }) {
  return <span className="p3-hunting-horn-detail__notes">{notes.map((n,i)=><span className={`p3-hunting-horn-detail__note p3-hunting-horn-detail__note--${colors[n]}`} key={i}>♪ {labels[n] ?? n}</span>)}</span>
}
export function P3HuntingHornDetail({ special }: { special: Extract<P3WeaponSpecial,{kind:'huntingHorn'}> }) {
  const [maestro,setMaestro] = useState(false)
  const timing = (value: P3HornTiming | null) => value ? `${value.mode==='extend'?'+':''}${maestro?value.maestroSeconds:value.seconds} 秒` : '—'
  return <DetailSection title="音色与旋律" className="p3-hunting-horn-detail">
    <Notes notes={special.notes}/>
    <details><summary className="p3-hunting-horn-detail__toggle">旋律（{special.songs.length}）</summary>
      <label className="p3-hunting-horn-detail__check"><input type="checkbox" checked={maestro} onChange={e=>setMaestro(e.target.checked)}/>笛吹名人</label>
      <p className="p3-hunting-horn-detail__hint">时长来自 P3 Wiki。重奏的“+”为延长时间，上限为初奏时长；无“+”为重新计时。“—”表示不适用或资料未提供。</p>
      <ul className="p3-hunting-horn-detail__songs">{special.songs.map(song=><li className="p3-hunting-horn-detail__song" key={song.songKey}>
        <Notes notes={song.notes}/><strong>{song.effectCn}</strong>
        <div className="p3-hunting-horn-detail__timing">初奏 <span>{timing(song.duration)}</span> · 重奏 <span>{timing(song.repeatDuration)}</span></div>
        {song.repeatEffectCn && <p className="p3-hunting-horn-detail__hint">重奏：{song.repeatEffectCn}</p>}
        {song.notesCn && <p className="p3-hunting-horn-detail__hint">{song.notesCn}</p>}
      </li>)}</ul>
    </details>
  </DetailSection>
}
