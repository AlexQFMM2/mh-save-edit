import type { QuestDetail } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import { MonsterIcon } from '../MonsterIcon/MonsterIcon'
import './QuestInfoSection.css'

export function QuestInfoSection({ quest, onSelectMonster }: { quest: QuestDetail; onSelectMonster: (id: number) => void }) {
  const stats = [
    ['体系', quest.systemNameCn],
    ['位阶', quest.levelNameCn],
    ['类型', quest.questTypeNameCn],
    ['地图', quest.locationNameCn],
    ['时间', quest.timeMinutes == null ? '—' : `${quest.timeMinutes} 分钟`],
    ['契约金', quest.fee == null ? '—' : `${quest.fee} z`],
    ['报酬金', quest.reward == null ? '—' : `${quest.reward} z`],
    ['HRP', `${quest.hrp ?? '—'}${quest.hrp2 != null ? ` / ${quest.hrp2}` : ''}`],
  ]

  return (
    <div className="quest-info-section">
      <dl className="quest-info-section__stats">
        {stats.map(([label, value]) => <div className="quest-info-section__stat" key={label}><dt className="quest-info-section__stat-label">{label}</dt><dd className="quest-info-section__stat-value">{value}</dd></div>)}
      </dl>
      <DetailSection title="任务目标" className="quest-info-section__group">
        <p className="quest-info-section__text">{quest.goalCn || '未收录'}</p>
        {quest.subGoalCn && quest.subGoalCn !== '无' && <p className="quest-info-section__text">副目标：{quest.subGoalCn}</p>}
      </DetailSection>
      {quest.modifiers.length > 0 && <DetailSection title="任务状态" className="quest-info-section__group"><p className="quest-info-section__text">{quest.modifiers.map(value => value.nameCn).join('、')}</p></DetailSection>}
      <DetailSection title="出现怪物" className="quest-info-section__group">
        <div className="quest-info-section__monsters">
          {quest.monsters.map(monster => <button className="quest-info-section__monster" key={`${monster.monsterId}-${monster.slot}-${monster.sourceKind}`} type="button" onClick={() => onSelectMonster(monster.monsterId)}><MonsterIcon path={monster.iconPath} name={monster.nameCn} /><span>{monster.nameCn}</span></button>)}
        </div>
      </DetailSection>
    </div>
  )
}
