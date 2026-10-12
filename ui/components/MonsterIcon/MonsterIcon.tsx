import { PawPrint } from 'lucide-react'
import { useState, useEffect } from 'react'
import { assetUrl } from '../../lib/assetUrl'
import './MonsterIcon.css'

export function MonsterIcon({ path, name, size = 'small', pixelated = false }: { path: string | null; name: string; size?: 'small' | 'large'; pixelated?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [path])
  return <span className={`monster-icon monster-icon--${size}${pixelated ? ' monster-icon--pixelated' : ''}`} aria-hidden="true">
    {path && !failed ? <img className="monster-icon__image" src={assetUrl(path)} alt="" onError={() => setFailed(true)} /> : <PawPrint className="monster-icon__fallback" />}
    <span className="monster-icon__accessible-name">{name}</span>
  </span>
}
