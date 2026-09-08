import type { QuestDetail } from '../../../api/catalog/types'
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
      <section className="quest-info-section__group">
        <h3 className="quest-info-section__heading">任务目标</h3>
        <p className="quest-info-section__text">{quest.goalCn || '未收录'}</p>
        {quest.subGoalCn && quest.subGoalCn !== '无' && <p className="quest-info-section__text">副目标：{quest.subGoalCn}</p>}
      </section>
      {quest.modifiers.length > 0 && <section className="quest-info-section__group"><h3 className="quest-info-section__heading">任务状态</h3><p className="quest-info-section__text">{quest.modifiers.map(value => value.nameCn).join('、')}</p></section>}
      <section className="quest-info-section__group">
        <h3 className="quest-info-section__heading">出现怪物</h3>
        <div className="quest-info-section__monsters">
          {quest.monsters.map(monster => <button className="quest-info-section__monster" key={`${monster.monsterId}-${monster.slot}-${monster.sourceKind}`} type="button" onClick={() => onSelectMonster(monster.monsterId)}><MonsterIcon path={monster.iconPath} name={monster.nameCn} /><span>{monster.nameCn}</span></button>)}
        </div>
      </section>
    </div>
  )
}
