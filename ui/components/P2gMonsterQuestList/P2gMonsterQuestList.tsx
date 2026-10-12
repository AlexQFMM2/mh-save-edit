import type { P2gMonsterQuest } from '../../../api/catalog/types'
import './P2gMonsterQuestList.css'

export function P2gMonsterQuestList({ quests, onSelectQuest }: {
  quests: P2gMonsterQuest[]; onSelectQuest: (key: string) => void
}) {
  return <div className="p2g-monster-quest-list">
    <p className="p2g-monster-quest-list__note">点击任务查看详情；旧 Wiki 的个体数值按来源分别保留。</p>
    {!quests.length && <p className="p2g-monster-quest-list__note">暂无出没任务资料。</p>}
    <table className="p2g-monster-quest-list__table"><thead><tr>
      {['任务', '类别 / 难度', '体力'].map(label => <th key={label} className="p2g-monster-quest-list__heading">{label}</th>)}
    </tr></thead><tbody>{quests.map((quest, index) => <tr key={`${quest.sourceKey ?? quest.questKey}:${index}`}>
      <th className="p2g-monster-quest-list__cell"><button className="p2g-monster-quest-list__button" type="button" onClick={() => onSelectQuest(quest.questKey)}>{quest.nameCn ?? quest.nameJp}</button>{quest.nameCn && <small className="p2g-monster-quest-list__alternate">{quest.nameJp}</small>}</th>
      <td className="p2g-monster-quest-list__cell">{quest.fields.filter(field => ['区分', '難度'].includes(field.label)).map(field => field.value).join(' · ') || '未知'}</td>
      <td className="p2g-monster-quest-list__data">{quest.fields.find(field => field.label === '体力')?.value || '未知'}</td>
    </tr>)}</tbody></table>
  </div>
}
