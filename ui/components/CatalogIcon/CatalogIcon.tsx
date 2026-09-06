import { PackageOpen } from 'lucide-react'
import { useState } from 'react'
import { assetUrl } from '../../lib/assetUrl'
import './CatalogIcon.css'

type CatalogIconProps = { path: string | null; name: string; size?: 'small' | 'large' }

export function CatalogIcon({ path, name, size = 'small' }: CatalogIconProps) {
  const [failed, setFailed] = useState(false)
  const source = failed ? undefined : assetUrl(path)
  return (
    <span className={`catalog-icon catalog-icon--${size}`} aria-hidden="true">
      {source ? <img src={source} alt="" width="16" height="16" onError={() => setFailed(true)} /> : <PackageOpen aria-label={`${name}暂无图标`} />}
    </span>
  )
}
