import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameId } from '../../../api/core/loadout'
import type { WeaponDetail } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { WeaponDetailPanel } from '../WeaponDetailPanel/WeaponDetailPanel'
import './WeaponDetailDrawer.css'

export function WeaponDetailDrawer({ gameId, weaponKey, onClose }: { gameId: GameId; weaponKey: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [weapon, setWeapon] = useState<WeaponDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!weaponKey) return
    let active = true
    setLoading(true); setError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return () => { active = false } }
    void api.getWeapon({ gameId, weaponKey }).then((value) => { if (active) setWeapon(value) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '武器详情读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, weaponKey])
  if (!weaponKey) return null
  const goItem = (saveId: number) => { onClose(); navigate(`/game/${gameId}/catalog/items?target=${saveId}&item=${saveId}`) }
  const goWeapon = (target: WeaponDetail['parents'][number]) => { onClose(); navigate(`/game/${gameId}/catalog/weapons?target=${encodeURIComponent(target.weaponKey)}&type=${target.typeId}&weapon=${encodeURIComponent(target.weaponKey)}`) }
  return <div className="weapon-detail-drawer"><DetailDrawer title="关联武器" onClose={onClose}><WeaponDetailPanel gameId={gameId} weapon={weapon} loading={loading} error={error} sharpnessStage="base" onSelectItem={goItem} onSelectWeapon={goWeapon} /></DetailDrawer></div>
}
