import type { P2gHornSong } from '../../../api/catalog/p2gWeaponTypes'
import { p2gHornEffectLabel, p2gNoteLabels } from '../../../api/catalog/p2gWeaponPresentation'
import './P2gHornSongDetail.css'

const note = (id: number) => p2gNoteLabels[id] || `音符 ${id}`
const dataText = (value: string) => value.split(/(\d+(?:\.\d+)?(?:\/\d+)?%?)/g).map((part, index) =>
  index % 2 ? <span className="p2g-horn-song-detail__number" key={index}>{part}</span> : part)
export function P2gHornSongDetail({ song }: { song: P2gHornSong }) {
  const p = song.performance
  return <article className="p2g-horn-song-detail">
    <strong className="p2g-horn-song-detail__title" title={song.effectNameJp}>{p2gHornEffectLabel(song.effectNameJp)}</strong>
    <span className="p2g-horn-song-detail__sequence">{song.notes.map(note).join(' → ')}</span>
    {!p ? <p className="p2g-horn-song-detail__text">持续时间：未知 · 重复演奏效果：未知 · 吹笛名人修正：未知</p> : <>
      <p className="p2g-horn-song-detail__text">{dataText(p.effectCn)}</p>
      {p.kind === 'timed' ? <div className="p2g-horn-song-detail__table-wrap"><table className="p2g-horn-song-detail__table">
        <caption className="p2g-horn-song-detail__caption">效果时间（秒）</caption>
        <thead><tr>{['配置', '初次', '重奏', '重奏上限'].map(label => <th className="p2g-horn-song-detail__heading" scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{([['普通', p.normal], ['吹笛名人', p.maestro]] as const).map(([label, time]) => <tr key={label}>
          <th className="p2g-horn-song-detail__heading" scope="row">{label}</th>
          <td className="p2g-horn-song-detail__value">{time.initialSeconds}</td>
          <td className="p2g-horn-song-detail__value">{time.repeatMode === 'replace' ? '重设 ' : '+'}{time.repeatSeconds}</td>
          <td className="p2g-horn-song-detail__value">{time.repeatCapSeconds}</td>
        </tr>)}</tbody>
      </table></div> : <span className="p2g-horn-song-detail__instant">即时效果</span>}
      <p className="p2g-horn-song-detail__text">重奏：{dataText(p.repeatEffectCn)}</p>
      {p.precedingNoteNot !== null && <p className="p2g-horn-song-detail__text">音符条件：这组旋律之前不能紧接{note(p.precedingNoteNot)}音符；连续演奏时，先插入其他颜色的音符。</p>}
      <details className="p2g-horn-song-detail__rules">
        <summary className="p2g-horn-song-detail__summary">技能与生效条件</summary>
        <p className="p2g-horn-song-detail__text">吹笛名人：{dataText(p.maestroEffectCn)}</p>
        {p.conditions.length > 0 && <ul className="p2g-horn-song-detail__conditions">{p.conditions.map(condition => <li className="p2g-horn-song-detail__condition" key={condition}>{dataText(condition)}</li>)}</ul>}
      </details>
    </>}
  </article>
}
