import { PawPrint } from 'lucide-react'
import { useState } from 'react'
import { assetUrl } from '../../lib/assetUrl'
import './MonsterIcon.css'

export function MonsterIcon({ path, name, size = 'small' }: { path: string | null; name: string; size?: 'small' | 'large' }) {
  const [failed, setFailed] = useState(false)
  return <span className={`monster-icon monster-icon--${size}`} aria-hidden="true">
    {path && !failed ? <img src={assetUrl(path)} alt="" onError={() => setFailed(true)} /> : <PawPrint />}
    <span className="monster-icon__accessible-name">{name}</span>
  </span>
}
