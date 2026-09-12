import type { GameId } from '../../../api/core/loadout'
import type { SharpnessStage, WeaponDetail, WeaponLink } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { WeaponCoreStats } from '../WeaponCoreStats/WeaponCoreStats'
import { WeaponMaterialList } from '../WeaponMaterialList/WeaponMaterialList'
import { WeaponProductionBadge } from '../WeaponProductionBadge/WeaponProductionBadge'
import { WeaponRelationList } from '../WeaponRelationList/WeaponRelationList'
import { WeaponTypeDetail } from '../WeaponTypeDetail/WeaponTypeDetail'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import './WeaponDetailPanel.css'

type Props = { gameId: GameId; weapon: WeaponDetail | null; loading: boolean; error?: string; sharpnessStage: SharpnessStage; allowCatalogWrite?: boolean; onSelectItem?: (saveId: number) => void; onSelectWeapon?: (weapon: WeaponLink) => void }

export function WeaponDetailPanel({ gameId, weapon, loading, error, sharpnessStage, allowCatalogWrite = true, onSelectItem, onSelectWeapon }: Props) {
  if (!weapon && loading) return <aside className="weapon-detail-panel weapon-detail-panel--state" role="status">正在读取武器详情…</aside>
  if (!weapon && error) return <aside className="weapon-detail-panel weapon-detail-panel--state" role="alert">{error}</aside>
  if (!weapon) return <aside className="weapon-detail-panel weapon-detail-panel--state">从左侧选择一把武器查看详情。</aside>
  return <aside className={`weapon-detail-panel${loading ? ' weapon-detail-panel--loading' : ''}`} aria-label={`${weapon.nameCn}详情`} aria-busy={loading}>
    {loading && <span className="weapon-detail-panel__loading">正在更新…</span>}
    <header className="weapon-detail-panel__header"><CatalogIcon path={weapon.iconPath} name={weapon.nameCn} size="large" /><div><small>{weapon.typeNameCn} · {weapon.weaponKey} · Dex {weapon.dexId ?? '—'}</small><h2>{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</h2><p>{weapon.nameEn}</p>{weapon.nameJp && <p>{weapon.nameJp}</p>}<div className="weapon-detail-panel__badges">{weapon.isDirectlyProducible && <WeaponProductionBadge />}{weapon.isFinalForm && <span>最终形态</span>}</div></div></header>
    <div className="weapon-detail-panel__scroll"><WeaponCoreStats weapon={weapon} /><WeaponTypeDetail gameId={gameId} weapon={weapon} sharpnessStage={sharpnessStage} onSelectItem={onSelectItem} /><WeaponMaterialList materials={weapon.materials} productionPrice={weapon.productionPrice} upgradePrice={weapon.upgradePrice} onSelectItem={onSelectItem} /><WeaponRelationList parents={weapon.parents} children={weapon.children} onSelectWeapon={onSelectWeapon} /></div>
    {allowCatalogWrite && <div className="weapon-detail-panel__actions"><CatalogWriteControl gameId={gameId} kind="equipment" saveType={weapon.saveType} saveId={weapon.saveId} level={weapon.saveLevel ?? 0} /></div>}
  </aside>
}
