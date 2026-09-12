import type { WeaponDetail } from '../../../api/catalog/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { WeaponAttributeList } from '../WeaponAttributeList/WeaponAttributeList'
import './WeaponCoreStats.css'

export function WeaponCoreStats({ weapon, compact = false }: { weapon: WeaponDetail; compact?: boolean }) {
  return <section className="weapon-core-stats" aria-label="核心属性">
    <dl className={compact ? 'weapon-core-stats__compact' : undefined}><div><dt>攻击</dt><dd>{weapon.displayAttack ?? '—'}</dd></div>{!compact && <div><dt>真实攻击</dt><dd>{weapon.trueRawAttack ?? '—'}</dd></div>}<div><dt>会心</dt><dd>{weapon.affinity == null ? '—' : `${weapon.affinity}%`}</dd></div>{!compact && <div><dt>防御</dt><dd>{weapon.defense ?? '—'}</dd></div>}<div><dt>孔位</dt><dd><EquipmentSlotIndicator slots={weapon.slots}/></dd></div>{!compact && <div><dt>稀有度</dt><dd>{weapon.rarity ?? '—'}</dd></div>}</dl>
    <div className="weapon-core-stats__attributes"><span>属性</span><WeaponAttributeList attributes={weapon.attributes} /></div>
  </section>
}
