import type { ExtractWeaponDetail } from '../WeaponTypeDetail/weaponTypeDetailTypes'
import './InsectGlaiveDetail.css'
export function InsectGlaiveDetail({ weapon }: { weapon: ExtractWeaponDetail<'insectGlaive'> }) { return <section className="insect-glaive-detail"><h3>猎虫类型</h3><strong>{weapon.kinsectType.nameCn}</strong><small>{weapon.kinsectType.nameEn}</small></section> }
