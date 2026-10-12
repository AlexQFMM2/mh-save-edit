import type { P2gSkillData } from '../../../api/catalog/p2gSkillTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gSkillNotes.css'
export function P2gSkillNotes({data}:{data:P2gSkillData}) {
  return <div className="p2g-skill-notes"><p className="p2g-skill-notes__source">名称：{data.nameSource}。发动点数与效果依据 P2G Wiki。</p>{data.specialRule && <DetailSection title="特殊规则"><p className="p2g-skill-notes__description">{data.specialRule.descriptionCn}</p><details className="p2g-skill-notes__original"><summary>查看日文说明</summary>{data.specialRule.descriptionJp}</details><p className="p2g-skill-notes__source">资料来源：{data.sourceUrl}</p></DetailSection>}</div>
}
