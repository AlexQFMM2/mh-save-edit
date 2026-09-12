import type { ReactNode } from 'react'
import type { PalicoArmorDetail, PalicoWeaponDetail } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { PalicoSharpnessLevel } from '../PalicoSharpnessLevel/PalicoSharpnessLevel'
import './PalicoEquipmentDetailPanel.css'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'

type Props={detail:PalicoWeaponDetail|PalicoArmorDetail|null;loading:boolean;error?:string;allowCatalogWrite?:boolean;onSelectItem:(id:number)=>void}
export function PalicoEquipmentDetailPanel({detail,loading,error,allowCatalogWrite=true,onSelectItem}:Props){
  if(!detail)return <aside className="palico-equipment-detail-panel palico-equipment-detail-panel--state">{error??(loading?'正在读取猫装备详情…':'选择装备查看详情。')}</aside>
  const weapon=detail.kind==='weapon'
  return <aside className="palico-equipment-detail-panel">
    <header className="palico-equipment-detail-panel__header"><CatalogIcon path={detail.iconPath} name={detail.nameCn} size="large"/><div className="palico-equipment-detail-panel__identity"><small className="palico-equipment-detail-panel__eyebrow">{weapon?'猫武器':'猫防具'} #{detail.equipmentId} · 稀有度 {detail.rarity}</small><h2 className="palico-equipment-detail-panel__title">{detail.nameCn}</h2><p className="palico-equipment-detail-panel__name">{detail.nameEn}</p><p className="palico-equipment-detail-panel__name">{detail.nameJp}</p></div>{loading&&<span role="status">正在更新…</span>}</header>
    {allowCatalogWrite&&<CatalogWriteControl gameId="mhgu" kind="equipment" domain="palico-equipment" saveType={weapon?22:detail.part==='head'?23:24} saveId={detail.saveId}/>}<div className="palico-equipment-detail-panel__scroll">
      {weapon?<dl className="palico-equipment-detail-panel__stats"><Stat label="攻击类型" value={detail.attackType==='cut'?'斩击':'打击'}/><Stat label="特化" value={detail.specializationCn}/><Stat label="近战" value={`${detail.meleeAttack} / 会心 ${signed(detail.meleeAffinity)}%`}/><Stat label="远程" value={`${detail.rangedAttack} / 会心 ${signed(detail.rangedAffinity)}%`}/><Stat label="属性/异常" value={detail.specialAttackCn?`${detail.specialAttackCn} ${detail.specialAttackValue??''}`:'无'}/><Stat label="斩味" value={<PalicoSharpnessLevel value={detail.sharpnessId}/>}/><Stat label="防御" value={detail.defense}/><Stat label="价格" value={`${detail.price} z`}/></dl>:<dl className="palico-equipment-detail-panel__stats"><Stat label="部位" value={detail.part==='head'?'头部':'身体'}/><Stat label="防御" value={detail.defense}/><Stat label="火耐性" value={signed(detail.fireRes)}/><Stat label="水耐性" value={signed(detail.waterRes)}/><Stat label="雷耐性" value={signed(detail.thunderRes)}/><Stat label="冰耐性" value={signed(detail.iceRes)}/><Stat label="龙耐性" value={signed(detail.dragonRes)}/><Stat label="价格" value={`${detail.price} z`}/></dl>}
      <section className="palico-equipment-detail-panel__section"><h3 className="palico-equipment-detail-panel__section-title">装备说明</h3><p className="palico-equipment-detail-panel__paragraph">{detail.descriptionCn||'暂无说明。'}</p>{detail.descriptionEn&&<p className="palico-equipment-detail-panel__paragraph palico-equipment-detail-panel__secondary">{detail.descriptionEn}</p>}</section>
      <section className="palico-equipment-detail-panel__section"><h3 className="palico-equipment-detail-panel__section-title">制作材料</h3><div className="palico-equipment-detail-panel__materials">{detail.materials.length?detail.materials.map((material,index)=><button className="palico-equipment-detail-panel__material" type="button" key={`${material.saveId}-${index}`} onClick={()=>onSelectItem(material.saveId)}><span className="palico-equipment-detail-panel__material-name"><strong>{material.nameCn}</strong><small className="palico-equipment-detail-panel__material-subtitle">{material.nameEn}</small></span><b className="palico-equipment-detail-panel__material-quantity">×{material.quantity}</b></button>):<p className="palico-equipment-detail-panel__paragraph">未收录制作材料。</p>}</div></section>
    </div>
  </aside>
}
const signed=(value:number)=>value>0?`+${value}`:String(value)
function Stat({label,value}:{label:string;value:ReactNode}){return <div className="palico-equipment-detail-panel__stat"><dt className="palico-equipment-detail-panel__stat-label">{label}</dt><dd className="palico-equipment-detail-panel__stat-value">{value}</dd></div>}
