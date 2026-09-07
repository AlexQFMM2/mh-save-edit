import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import './GunlanceDetail.css'
export function GunlanceDetail({ weapon }: { weapon: ExtractWeaponDetail<'gunlance'> }) { return <section className="gunlance-detail"><h3>炮击</h3><strong>{weapon.shelling.nameCn}</strong><small>{weapon.shelling.nameEn}</small></section> }
