import { armorKey, type CatalogArmorSet, type CatalogArmorKey } from '../../utils/catalogArmor'
import { Check } from 'lucide-react'
import type { ArmorPartId } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './ArmorSetRow.css'

const parts:ArmorPartId[]=['head','chest','arms','waist','legs']
export function ArmorSetRow({ row, selectedDexId, onSelect }: { row: CatalogArmorSet['rows'][number]; selectedDexId?: CatalogArmorKey; onSelect: (dexId: CatalogArmorKey) => void }) {
  return <>{parts.map(part=>{const member=row.members[part];const selected=member != null && armorKey(member)===selectedDexId;return <td className="armor-set-row" key={part}>{member?<button className="armor-set-row__button" type="button" aria-pressed={selected} onClick={()=>onSelect(armorKey(member))} title={`${member.nameCn} · RARE ${member.rarity}`}><ArmorIcon path={member.iconPath} name={member.nameCn}/><span className="armor-set-row__body"><span className="armor-set-row__name">{member.nameCn}</span><EquipmentSlotIndicator slots={member.slots} compact/></span>{selected&&<Check className="armor-set-row__check" aria-hidden="true"/>}</button>:<span className="armor-set-row__empty" aria-label={`${part}缺失`}>—</span>}</td>})}<td className="armor-set-row__combat">{row.combat==='blademaster'?'近战':'远程'}</td></>
}
