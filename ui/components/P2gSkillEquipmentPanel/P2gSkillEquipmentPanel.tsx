import type { P2gSkillEquipmentDetail } from '../../../api/catalog/p2gSkillTypes'
import type { ItemIdentity } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { DetailSection } from '../DetailSection/DetailSection'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './P2gSkillEquipmentPanel.css'
export function P2gSkillEquipmentPanel({equipment,loading,error,onSelectSkill,onSelectItem}:{equipment:P2gSkillEquipmentDetail|null;loading:boolean;error?:string;onSelectSkill:(id:number)=>void;onSelectItem:(item:ItemIdentity)=>void}) {
  if(loading)return <p className="p2g-skill-equipment-panel__state" role="status">正在读取装备技能资料…</p>
  if(error)return <p className="p2g-skill-equipment-panel__state" role="alert">{error}</p>
  if(!equipment)return <p className="p2g-skill-equipment-panel__state">未找到对应装备资料。</p>
  return <article className="p2g-skill-equipment-panel"><header className="p2g-skill-equipment-panel__header">{equipment.iconPath&&<CatalogIcon path={equipment.iconPath} name={equipment.nameCn} size="large"/>}<div><h2 className="p2g-skill-equipment-panel__title">{equipment.nameCn}</h2><p className="p2g-skill-equipment-panel__note">{equipment.nameJp} · {equipment.nameSource}</p></div></header><div className="p2g-skill-equipment-panel__slots">占孔数 <EquipmentSlotIndicator slots={equipment.slots}/></div>
    <DetailSection title="技能点">{equipment.skills.map((s,index)=><div className="p2g-skill-equipment-panel__row" key={`${s.skillId}:${index}`}><button className="p2g-skill-equipment-panel__link" type="button" onClick={()=>onSelectSkill(s.skillId)}>{s.nameCn}<span className="p2g-skill-equipment-panel__secondary">{s.nameJp}</span></button><strong className="p2g-skill-equipment-panel__data">{s.points>0?'+':''}{s.points}</strong></div>)}</DetailSection>
    {equipment.kind==='decoration'&&<><DetailSection title="生产材料">{equipment.recipes.map((recipe,index)=><div className="p2g-skill-equipment-panel__recipe" key={recipe.recipeKey}><h3 className="p2g-skill-equipment-panel__recipe-title">配方 {index+1}</h3>{recipe.materials.map((m,i)=><div className="p2g-skill-equipment-panel__row" key={i}><button className="p2g-skill-equipment-panel__link" type="button" onClick={()=>onSelectItem(m.item)}>{m.item.nameCn}</button><span className="p2g-skill-equipment-panel__data">×{m.quantity}</span></div>)}</div>)}<p className="p2g-skill-equipment-panel__note">生产费用及解锁条件未收录。</p></DetailSection>{equipment.itemId!=null&&<button className="p2g-skill-equipment-panel__link" type="button" onClick={()=>onSelectItem({gameId:'mhp2g',itemId:equipment.itemId!})}>查看道具详情与获取来源</button>}</>}
  </article>
}
