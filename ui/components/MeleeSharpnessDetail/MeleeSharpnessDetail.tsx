import type { WeaponCatalogGameId } from '../../../api/catalog/types'
import type { CatalogWeaponSharpness } from '../../utils/catalogWeapon'
import type { SharpnessStage } from '../../../api/catalog/types'
import { WeaponSharpnessComparison } from '../WeaponSharpnessComparison/WeaponSharpnessComparison'
import './MeleeSharpnessDetail.css'

export function MeleeSharpnessDetail({ gameId, profile, selectedStage }: { gameId: WeaponCatalogGameId; profile: CatalogWeaponSharpness; selectedStage: SharpnessStage }) {
  return <section className="melee-sharpness-detail"><h3>斩味与匠</h3><WeaponSharpnessComparison gameId={gameId} profile={profile} selectedStage={selectedStage} /></section>
}
