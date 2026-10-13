import type { CatalogWeaponLink } from '../../utils/catalogWeapon'
import { DetailSection } from '../DetailSection/DetailSection'
import './WeaponRelationList.css'

export function WeaponRelationList({ parents, children, onSelectWeapon }: { parents: CatalogWeaponLink[]; children: CatalogWeaponLink[]; onSelectWeapon?: (weapon: CatalogWeaponLink) => void }) {
  if (!parents.length && !children.length) return null
  return <DetailSection title="派生路线" className="weapon-relation-list">{parents.length > 0 && <div className="weapon-relation-list__group"><span className="weapon-relation-list__label">上级</span>{parents.map((weapon) => <button className="weapon-relation-list__link" type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}{children.length > 0 && <div className="weapon-relation-list__group"><span className="weapon-relation-list__label">下级</span>{children.map((weapon) => <button className="weapon-relation-list__link" type="button" key={weapon.weaponKey} onClick={() => onSelectWeapon?.(weapon)}>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</button>)}</div>}</DetailSection>
}
