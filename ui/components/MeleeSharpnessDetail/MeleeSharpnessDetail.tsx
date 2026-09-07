import type { GameId } from '../../../api/core/loadout'
import type { SharpnessStage, WeaponSharpnessProfile } from '../../../api/catalog/types'
import { WeaponSharpnessComparison } from '../WeaponSharpnessComparison/WeaponSharpnessComparison'
import './MeleeSharpnessDetail.css'

export function MeleeSharpnessDetail({ gameId, profile, selectedStage }: { gameId: GameId; profile: WeaponSharpnessProfile; selectedStage: SharpnessStage }) {
  return <section className="melee-sharpness-detail"><h3>斩味与匠</h3><WeaponSharpnessComparison gameId={gameId} profile={profile} selectedStage={selectedStage} /></section>
}
