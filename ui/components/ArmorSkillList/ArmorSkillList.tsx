import type { ArmorSkill } from '../../../api/catalog/types'
import './ArmorSkillList.css'

export function ArmorSkillList({ skills, onSelectSkill }: { skills: ArmorSkill[]; onSelectSkill?: (skillId:number)=>void }) {return <section className="armor-skill-list"><h3>技能点</h3>{skills.length?<ul>{skills.map(skill=><li key={skill.skillId}><span>{skill.points>0&&onSelectSkill?<button type="button" onClick={()=>onSelectSkill(skill.skillId)}>{skill.nameCn}</button>:skill.nameCn}{skill.activeSkillNameCn&&<small>{skill.activeSkillNameCn}</small>}</span><strong data-negative={skill.points<0||undefined}>{skill.points>0?'+':''}{skill.points}</strong></li>)}</ul>:<p>没有技能点。</p>}</section>}
