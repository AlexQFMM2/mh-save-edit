import { Crown, Footprints, Gem, Hand, Shield, Shirt, Sword, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LoadoutSlot } from '../../../api/loadout/types'
import { assetUrl } from '../../lib/assetUrl'
import './LoadoutSlotIcon.css'

type IconItem = { iconPath?: string | null; nameCn?: string; classNameCn?: string; sourceKind?: string }
type Props = { slot: LoadoutSlot; item?: IconItem | null; size?: 'small' | 'medium' }

const labels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头部防具', chest: '胸部防具', arms: '腕部防具', waist: '腰部防具', legs: '腿部防具', charm: '护石' }
const fallbacks: Record<LoadoutSlot, LucideIcon> = { weapon: Sword, head: Crown, chest: Shirt, arms: Hand, waist: Shield, legs: Footprints, charm: Gem }

export function LoadoutSlotIcon({ slot, item, size = 'medium' }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [item?.iconPath])
  const name = item?.nameCn ?? item?.classNameCn
  const accessibleName = name ? `${labels[slot]}：${name}` : `${labels[slot]}：未选择`
  const source = item?.iconPath && !failed ? assetUrl(item.iconPath) : null
  const Fallback = fallbacks[slot]
  return <span className={`loadout-slot-icon loadout-slot-icon--${size}`} role="img" aria-label={accessibleName} title={accessibleName}>
    {source ? <img className="loadout-slot-icon__image" src={source} alt="" onError={() => setFailed(true)} /> : <Fallback className="loadout-slot-icon__fallback" aria-hidden />}
    <span className="loadout-slot-icon__hidden">{accessibleName}</span>
  </span>
}
