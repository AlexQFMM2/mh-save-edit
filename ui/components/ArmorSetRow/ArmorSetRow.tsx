import { Check } from 'lucide-react'
import type { ArmorPartId, ArmorSetRow as ArmorSetRowType } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './ArmorSetRow.css'

const parts:ArmorPartId[]=['head','chest','arms','waist','legs']
export function ArmorSetRow({ row, selectedDexId, onSelect }: { row: ArmorSetRowType; selectedDexId?: number; onSelect: (dexId: number) => void }) {
  return <>{parts.map(part=>{const member=row.members[part];const selected=member?.dexId===selectedDexId;return <td className="armor-set-row" key={part}>{member?<button type="button" aria-pressed={selected} onClick={()=>onSelect(member.dexId)} title={`${member.nameCn} · RARE ${member.rarity}`}><ArmorIcon path={member.iconPath} name={member.nameCn}/><span className="armor-set-row__body"><span className="armor-set-row__name">{member.nameCn}</span><EquipmentSlotIndicator slots={member.slots} compact/></span>{selected&&<Check aria-hidden="true"/>}</button>:<span className="armor-set-row__empty" aria-label={`${part}缺失`}>—</span>}</td>})}<td className="armor-set-row__combat">{row.combat==='blademaster'?'近战':'远程'}</td></>
}
