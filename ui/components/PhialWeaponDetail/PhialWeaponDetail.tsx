import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import './PhialWeaponDetail.css'
export function PhialWeaponDetail({ weapon }: { weapon: ExtractWeaponDetail<'phialWeapon'> }) { return <section className="phial-weapon-detail"><h3>{weapon.weaponKind === 'chargeBlade' ? '盾斧瓶' : '斩击斧瓶'}</h3><strong>{weapon.phial.nameCn}</strong><small>{weapon.phial.nameEn}</small></section> }
