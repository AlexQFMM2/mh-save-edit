import type { SkillArmorRelation, SkillDecorationRelation, SkillDetail } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './SkillDetailPanel.css'

type Props = {
  skill: SkillDetail | null
  loading: boolean
  error?: string
  onSelectDecoration: (decoration: SkillDecorationRelation) => void
  onSelectArmor: (armor: SkillArmorRelation) => void
}

export function SkillDetailPanel({ skill, loading, error, onSelectDecoration, onSelectArmor }: Props) {
  if (loading) return <div className="skill-detail-panel skill-detail-panel--state" role="status">正在读取技能关联资料…</div>
  if (error) return <div className="skill-detail-panel skill-detail-panel--state" role="alert">{error}</div>
  if (!skill) return <div className="skill-detail-panel skill-detail-panel--state">没有找到该技能。</div>
  return <div className="skill-detail-panel">
    <header className="skill-detail-panel__header"><small className="skill-detail-panel__identity">技能树 #{skill.skillId}</small><h2 className="skill-detail-panel__title">{skill.nameCn}</h2>{skill.nameEn && <p className="skill-detail-panel__subtitle">{skill.nameEn}</p>}</header>
    <div className="skill-detail-panel__scroll">
      {skill.activations.length > 0 && <section className="skill-detail-panel__section"><h3 className="skill-detail-panel__section-title">发动技能</h3><ul className="skill-detail-panel__activation-list">{skill.activations.map((activation, index) => <li className="skill-detail-panel__activation" key={`${activation.nameCn}-${index}`}><strong className="skill-detail-panel__activation-name">{activation.nameCn}</strong>{activation.nameEn && <small className="skill-detail-panel__activation-subtitle">{activation.nameEn}</small>}</li>)}</ul></section>}
      <section className="skill-detail-panel__section"><h3 className="skill-detail-panel__section-title">关联装饰品 <span className="skill-detail-panel__count">{skill.decorations.length}</span></h3>{skill.decorations.length ? <ul className="skill-detail-panel__relation-list">{skill.decorations.map(decoration => <li className="skill-detail-panel__relation" key={decoration.saveId}><button className="skill-detail-panel__relation-button" type="button" onClick={() => onSelectDecoration(decoration)}><span className="skill-detail-panel__relation-icon"><CatalogIcon path={decoration.iconPath} name={decoration.nameCn}/></span><span className="skill-detail-panel__relation-copy"><strong className="skill-detail-panel__relation-name">{decoration.nameCn}</strong><small className="skill-detail-panel__relation-subtitle">{decoration.nameEn}</small></span><EquipmentSlotIndicator slots={decoration.slots}/><b className="skill-detail-panel__points">{decoration.points > 0 ? '+' : ''}{decoration.points}</b></button></li>)}</ul> : <p className="skill-detail-panel__empty">没有关联装饰品。</p>}</section>
      <section className="skill-detail-panel__section"><h3 className="skill-detail-panel__section-title">关联防具 <span className="skill-detail-panel__count">{skill.armors.length}</span></h3>{skill.armors.length ? <ul className="skill-detail-panel__relation-list">{skill.armors.map(armor => <li className="skill-detail-panel__relation" key={armor.dexId}><button className="skill-detail-panel__relation-button" type="button" onClick={() => onSelectArmor(armor)}><span className="skill-detail-panel__relation-icon"><ArmorIcon path={armor.iconPath} name={armor.nameCn}/></span><span className="skill-detail-panel__relation-copy"><strong className="skill-detail-panel__relation-name">{armor.nameCn}</strong><small className="skill-detail-panel__relation-subtitle">{armor.nameEn}</small></span><b className="skill-detail-panel__points">{armor.points > 0 ? '+' : ''}{armor.points}</b></button></li>)}</ul> : <p className="skill-detail-panel__empty">没有关联防具。</p>}</section>
    </div>
  </div>
}
