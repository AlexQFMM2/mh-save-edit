import { decorationNumber } from '../../../api/catalog/decorationIdentity'
import type { DecorationSummary } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './DecorationListRow.css'
export function DecorationListRow({ item, selected, onSelect }: { item: DecorationSummary; selected: boolean; onSelect: (id:number)=>void }) { return <button type="button" className="decoration-list-row" aria-pressed={selected} onClick={()=>onSelect(decorationNumber(item))}><CatalogIcon path={item.iconPath} name={item.nameCn}/><span className="decoration-list-row__name"><strong>{item.nameCn}</strong><small>{item.nameJp||item.nameEn||'—'}</small>{item.matchReason&&<small className="decoration-list-row__match">{item.matchReason}</small>}</span><span className="decoration-list-row__skills">{item.skills.slice(0,2).map((s)=><span key={s.skillId}>{s.nameCn} {s.points>0?'+':''}{s.points}</span>)}</span><span className="decoration-list-row__slots"><EquipmentSlotIndicator slots={item.slots}/></span></button> }
