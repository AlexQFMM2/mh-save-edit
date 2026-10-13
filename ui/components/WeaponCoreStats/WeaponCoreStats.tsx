import type { CatalogWeaponDetail } from '../../utils/catalogWeapon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { WeaponAttributeList } from '../WeaponAttributeList/WeaponAttributeList'
import { DetailSection } from '../DetailSection/DetailSection'
import { DetailStatGrid } from '../DetailStatGrid/DetailStatGrid'
import './WeaponCoreStats.css'

export function WeaponCoreStats({ weapon, compact = false }: { weapon: CatalogWeaponDetail; compact?: boolean }) {
  return <DetailSection title="核心属性" className="weapon-core-stats" ariaLabel="武器核心属性">
    <DetailStatGrid variant={compact ? 'compact' : 'wide'} items={[{ label: '攻击', value: weapon.displayAttack ?? '—' }, ...(!compact ? [{ label: '真实攻击', value: weapon.trueRawAttack ?? '—' }] : []), { label: weapon.gameId === 'mhp2g' ? '原始会心' : '会心', value: weapon.affinity == null ? '—' : `${weapon.affinity}%` }, ...(!compact ? [{ label: '防御', value: weapon.defense ?? '—' }] : []), { label: '孔位', value: <EquipmentSlotIndicator slots={weapon.slots}/> }, ...(!compact ? [{ label: '稀有度', value: weapon.rarity ?? '—' }] : [])]}/>
    <div className="weapon-core-stats__attributes"><span>属性</span><WeaponAttributeList attributes={weapon.attributes} /></div>
  </DetailSection>
}
