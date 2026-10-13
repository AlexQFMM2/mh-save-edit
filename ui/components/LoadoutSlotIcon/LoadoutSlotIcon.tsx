import { Crown, Footprints, Gem, Hand, Shield, Shirt, Sword, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LoadoutGame } from '../../../api/loadout/types'
import type { LoadoutSlot } from '../../../api/loadout/types'
import { defaultLoadoutIconPath } from '../../../api/save/catalogIconPaths'
import { assetUrl } from '../../lib/assetUrl'
import './LoadoutSlotIcon.css'

type IconItem = { iconPath?: string | null; nameCn?: string; classNameCn?: string; sourceKind?: string }
type Props = { slot: LoadoutSlot; item?: IconItem | null; size?: 'small' | 'medium'; gameId?: LoadoutGame }

const labels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头部防具', chest: '胸部防具', arms: '腕部防具', waist: '腰部防具', legs: '腿部防具', charm: '护石' }
const fallbacks: Record<LoadoutSlot, LucideIcon> = { weapon: Sword, head: Crown, chest: Shirt, arms: Hand, waist: Shield, legs: Footprints, charm: Gem }

export function LoadoutSlotIcon({ slot, item, size = 'medium', gameId }: Props) {
  const [failed, setFailed] = useState(false)
  const name = item?.nameCn ?? item?.classNameCn
  const accessibleName = name ? `${labels[slot]}：${name}` : `${labels[slot]}：未选择`
  const sourcePath = item?.iconPath ?? (gameId && gameId !== 'mhp2g' ? defaultLoadoutIconPath(gameId, slot) : null)
  useEffect(() => setFailed(false), [sourcePath])
  const source = sourcePath && !failed ? assetUrl(sourcePath) : null
  const Fallback = fallbacks[slot]
  return <span className={`loadout-slot-icon loadout-slot-icon--${size}`} role="img" aria-label={accessibleName} title={accessibleName}>
    {source ? <img className="loadout-slot-icon__image" src={source} alt="" onError={() => setFailed(true)} /> : <Fallback className="loadout-slot-icon__fallback" aria-hidden />}
    <span className="loadout-slot-icon__hidden">{accessibleName}</span>
  </span>
}
