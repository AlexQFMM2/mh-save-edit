import type { ArmorSkill } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './ArmorSkillList.css'

export function ArmorSkillList({ skills, onSelectSkill }: { skills: ArmorSkill[]; onSelectSkill?: (skillId:number)=>void }) {return <DetailSection title="技能点" className="armor-skill-list">{skills.length?<ul>{skills.map(skill=><li key={skill.skillId}><span>{skill.points>0&&onSelectSkill?<button type="button" onClick={()=>onSelectSkill(skill.skillId)}>{skill.nameCn}</button>:skill.nameCn}{skill.activeSkillNameCn&&<small>{skill.activeSkillNameCn}</small>}</span><strong data-negative={skill.points<0||undefined}>{skill.points>0?'+':''}{skill.points}</strong></li>)}</ul>:<p>没有技能点。</p>}</DetailSection>}
