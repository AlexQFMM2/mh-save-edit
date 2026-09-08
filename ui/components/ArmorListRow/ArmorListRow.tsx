import type { ArmorSummary } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './ArmorListRow.css'

const partLabel={head:'头',chest:'胸',arms:'手',waist:'腰',legs:'腿'}
const combatLabel={both:'通用',blademaster:'近战',gunner:'远程'}
const genderLabel={both:'通用',male:'男性',female:'女性'}
export function ArmorListRow({ armor, selected, onSelect }: { armor: ArmorSummary; selected: boolean; onSelect: (dexId: number) => void }) {
  const skills=armor.skills.slice(0,2).map(skill=>`${skill.nameCn} ${skill.points>0?'+':''}${skill.points}`).join(' · ')
  return <tr className="armor-list-row" data-selected={selected||undefined}>
    <td><button type="button" aria-pressed={selected} onClick={()=>onSelect(armor.dexId)}><ArmorIcon path={armor.iconPath} name={armor.nameCn}/><span><strong>{armor.nameCn}</strong><small>{armor.nameEn}</small></span></button></td>
    <td>{partLabel[armor.part]}</td><td>{combatLabel[armor.combat]}</td><td>{genderLabel[armor.gender]}</td><td>{armor.rarity}</td><td><EquipmentSlotIndicator slots={armor.slots}/></td><td>{armor.baseDefense}</td><td>{armor.maxDefense}</td><td>{armor.fireRes}</td><td>{armor.waterRes}</td><td>{armor.thunderRes}</td><td>{armor.iceRes}</td><td>{armor.dragonRes}</td><td title={skills}>{skills||'—'}</td>
  </tr>
}
