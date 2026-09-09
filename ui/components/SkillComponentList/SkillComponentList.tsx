import type { SkillActivationLink } from '../../../api/catalog/types'
import './SkillComponentList.css'
export function SkillComponentList({ components }: { components: SkillActivationLink[] }) { return components.length ? <ul className="skill-component-list">{components.map(component => <li key={component.activationKey}>{component.nameCn}<small>{component.nameEn}</small></li>)}</ul> : <span className="skill-component-list__empty">—</span> }
