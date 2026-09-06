import { CemuLogo } from '../CemuLogo/CemuLogo'
import type { PlatformId } from '../../data/gameVersions'
import { assetUrl } from '../../lib/assetUrl'
import './PlatformBadgeList.css'

type PlatformBadgeListProps = { platforms: PlatformId[] }
const platformNames: Record<PlatformId, string> = { citra: 'Citra', cemu: 'Cemu', yuzu: 'Yuzu' }

export function PlatformBadgeList({ platforms }: PlatformBadgeListProps) {
  return (
    <div className="platform-badge-list" aria-label={`支持平台：${platforms.map((platform) => platformNames[platform]).join('、')}`}>
      <span className="platform-badge-list__label">支持平台</span>
      <span className="platform-badge-list__items">
        {platforms.map((platform) => (
          <span className="platform-badge" key={platform} title={platformNames[platform]}>
            {platform === 'cemu' ? <CemuLogo /> : <img className={`platform-badge__image platform-badge__image--${platform}`} src={assetUrl(`home/${platform}.png`)} alt="" />}
            <span className="platform-badge__name">{platformNames[platform]}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
