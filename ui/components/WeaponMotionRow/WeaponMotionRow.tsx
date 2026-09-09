import { ChevronDown } from 'lucide-react'
import type { BowWeaponMotion, BowgunWeaponMotion, MeleeWeaponMotion } from '../../../api/catalog/types'
import { WeaponMotionDetail } from '../WeaponMotionDetail/WeaponMotionDetail'
import { WeaponStyleBadgeList } from '../WeaponStyleBadgeList/WeaponStyleBadgeList'
import './WeaponMotionRow.css'

type Motion=MeleeWeaponMotion|BowgunWeaponMotion|BowWeaponMotion
export type WeaponMotionColumns={attackType:boolean;sharpness:boolean;exhaust:boolean;stun:boolean;rapidFire:boolean;siege:boolean;shotType:boolean;chargeLevel:boolean;chargeModifier:boolean;distanceModifier:boolean;colSpan:number}
const category={standard:'普通',style:'风格',hunterArt:'狩技'} as const
const value=(motion:Motion)=>{
  if(motion.resultKind==='bowgun')return motion.variants.map(variant=>variant.motionValueTotal).filter(value=>value!=null).join(' / ')||'—'
  return motion.motionValueMin==null?'—':motion.motionValueMin===motion.motionValueMax?String(motion.motionValueMin):`${motion.motionValueMin}–${motion.motionValueMax}`
}
export function WeaponMotionRow({motion,columns,expanded,onToggle,onSelectHunterArt}:{motion:Motion;columns:WeaponMotionColumns;expanded:boolean;onToggle:()=>void;onSelectHunterArt:(id:number)=>void}){return <>
  <tr className={`weapon-motion-row${expanded?' weapon-motion-row--expanded':''}`}>
    <td className="weapon-motion-row__cell"><button className="weapon-motion-row__toggle" type="button" aria-expanded={expanded} onClick={onToggle}><ChevronDown className="weapon-motion-row__chevron" aria-hidden="true"/><span className="weapon-motion-row__names"><strong className="weapon-motion-row__name">{motion.nameCn}</strong>{motion.nameEn!==motion.nameCn&&<small className="weapon-motion-row__secondary-name">{motion.nameEn}</small>}</span></button></td>
    <WeaponStyleBadgeList styles={motion.styles} asCells/>
    <td className="weapon-motion-row__cell weapon-motion-row__value">{value(motion)}</td>
    {motion.resultKind==='melee'?<>{columns.attackType&&<td className="weapon-motion-row__cell">{motion.attackType}</td>}<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.hitCountMin===motion.hitCountMax?motion.hitCountMin:`${motion.hitCountMin}–${motion.hitCountMax}`}</td>{columns.sharpness&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.sharpnessModifier}</td>}{columns.exhaust&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.exhaust}</td>}{columns.stun&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.stun}</td>}</>:motion.resultKind==='bowgun'?<><td className="weapon-motion-row__cell">{motion.projectileKind}</td><td className="weapon-motion-row__cell weapon-motion-row__value">{motion.hitCountMin===motion.hitCountMax?motion.hitCountMin:`${motion.hitCountMin}–${motion.hitCountMax}`}</td>{columns.rapidFire&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.rapidFireModifier}</td>}{columns.siege&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.siegeModifier}</td>}</>:<>{columns.shotType&&<td className="weapon-motion-row__cell">{motion.shotType??'—'}</td>}{columns.chargeLevel&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.chargeLevel??'—'}</td>}{columns.chargeModifier&&<td className="weapon-motion-row__cell weapon-motion-row__value">{motion.chargeModifier}</td>}{columns.distanceModifier&&<td className="weapon-motion-row__cell">{motion.distanceModifier}</td>}</>}
    <td className="weapon-motion-row__cell"><span className={`weapon-motion-row__category weapon-motion-row__category--${motion.category}`}>{category[motion.category]}</span></td>
  </tr>
  {expanded&&<tr className="weapon-motion-row__detail"><td className="weapon-motion-row__detail-cell" colSpan={columns.colSpan}><WeaponMotionDetail motion={motion} onSelectHunterArt={onSelectHunterArt}/></td></tr>}
  </>}
