import type { WeaponMotionCatalogResult } from '../../../api/catalog/types'
import { WeaponMotionRow, type WeaponMotionColumns } from '../WeaponMotionRow/WeaponMotionRow'
import './WeaponMotionTable.css'

type Props={result:WeaponMotionCatalogResult|null;loading:boolean;error?:string;expandedKey?:string;onToggle:(key:string)=>void;onSelectHunterArt:(id:number)=>void}
const styleHeaders=['公会','强袭','空战','武士道','炼金','勇气']

function resultColumns(result:WeaponMotionCatalogResult):WeaponMotionColumns{
  const melee=result.kind==='melee'?result.motions:[]
  const bowgun=result.kind==='bowgun'?result.motions:[]
  const bow=result.kind==='bow'?result.motions:[]
  const columns={
    attackType:melee.some(motion=>motion.attackType!=null),
    sharpness:melee.some(motion=>motion.sharpnessModifier!=null),
    exhaust:melee.some(motion=>motion.exhaust!=null),
    stun:melee.some(motion=>motion.stun!=null),
    rapidFire:bowgun.some(motion=>motion.rapidFireModifier!=null),
    siege:bowgun.some(motion=>motion.siegeModifier!=null),
    shotType:bow.some(motion=>motion.shotType!=null),
    chargeLevel:bow.some(motion=>motion.chargeLevel!=null),
    chargeModifier:bow.some(motion=>motion.chargeModifier!=null),
    distanceModifier:bow.some(motion=>motion.distanceModifier!=null),
  }
  const fixedExtra=result.kind==='melee'?1:result.kind==='bowgun'?2:0
  return {...columns,colSpan:9+Object.values(columns).filter(Boolean).length+fixedExtra}
}

export function WeaponMotionTable({result,loading,error,expandedKey,onToggle,onSelectHunterArt}:Props){
  if(error)return <div className="weapon-motion-table weapon-motion-table--state" role="alert">{error}</div>
  if(!result)return <div className="weapon-motion-table weapon-motion-table--state" role="status">{loading?'正在读取动作值…':'暂无动作值数据。'}</div>
  const columns=resultColumns(result)
  return <div className="weapon-motion-table" aria-busy={loading}>
    {loading&&<div className="weapon-motion-table__updating" role="status">正在更新…</div>}
    <table className="weapon-motion-table__table" aria-label={`${result.weaponType.nameCn}动作值`}>
      <thead className="weapon-motion-table__head"><tr>
        <th scope="col" className="weapon-motion-table__header">动作名</th>
        {styleHeaders.map(label=><th scope="col" className="weapon-motion-table__header weapon-motion-table__style" key={label}>{label}</th>)}
        <th scope="col" className="weapon-motion-table__header">{result.kind==='bowgun'?'构成值':'动作值'}</th>
        {result.kind==='melee'&&<>{columns.attackType&&<th scope="col" className="weapon-motion-table__header">攻击系</th>}<th scope="col" className="weapon-motion-table__header">Hit</th>{columns.sharpness&&<th scope="col" className="weapon-motion-table__header">斩味补正</th>}{columns.exhaust&&<th scope="col" className="weapon-motion-table__header">减气</th>}{columns.stun&&<th scope="col" className="weapon-motion-table__header">气绝</th>}</>}
        {result.kind==='bowgun'&&<><th scope="col" className="weapon-motion-table__header">弹体</th><th scope="col" className="weapon-motion-table__header">Hit</th>{columns.rapidFire&&<th scope="col" className="weapon-motion-table__header">速射修正</th>}{columns.siege&&<th scope="col" className="weapon-motion-table__header">蹲射修正</th>}</>}
        {result.kind==='bow'&&<>{columns.shotType&&<th scope="col" className="weapon-motion-table__header">箭型</th>}{columns.chargeLevel&&<th scope="col" className="weapon-motion-table__header">等级</th>}{columns.chargeModifier&&<th scope="col" className="weapon-motion-table__header">蓄力修正</th>}{columns.distanceModifier&&<th scope="col" className="weapon-motion-table__header">距离修正</th>}</>}
        <th scope="col" className="weapon-motion-table__header">分类</th>
      </tr></thead>
      <tbody>{result.motions.map(motion=><WeaponMotionRow key={motion.motionKey} motion={motion} columns={columns} expanded={expandedKey===motion.motionKey} onToggle={()=>onToggle(motion.motionKey)} onSelectHunterArt={onSelectHunterArt}/>)}</tbody>
    </table>
    {!result.motions.length&&<div className="weapon-motion-table__empty">没有符合当前条件的动作。</div>}
  </div>
}
