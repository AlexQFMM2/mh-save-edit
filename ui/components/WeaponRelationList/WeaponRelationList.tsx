import type { WeaponLink } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './WeaponRelationList.css'

export function WeaponRelationList({ parents, children, onSelectWeapon }: { parents: WeaponLink[]; children: WeaponLink[]; onSelectWeapon?: (weapon: WeaponLink) => void }) {
  if (!parents.length && !children.length) return null
  return <DetailSection title="派生路线" className="weapon-relation-list">{parents.length > 0 && <div><span>上级</span>{parents.map((weapon) => <button type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}{children.length > 0 && <div><span>下级</span>{children.map((weapon) => <button type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}</DetailSection>
}
