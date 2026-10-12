import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import type { CatalogGameId, MonsterCatalogTab, MonsterDetail } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { MonsterDetailPanel } from '../MonsterDetailPanel/MonsterDetailPanel'
import './MonsterDetailDrawer.css'

export function MonsterDetailDrawer({ gameId, monsterId, onClose }: {
  gameId: CatalogGameId; monsterId: number | null; onClose: () => void
}) {
  const navigate = useNavigate()
  const [monster, setMonster] = useState<MonsterDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<MonsterCatalogTab>('weakness')
  const [dropDirection, setDropDirection] = useState<'asc' | 'desc'>('desc')
  useEffect(() => {
    if (monsterId == null) return
    let active = true
    setMonster(null); setLoading(true); setError(undefined); setTab('weakness')
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    void api.getMonster({ gameId, monsterId }).then(value => { if (active) setMonster(value) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '怪物详情读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, monsterId])
  if (monsterId == null) return null
  const go = (path: string) => { onClose(); navigate(path) }
  const content = <div className="monster-detail-drawer"><DetailDrawer title="关联怪物" onClose={onClose}>
    <MonsterDetailPanel gameId={gameId} monster={monster} loading={loading} error={error} tab={tab}
      dropDirection={dropDirection} taskAvailability="all" onTabChange={setTab}
      onDropDirectionChange={setDropDirection} onTaskAvailabilityChange={() => undefined}
      onSelectItem={item => go(`/game/${item.gameId}/catalog/items?target=${itemNumber(item)}&item=${itemNumber(item)}`)}
      onSelectQuest={questKey => go(`/game/${gameId}/catalog/quests?target=${encodeURIComponent(questKey)}&quest=${encodeURIComponent(questKey)}`)} />
  </DetailDrawer></div>
  return gameId === 'mhp2g' ? createPortal(content, document.body) : content
}
