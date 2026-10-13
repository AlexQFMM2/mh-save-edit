import { p2gSaveIdentity } from '../../../api/save/p2g/identity'
import type { CatalogGameId, ItemIdentity } from '../../../api/catalog/types'
import type { CatalogWeaponDetail, CatalogWeaponLink } from '../../utils/catalogWeapon'
import { itemIdentity } from '../../../api/catalog/itemIdentity'
import { p2gShellingLabels } from '../../../api/catalog/p2gWeaponPresentation'
import { P2gWeaponRecipeList } from '../P2gWeaponRecipeList/P2gWeaponRecipeList'
import { P2gRangedDetail } from '../P2gRangedDetail/P2gRangedDetail'
import { P2gHuntingHornDetail } from '../P2gHuntingHornDetail/P2gHuntingHornDetail'
import { MeleeSharpnessDetail } from '../MeleeSharpnessDetail/MeleeSharpnessDetail'
import { DetailSection } from '../DetailSection/DetailSection'
import { DetailStatGrid } from '../DetailStatGrid/DetailStatGrid'
import type { SharpnessStage } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { WeaponCoreStats } from '../WeaponCoreStats/WeaponCoreStats'
import { WeaponMaterialList } from '../WeaponMaterialList/WeaponMaterialList'
import { WeaponProductionBadge } from '../WeaponProductionBadge/WeaponProductionBadge'
import { WeaponRelationList } from '../WeaponRelationList/WeaponRelationList'
import { WeaponTypeDetail } from '../WeaponTypeDetail/WeaponTypeDetail'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { DetailActionBar } from '../DetailActionBar/DetailActionBar'
import './WeaponDetailPanel.css'

type Props = { gameId: CatalogGameId; weapon: CatalogWeaponDetail | null; loading: boolean; error?: string; sharpnessStage: SharpnessStage; allowCatalogWrite?: boolean; layout?: 'panel' | 'embedded'; showRelations?: boolean; onSelectItem?: (saveId: number) => void; onSelectCatalogItem?: (identity: ItemIdentity) => void; onSelectWeapon?: (weapon: CatalogWeaponLink) => void }

export function WeaponDetailPanel({ gameId, weapon, loading, error, sharpnessStage, allowCatalogWrite = true, layout = 'panel', showRelations = true, onSelectItem, onSelectCatalogItem, onSelectWeapon }: Props) {
  if (!weapon && loading) return <aside className="weapon-detail-panel weapon-detail-panel--state" role="status">正在读取武器详情…</aside>
  if (!weapon && error) return <aside className="weapon-detail-panel weapon-detail-panel--state" role="alert">{error}</aside>
  if (!weapon) return <aside className="weapon-detail-panel weapon-detail-panel--state">从左侧选择一把武器查看详情。</aside>
  const native = 'nativeDetail' in weapon ? weapon.nativeDetail : null
  const selectLegacyItem = (id: number) => { if (onSelectCatalogItem) onSelectCatalogItem(itemIdentity(gameId, id)); else onSelectItem?.(id) }
  const selectNativeItem = onSelectCatalogItem
  return <aside className={`weapon-detail-panel${loading ? ' weapon-detail-panel--loading' : ''}${layout === 'embedded' ? ' weapon-detail-panel--embedded' : ''}`} aria-label={`${weapon.nameCn}详情`} aria-busy={loading}>
    {loading && <span className="weapon-detail-panel__loading">正在更新…</span>}
    <header className="weapon-detail-panel__header"><CatalogIcon path={weapon.iconPath} name={weapon.nameCn} size="large" /><div className="weapon-detail-panel__identity"><small className="weapon-detail-panel__id">{weapon.typeNameCn} · {native ? `图鉴 ${native.weaponKey}` : `${weapon.weaponKey} · Dex ${weapon.dexId ?? '—'}`}</small><h2 className="weapon-detail-panel__name">{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</h2><p className="weapon-detail-panel__language">{weapon.nameEn}</p>{weapon.nameJp && <p className="weapon-detail-panel__language">{weapon.nameJp}</p>}<div className="weapon-detail-panel__badges">{weapon.isDirectlyProducible && <WeaponProductionBadge />}{weapon.isFinalForm && <span className="weapon-detail-panel__final">最终形态</span>}</div></div></header>
    <div className={`weapon-detail-panel__scroll${layout === 'embedded' ? ' weapon-detail-panel__scroll--embedded' : ''}`}><WeaponCoreStats weapon={weapon} />
      {'nativeDetail' in weapon ? <>
        {weapon.sharpness && <MeleeSharpnessDetail gameId="mhp2g" profile={weapon.sharpness} selectedStage={sharpnessStage} />}
        {weapon.nativeDetail.special.kind === 'huntingHorn' && <P2gHuntingHornDetail key={weapon.weaponKey} special={weapon.nativeDetail.special} />}
        {weapon.nativeDetail.special.kind === 'gunlance' && <DetailSection title="炮击"><DetailStatGrid items={[{ label: '类型', value: p2gShellingLabels[weapon.nativeDetail.special.shelling.typeJa] || weapon.nativeDetail.special.shelling.typeJa }, { label: '等级', value: weapon.nativeDetail.special.shelling.level }]} /></DetailSection>}
        {(weapon.nativeDetail.special.kind === 'bow' || weapon.nativeDetail.special.kind === 'bowgun') && <P2gRangedDetail key={weapon.weaponKey} special={weapon.nativeDetail.special} onSelectItem={selectNativeItem} />}
        <P2gWeaponRecipeList recipes={weapon.nativeDetail.recipes} onSelectItem={selectNativeItem} onSelectWeapon={w => onSelectWeapon?.({ ...w, displayLevel: null })} />
      </> : <><WeaponTypeDetail gameId={weapon.gameId} weapon={weapon} sharpnessStage={sharpnessStage} onSelectItem={selectLegacyItem} /><WeaponMaterialList materials={weapon.materials} productionPrice={weapon.productionPrice} upgradePrice={weapon.upgradePrice} onSelectItem={selectLegacyItem} /></>}
      {showRelations && <WeaponRelationList parents={weapon.parents} children={weapon.children} onSelectWeapon={onSelectWeapon} />}
    </div>
    {allowCatalogWrite && 'nativeDetail' in weapon && <DetailActionBar className="weapon-detail-panel__actions"><CatalogWriteControl gameId="mhp2g" kind="equipment" {...p2gSaveIdentity(weapon.weaponKey)} /></DetailActionBar>}
    {allowCatalogWrite && !('nativeDetail' in weapon) && <DetailActionBar className="weapon-detail-panel__actions"><CatalogWriteControl gameId={weapon.gameId} kind="equipment" saveType={weapon.saveType} saveId={weapon.saveId} level={weapon.saveLevel ?? 0} /></DetailActionBar>}
  </aside>
}
