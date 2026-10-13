import { armorKey, type CatalogArmorSummary, type CatalogArmorKey } from '../../utils/catalogArmor'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './ArmorListRow.css'

const partLabel={head:'头',chest:'胸',arms:'手',waist:'腰',legs:'腿'}
const combatLabel={both:'通用',blademaster:'近战',gunner:'远程'}
const genderLabel={both:'通用',male:'男性',female:'女性'}
export function ArmorListRow({ armor, selected, onSelect }: { armor: CatalogArmorSummary; selected: boolean; onSelect: (dexId: CatalogArmorKey) => void }) {
  const skills=armor.skills.slice(0,2).map(skill=>`${skill.nameCn} ${skill.points>0?'+':''}${skill.points}`).join(' · ')
  return <tr className="armor-list-row" data-selected={selected||undefined}>
    <td className="armor-list-row__cell armor-list-row__identity"><button className="armor-list-row__button" type="button" aria-pressed={selected} onClick={()=>onSelect(armorKey(armor))}><ArmorIcon path={armor.iconPath} name={armor.nameCn}/><span className="armor-list-row__names"><strong className="armor-list-row__name">{armor.nameCn}</strong><small className="armor-list-row__secondary">{armor.nameEn || armor.nameJp}</small>{'matchReason' in armor && armor.matchReason && <small className="armor-list-row__secondary">{armor.matchReason}</small>}</span></button></td>
    <td className="armor-list-row__cell">{partLabel[armor.part]}</td><td className="armor-list-row__cell">{combatLabel[armor.combat]}</td><td className="armor-list-row__cell">{genderLabel[armor.gender]}</td><td className="armor-list-row__cell">{armor.rarity}</td><td className="armor-list-row__cell"><EquipmentSlotIndicator slots={armor.slots}/></td><td className="armor-list-row__cell">{armor.baseDefense}</td><td className="armor-list-row__cell">{armor.maxDefense}</td><td className="armor-list-row__cell">{armor.fireRes}</td><td className="armor-list-row__cell">{armor.waterRes}</td><td className="armor-list-row__cell">{armor.thunderRes}</td><td className="armor-list-row__cell">{armor.iceRes}</td><td className="armor-list-row__cell">{armor.dragonRes}</td><td className="armor-list-row__cell armor-list-row__skills" title={skills}>{skills||'—'}</td>
  </tr>
}
