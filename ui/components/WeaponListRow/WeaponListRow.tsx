import type { CatalogGameId } from '../../../api/catalog/types'
import type { CatalogWeaponSummary } from '../../utils/catalogWeapon'
import type { SharpnessStage, WeaponKind } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { WeaponAttributeList } from '../WeaponAttributeList/WeaponAttributeList'
import { WeaponProductionBadge } from '../WeaponProductionBadge/WeaponProductionBadge'
import { WeaponSharpnessComparison } from '../WeaponSharpnessComparison/WeaponSharpnessComparison'
import './WeaponListRow.css'

type Props = { gameId: CatalogGameId; item: CatalogWeaponSummary; selected: boolean; selectedKind?: WeaponKind; sharpnessStage: SharpnessStage; onSelect: (weaponKey: string) => void }

export function WeaponListRow({ gameId, item, selected, selectedKind, sharpnessStage, onSelect }: Props) {
  const special = selectedKind == null
    ? <span className="weapon-list-row__type">{item.typeNameCn}</span>
    : <span className="weapon-list-row__special">{item.sharpness && <WeaponSharpnessComparison gameId={gameId} profile={item.sharpness} selectedStage={sharpnessStage} compact />}{item.specialSummary.length > 0 && <small>{item.specialSummary.slice(0, 4).join(' · ')}</small>}</span>
  return <button className="weapon-list-row" type="button" role="option" aria-selected={selected} onClick={() => onSelect(item.weaponKey)}>
    <span className="weapon-list-row__identity"><CatalogIcon path={item.iconPath} name={item.nameCn} /><span><strong>{item.nameCn}{item.displayLevel != null ? ` Lv.${item.displayLevel}` : ''}</strong><small>{item.nameEn || item.nameJp || '—'} · <span className="weapon-list-row__number">{gameId === 'mhp2g' ? `图鉴 ${item.nativeIndex}` : `#${item.saveId}`}{item.saveLevel != null ? `:${item.saveLevel}` : ''}</span></small>{item.matchReason && <small>{item.matchReason}</small>}</span></span>
    <span className="weapon-list-row__stat">{item.rarity ?? '—'}</span>
    <span className="weapon-list-row__stat">{item.displayAttack ?? '—'}</span>
    <WeaponAttributeList attributes={item.attributes} compact />
    <span className="weapon-list-row__stat">{item.affinity == null ? '—' : `${item.affinity}%`}</span>
    <span className="weapon-list-row__stat"><EquipmentSlotIndicator slots={item.slots} compact /></span>
    <span className="weapon-list-row__badges">{item.isDirectlyProducible && <WeaponProductionBadge />}{item.isFinalForm && <span className="weapon-list-row__final-badge">最终</span>}</span>
    {special}
  </button>
}
