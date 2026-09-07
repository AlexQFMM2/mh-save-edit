import type { GameId } from '../../../api/core/loadout'
import type { SharpnessStage, WeaponDetail } from '../../../api/catalog/types'
import { BowDetail } from '../BowDetail/BowDetail'
import { BowgunDetail } from '../BowgunDetail/BowgunDetail'
import { GunlanceDetail } from '../GunlanceDetail/GunlanceDetail'
import { HuntingHornDetail } from '../HuntingHornDetail/HuntingHornDetail'
import { InsectGlaiveDetail } from '../InsectGlaiveDetail/InsectGlaiveDetail'
import { MeleeSharpnessDetail } from '../MeleeSharpnessDetail/MeleeSharpnessDetail'
import { PhialWeaponDetail } from '../PhialWeaponDetail/PhialWeaponDetail'
import './WeaponTypeDetail.css'

export function WeaponTypeDetail({ gameId, weapon, sharpnessStage, onSelectItem }: { gameId: GameId; weapon: WeaponDetail; sharpnessStage: SharpnessStage; onSelectItem?: (saveId: number) => void }) {
  if (weapon.kind === 'bowgun') return <div className="weapon-type-detail"><BowgunDetail weapon={weapon} onSelectItem={onSelectItem} /></div>
  if (weapon.kind === 'bow') return <div className="weapon-type-detail"><BowDetail weapon={weapon} onSelectItem={onSelectItem} /></div>
  return <div className="weapon-type-detail"><MeleeSharpnessDetail gameId={gameId} profile={weapon.sharpness} selectedStage={sharpnessStage} />{weapon.kind === 'huntingHorn' && <HuntingHornDetail weapon={weapon} />}{weapon.kind === 'gunlance' && <GunlanceDetail weapon={weapon} />}{weapon.kind === 'phialWeapon' && <PhialWeaponDetail weapon={weapon} />}{weapon.kind === 'insectGlaive' && <InsectGlaiveDetail weapon={weapon} />}</div>
}
