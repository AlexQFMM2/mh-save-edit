import type { GameId } from '../../../api/core/loadout'
import type { SharpnessStage, WeaponKind, WeaponSummary } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { WeaponAttributeList } from '../WeaponAttributeList/WeaponAttributeList'
import { WeaponProductionBadge } from '../WeaponProductionBadge/WeaponProductionBadge'
import { WeaponSharpnessComparison } from '../WeaponSharpnessComparison/WeaponSharpnessComparison'
import './WeaponListRow.css'

type Props = { gameId: GameId; item: WeaponSummary; selected: boolean; selectedKind?: WeaponKind; sharpnessStage: SharpnessStage; onSelect: (weaponKey: string) => void }

export function WeaponListRow({ gameId, item, selected, selectedKind, sharpnessStage, onSelect }: Props) {
  const special = selectedKind == null
    ? <span className="weapon-list-row__type">{item.typeNameCn}</span>
    : <span className="weapon-list-row__special">{item.sharpness && <WeaponSharpnessComparison gameId={gameId} profile={item.sharpness} selectedStage={sharpnessStage} compact />}{item.specialSummary.length > 0 && <small>{item.specialSummary.slice(0, 4).join(' · ')}</small>}</span>
  return <button className="weapon-list-row" type="button" role="option" aria-selected={selected} onClick={() => onSelect(item.weaponKey)}>
    <span className="weapon-list-row__identity"><CatalogIcon path={item.iconPath} name={item.nameCn} /><span><strong>{item.nameCn}{item.displayLevel != null ? ` Lv.${item.displayLevel}` : ''}</strong><small>{item.nameEn || '—'} · #{item.saveId}{item.saveLevel != null ? `:${item.saveLevel}` : ''}</small></span></span>
    <span className="weapon-list-row__stat">{item.rarity ?? '—'}</span>
    <span className="weapon-list-row__stat">{item.displayAttack ?? '—'}</span>
    <WeaponAttributeList attributes={item.attributes} compact />
    <span className="weapon-list-row__stat">{item.affinity == null ? '—' : `${item.affinity}%`}</span>
    <span className="weapon-list-row__stat">{item.slots ?? '—'}</span>
    <span className="weapon-list-row__badges">{item.isDirectlyProducible && <WeaponProductionBadge />}{item.isFinalForm && <span className="weapon-list-row__final-badge">最终</span>}</span>
    {special}
  </button>
}
