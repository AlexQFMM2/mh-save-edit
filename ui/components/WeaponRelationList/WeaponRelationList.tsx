import type { WeaponLink } from '../../../api/catalog/types'
import './WeaponRelationList.css'

export function WeaponRelationList({ parents, children, onSelectWeapon }: { parents: WeaponLink[]; children: WeaponLink[]; onSelectWeapon?: (weapon: WeaponLink) => void }) {
  if (!parents.length && !children.length) return null
  return <section className="weapon-relation-list"><h3>派生路线</h3>{parents.length > 0 && <div><span>上级</span>{parents.map((weapon) => <button type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}{children.length > 0 && <div><span>下级</span>{children.map((weapon) => <button type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}</section>
}
