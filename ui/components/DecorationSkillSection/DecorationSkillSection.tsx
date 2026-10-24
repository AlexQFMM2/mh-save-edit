import type { DecorationSkill } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './DecorationSkillSection.css'

type Props = { skills: DecorationSkill[]; labelNegative?: boolean; onSelectSkill?: (skillId: number) => void }
export function DecorationSkillSection({ skills, onSelectSkill, labelNegative = false }: Props) {
  return <DetailSection title="技能" className="decoration-skill-section">
    <div className="decoration-skill-section__skills">{skills.length ? skills.map(skill => <div className="decoration-skill-section__row" key={skill.skillId}>
      <span className="decoration-skill-section__identity">
        {labelNegative && skill.points < 0 && <span className="decoration-skill-section__negative-label">负技能</span>}
        {onSelectSkill ? <button className="decoration-skill-section__link" type="button" onClick={() => onSelectSkill(skill.skillId)}>{skill.nameCn}</button> : skill.nameCn}
        <small className="decoration-skill-section__secondary">{skill.nameJp || skill.nameEn}</small>
      </span>
      <strong className={`decoration-skill-section__points${skill.points < 0 ? ' decoration-skill-section__points--negative' : ''}`}>{skill.points > 0 ? '+' : ''}{skill.points}</strong>
      {skill.activeSkillNameCn && <em className="decoration-skill-section__activation">发动阈值：{skill.activeSkillNameCn}</em>}
    </div>) : <p className="decoration-skill-section__empty">没有技能点。</p>}</div>
  </DetailSection>
}
