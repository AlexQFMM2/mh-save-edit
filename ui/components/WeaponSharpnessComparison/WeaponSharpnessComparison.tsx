import type { WeaponCatalogGameId } from '../../../api/catalog/types'
import type { CatalogWeaponSharpness } from '../../utils/catalogWeapon'
import type { SharpnessStage } from '../../../api/catalog/types'
import { weaponSharpnessStages } from '../../utils/weaponCatalog'
import { WeaponSharpnessBar } from '../WeaponSharpnessBar/WeaponSharpnessBar'
import './WeaponSharpnessComparison.css'

type Props = { gameId: WeaponCatalogGameId; profile: CatalogWeaponSharpness; selectedStage?: SharpnessStage; compact?: boolean }

export function WeaponSharpnessComparison({ gameId, profile, selectedStage = 'base', compact = false }: Props) {
  const stages = weaponSharpnessStages(profile, gameId)
  const unchanged = stages.every((stage) => stage.cutoff === stages[0].cutoff)
  const label = stages.map((stage) => `${stage.label}${stage.summary}`).join('，')
  return <div className={`weapon-sharpness-comparison${compact ? ' weapon-sharpness-comparison--compact' : ''}`} aria-label={`斩味：${label}`}>
    {stages.map((stage) => <WeaponSharpnessBar key={stage.id} stage={stage} compact={compact} emphasized={stage.id === selectedStage} />)}
    {!compact && unchanged && <small className="weapon-sharpness-comparison__unchanged">匠无延长</small>}
  </div>
}
