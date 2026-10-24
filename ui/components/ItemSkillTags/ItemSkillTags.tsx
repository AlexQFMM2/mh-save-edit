import type { P3ItemDecoration } from '../../../api/catalog/p3ItemTypes'
import './ItemSkillTags.css'

export function ItemSkillTags({ decoration }: { decoration?: P3ItemDecoration | null }) {
  if (!decoration) return null
  return <span className="item-skill-tags">
    <span className="item-skill-tags__tag">{decoration.slots} 孔</span>
    {decoration.skills.map(skill => <span className="item-skill-tags__tag" key={skill.id} title={`${skill.nameJp} · ${skill.nameEn}`}>
      {skill.points < 0 ? '负技能：' : ''}{skill.nameCn} {skill.points > 0 ? '+' : ''}{skill.points}
    </span>)}
  </span>
}
