import type { P2gSkillEquipmentSummary } from '../../../api/catalog/p2gSkillTypes'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './P2gSkillEquipmentList.css'
const parts={head:'头部',chest:'胸部',arms:'腕部',waist:'腰部',legs:'腿部'}
export function P2gSkillEquipmentList({rows,onSelect}:{rows:P2gSkillEquipmentSummary[];onSelect?:(row:P2gSkillEquipmentSummary)=>void}) {
  return <div className="p2g-skill-equipment-list">{!rows.length?<p className="p2g-skill-equipment-list__empty">本作没有此类装备提供该技能点。</p>:rows.map((row,index)=><button type="button" className="p2g-skill-equipment-list__row" key={`${row.equipmentKey}:${index}`} onClick={()=>onSelect?.(row)}>
    {row.iconPath && <CatalogIcon path={row.iconPath} name={row.nameCn} size="small"/>}<span className="p2g-skill-equipment-list__copy"><strong className="p2g-skill-equipment-list__name">{row.nameCn}</strong><small className="p2g-skill-equipment-list__secondary">{row.part?`${parts[row.part]} · `:''}{row.nameJp}</small></span><EquipmentSlotIndicator slots={row.slots}/><span className="p2g-skill-equipment-list__points">{row.points>0?'+':''}{row.points}</span>
  </button>)}</div>
}
