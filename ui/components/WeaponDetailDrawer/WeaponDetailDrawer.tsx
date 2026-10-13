import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CatalogGameId, ItemIdentity } from '../../../api/catalog/types'
import { createPortal } from 'react-dom'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import { getCatalogWeapon, type CatalogWeaponDetail, type CatalogWeaponLink } from '../../utils/catalogWeapon'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { WeaponDetailPanel } from '../WeaponDetailPanel/WeaponDetailPanel'
import './WeaponDetailDrawer.css'

export function WeaponDetailDrawer({ gameId, weaponKey, onClose }: { gameId: CatalogGameId; weaponKey: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [weapon, setWeapon] = useState<CatalogWeaponDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!weaponKey) return
    let active = true
    setLoading(true); setError(undefined); setWeapon(null)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return () => { active = false } }
    void getCatalogWeapon(gameId, weaponKey).then((value) => { if (active) setWeapon(value) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '武器详情读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, weaponKey])
  if (!weaponKey) return null
  const goItem = (identity: ItemIdentity) => { onClose(); navigate(`/game/${gameId}/catalog/items?target=${itemNumber(identity)}&item=${itemNumber(identity)}`) }
  const goWeapon = (target: CatalogWeaponLink) => { onClose(); navigate(`/game/${gameId}/catalog/weapons?target=${encodeURIComponent(target.weaponKey)}&type=${target.typeId}&weapon=${encodeURIComponent(target.weaponKey)}`) }
  const content = <div className="weapon-detail-drawer"><DetailDrawer title="关联武器" onClose={onClose}><WeaponDetailPanel gameId={gameId} weapon={weapon} loading={loading} error={error} sharpnessStage="base" allowCatalogWrite={false} onSelectCatalogItem={goItem} onSelectWeapon={goWeapon} /></DetailDrawer></div>
  return gameId === 'mhp2g' ? createPortal(content, document.body) : content
}
