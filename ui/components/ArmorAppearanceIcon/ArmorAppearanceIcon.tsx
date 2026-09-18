import { useEffect, useState } from 'react'
import { ARMOR_APPEARANCE_SPRITE_PATH, type HunterArmorPart } from '../../../api/save/armorParts'
import { assetUrl } from '../../lib/assetUrl'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import './ArmorAppearanceIcon.css'

// Square viewports in the user's unchanged 256×1024 artwork. Cat rows are not used.
const cropTop: Record<HunterArmorPart, number> = { head: 20, chest: 156, arms: 282, waist: 410, legs: 532 }
const labels: Record<HunterArmorPart, string> = { head: '头部', chest: '胸部', arms: '腕部', waist: '腰部', legs: '腿部' }

export function ArmorAppearanceIcon({ part, name, size = 'small', fallbackPath = null }: { part: HunterArmorPart; name: string; size?: 'small' | 'large'; fallbackPath?: string | null }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [part])
  return <span className={`armor-appearance-icon armor-appearance-icon--${size}`} data-part={part} role="img" aria-label={`${name} · ${labels[part]}幻化标识${failed ? '（渐变图标不可用）' : ''}`}>
    {failed ? <span className="armor-appearance-icon__fallback"><CatalogIcon path={fallbackPath} name={name} size={size} /><span className="armor-appearance-icon__badge">幻</span></span> : <span className="armor-appearance-icon__viewport"><img className="armor-appearance-icon__image" src={assetUrl(ARMOR_APPEARANCE_SPRITE_PATH)} alt="" style={{ top: `${-cropTop[part] / 128 * 100}%` }} onError={() => setFailed(true)} /></span>}
  </span>
}
