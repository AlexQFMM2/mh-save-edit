import type { DecorationSkill } from '../../../api/catalog/types'
import './DecorationSkillSection.css'
export function DecorationSkillSection({ skills }: { skills: DecorationSkill[] }) { return <section className="decoration-skill-section"><h3>技能</h3>{skills.map((s)=><div className="decoration-skill-section__row" key={s.skillId}><span>{s.nameCn}<small>{s.nameEn}</small></span><strong className={s.points<0?'negative':''}>{s.points>0?'+':''}{s.points}</strong>{s.activeSkillNameCn&&<em>发动阈值：{s.activeSkillNameCn}</em>}</div>)}</section> }
