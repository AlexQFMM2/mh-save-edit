import { P3SkillCharmSources } from '../P3SkillCharmSources/P3SkillCharmSources'
import { useSkillScroll } from '../SkillSearchList/useSkillScroll'
import { useId } from 'react'
import type { P2gSkillEquipmentSummary } from '../../../api/catalog/p2gSkillTypes'
import { P2gSkillNotes } from '../P2gSkillNotes/P2gSkillNotes'
import { P2gSkillEquipmentList } from '../P2gSkillEquipmentList/P2gSkillEquipmentList'
import type { SkillArmorRelation, SkillCatalogTab, SkillDecorationRelation, SkillDetail } from '../../../api/catalog/types'
import { SkillActivationTable } from '../SkillActivationTable/SkillActivationTable'
import { SkillArmorRelationList } from '../SkillArmorRelationList/SkillArmorRelationList'
import { SkillDecorationRelationList } from '../SkillDecorationRelationList/SkillDecorationRelationList'
import { SkillSourceTabs } from '../SkillSourceTabs/SkillSourceTabs'
import { SkillTalismanRelationList } from '../SkillTalismanRelationList/SkillTalismanRelationList'
import './SkillDetailPanel.css'

type Props = { onRetry?: () => void; emptyMessage?: string; scrollKey?: string; onSelectSkill?: (skillId:number)=>void; onSelectP2gEquipment?: (equipment:P2gSkillEquipmentSummary)=>void; skill: SkillDetail | null; loading: boolean; error?: string; tab?: SkillCatalogTab; onTabChange?: (tab: SkillCatalogTab) => void; onSelectDecoration: (decoration: SkillDecorationRelation) => void; onSelectArmor: (armor: SkillArmorRelation) => void }
export function SkillDetailPanel({ skill, loading, error, tab = 'armor', onTabChange = () => undefined, onSelectDecoration, onSelectArmor, onSelectSkill, onSelectP2gEquipment, onRetry, emptyMessage, scrollKey }: Props) {
  const scroll = useSkillScroll(scrollKey, !!skill && !loading)
  const idPrefix = useId()
  const activeTab = skill?.p2g && tab === 'talisman' ? 'armor' : tab
  if (!skill && loading) return <div className="skill-detail-panel skill-detail-panel--state" role="status">正在读取技能关联资料…</div>
  if (error && !skill) return <div className="skill-detail-panel skill-detail-panel--state" ><p role="alert">{error}</p>{onRetry && <button className="skill-detail-panel__retry" type="button" onClick={onRetry}>重试详情</button>}</div>
  if (!skill) return <div className="skill-detail-panel skill-detail-panel--state">{emptyMessage ?? '从左侧选择技能系查看详情。'}</div>
  return <article className="skill-detail-panel" aria-label={`${skill.nameCn}技能详情`}>
    <header className="skill-detail-panel__header"><div><small className="skill-detail-panel__identity">技能系 #{skill.skillId} · 0x{skill.skillId.toString(16).toUpperCase()}</small><h2 className="skill-detail-panel__title">{skill.nameCn}</h2><p className="skill-detail-panel__subtitle">{[skill.nameEn, skill.nameJp].filter(Boolean).join(' · ')}</p></div>{loading && <span className="skill-detail-panel__updating" role="status">正在更新资料…</span>}</header>
    <div className="skill-detail-panel__scroll" {...scroll}>{skill.descriptionCn && <p className="skill-detail-panel__description">{skill.descriptionCn}</p>}{skill.p3 && <p className="skill-detail-panel__source">{skill.p3.source}</p>}{skill.specialRule && <p className="skill-detail-panel__description">{skill.specialRule.descriptionCn}</p>}{skill.p2g && <P2gSkillNotes data={skill.p2g}/>}
    {(skill.activations.length>0 || (!skill.p2g?.specialRule && !skill.specialRule)) && <SkillActivationTable activations={skill.activations} onSelectSkill={onSelectSkill}/>}<SkillSourceTabs idPrefix={idPrefix} includeTalismans={!skill.p2g} value={activeTab} counts={{ armor: skill.p2g?skill.p2g.equipment.filter(e=>e.kind==='armor').length:skill.armors.length, decoration: skill.p2g?skill.p2g.equipment.filter(e=>e.kind==='decoration').length:skill.decorations.length, talisman: skill.p3?.charmSources.length ?? skill.talismans.length }} onChange={onTabChange} /><div id={`${idPrefix}-panel`} className="skill-detail-panel__sources" role="tabpanel" aria-labelledby={`${idPrefix}-tab-${activeTab}`} aria-label={tab === 'armor' ? '相关防具' : tab === 'decoration' ? '相关装饰品' : '相关护石'}>{skill.p2g ? <P2gSkillEquipmentList rows={skill.p2g.equipment.filter(e=>e.kind===activeTab)} onSelect={onSelectP2gEquipment}/> : tab === 'armor' ? <SkillArmorRelationList rows={skill.armors} onSelect={onSelectArmor} /> : tab === 'decoration' ? <SkillDecorationRelationList rows={skill.decorations} onSelect={onSelectDecoration} /> : skill.p3 ? <P3SkillCharmSources rows={skill.p3.charmSources}/> : <SkillTalismanRelationList rows={skill.talismans} />}</div></div>
  </article>
}
