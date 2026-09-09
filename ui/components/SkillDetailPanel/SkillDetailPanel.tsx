import type { SkillArmorRelation, SkillCatalogTab, SkillDecorationRelation, SkillDetail } from '../../../api/catalog/types'
import { SkillActivationTable } from '../SkillActivationTable/SkillActivationTable'
import { SkillArmorRelationList } from '../SkillArmorRelationList/SkillArmorRelationList'
import { SkillDecorationRelationList } from '../SkillDecorationRelationList/SkillDecorationRelationList'
import { SkillSourceTabs } from '../SkillSourceTabs/SkillSourceTabs'
import { SkillTalismanRelationList } from '../SkillTalismanRelationList/SkillTalismanRelationList'
import './SkillDetailPanel.css'

type Props = { skill: SkillDetail | null; loading: boolean; error?: string; tab?: SkillCatalogTab; onTabChange?: (tab: SkillCatalogTab) => void; onSelectDecoration: (decoration: SkillDecorationRelation) => void; onSelectArmor: (armor: SkillArmorRelation) => void }
export function SkillDetailPanel({ skill, loading, error, tab = 'armor', onTabChange = () => undefined, onSelectDecoration, onSelectArmor }: Props) {
  if (!skill && loading) return <div className="skill-detail-panel skill-detail-panel--state" role="status">正在读取技能关联资料…</div>
  if (error && !skill) return <div className="skill-detail-panel skill-detail-panel--state" role="alert">{error}</div>
  if (!skill) return <div className="skill-detail-panel skill-detail-panel--state">从左侧选择技能系查看详情。</div>
  return <article className="skill-detail-panel" aria-label={`${skill.nameCn}技能详情`}>
    <header className="skill-detail-panel__header"><div><small className="skill-detail-panel__identity">技能系 #{skill.skillId} · 0x{skill.skillId.toString(16).toUpperCase()}</small><h2 className="skill-detail-panel__title">{skill.nameCn}</h2><p className="skill-detail-panel__subtitle">{[skill.nameEn, skill.nameJp].filter(Boolean).join(' · ')}</p></div>{loading && <span className="skill-detail-panel__updating" role="status">正在更新资料…</span>}</header>
    <div className="skill-detail-panel__scroll">{skill.descriptionCn && <p className="skill-detail-panel__description">{skill.descriptionCn}</p>}<SkillActivationTable activations={skill.activations} /><SkillSourceTabs value={tab} counts={{ armor: skill.armors.length, decoration: skill.decorations.length, talisman: skill.talismans.length }} onChange={onTabChange} /><div className="skill-detail-panel__sources" role="tabpanel" aria-label={tab === 'armor' ? '相关防具' : tab === 'decoration' ? '相关装饰品' : '相关护石'}>{tab === 'armor' ? <SkillArmorRelationList rows={skill.armors} onSelect={onSelectArmor} /> : tab === 'decoration' ? <SkillDecorationRelationList rows={skill.decorations} onSelect={onSelectDecoration} /> : <SkillTalismanRelationList rows={skill.talismans} />}</div></div>
  </article>
}
