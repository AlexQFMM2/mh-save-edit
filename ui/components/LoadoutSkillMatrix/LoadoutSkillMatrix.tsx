import { getLoadoutSlots, type LoadoutGame, type LoadoutSkillResult } from '../../../api/loadout/types'
import './LoadoutSkillMatrix.css'

const labels = { weapon: '武器', head: '头', chest: '胸', arms: '腕', waist: '腰', legs: '腿', charm: '护石' }

export function LoadoutSkillMatrix({ skills, gameId = 'mhgu' }: { skills: LoadoutSkillResult[]; gameId?: LoadoutGame }) {
  const slots = getLoadoutSlots(gameId)
  return <section className="loadout-skill-matrix" aria-label="技能矩阵">
    <div className="loadout-skill-matrix__title">技能矩阵</div>
    <div className="loadout-skill-matrix__scroller">
    <div className="loadout-skill-matrix__head"><span>技能系</span><span>{slots.map(slot => labels[slot]).join(' / ')}</span><span>珠子</span><span>倍加 / 特殊</span><span>合计 / 发动</span></div>
    <div className="loadout-skill-matrix__body">{skills.length ? skills.map(skill => <div className="loadout-skill-matrix__row" key={skill.skillId}>
      <span className="loadout-skill-matrix__name" title={skill.specialRule}>{skill.nameCn}</span>
      <span className="loadout-skill-matrix__contributions">{slots.map(slot => <em className="loadout-skill-matrix__contribution" key={slot} title={`${labels[slot]}：${skill[slot]}`}>{skill[slot] || '·'}</em>)}</span>
      <span className="loadout-skill-matrix__decoration">{skill.decorations || '·'}</span>
      <span className="loadout-skill-matrix__decoration">{skill.special || '·'}</span>
      <span className={`loadout-skill-matrix__total${skill.activation ? skill.activation.direction === 'negative' ? ' loadout-skill-matrix__total--negative' : ' loadout-skill-matrix__total--active' : ''}`}>
        {skill.total}{skill.activation ? ` · ${skill.activation.nameCn}` : skill.specialRule ? ' · 特殊规则' : skill.nextActivation ? ` · 还差 ${skill.nextActivation.threshold - skill.total}` : ''}
        {skill.activation?.description && <small className="loadout-skill-matrix__effect">{skill.activation.description}</small>}
      </span>
    </div>) : <p className="loadout-skill-matrix__empty">尚未产生技能贡献</p>}</div>
    </div>
  </section>
}
