import { CemuLogo } from '../CemuLogo/CemuLogo'
import type { PlatformId } from '../../data/gameVersions'
import { assetUrl } from '../../lib/assetUrl'
import './PlatformBadgeList.css'

type PlatformBadgeListProps = {
  platforms: PlatformId[]
  showLabel?: boolean
}
const platformNames: Record<PlatformId, string> = { citra: 'Citra', cemu: 'Cemu', yuzu: 'Yuzu', ppsspp: 'PPSSPP' }

export function PlatformBadgeList({ platforms, showLabel = true }: PlatformBadgeListProps) {
  return (
    <div className="platform-badge-list" aria-label={`支持平台：${platforms.map((platform) => platformNames[platform]).join('、')}`}>
      {showLabel ? <span className="platform-badge-list__label">支持平台</span> : null}
      <span className="platform-badge-list__items">
        {platforms.map((platform) => (
          <span className="platform-badge" key={platform} title={platformNames[platform]}>
            {platform === 'cemu' ? <CemuLogo /> : <img className={`platform-badge__image platform-badge__image--${platform}`} src={assetUrl(`home/${platform}.${platform === 'ppsspp' ? 'svg' : 'png'}`)} alt="" />}
            <span className="platform-badge__name">{platformNames[platform]}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
