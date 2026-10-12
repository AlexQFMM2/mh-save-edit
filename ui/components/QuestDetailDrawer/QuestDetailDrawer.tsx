import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { CatalogGameId, QuestDetail, QuestDetailTab } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { QuestDetailPanel } from '../QuestDetailPanel/QuestDetailPanel'
import './QuestDetailDrawer.css'

export function QuestDetailDrawer({ gameId, questKey, onClose }: { gameId: CatalogGameId; questKey: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [quest, setQuest] = useState<QuestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<QuestDetailTab>('info')
  useEffect(() => {
    setQuest(null); setError(undefined); setTab('info')
    if (!questKey) return
    let active = true
    setLoading(true)
    void window.mhSaveEditor.catalog.getQuest({ gameId, questKey }).then(value => { if (active) setQuest(value) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '任务详情读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, questKey])
  if (!questKey) return null
  const go = (path: string) => { onClose(); navigate(path) }
  return createPortal(<div className="quest-detail-drawer"><DetailDrawer title="任务详情" onClose={onClose}>
    <QuestDetailPanel quest={quest} loading={loading} error={error} tab={tab} onTabChange={setTab}
      onSelectMonster={id => go(`/game/${gameId}/catalog/monsters?target=${id}&monster=${id}`)}
      onSelectItem={item => { const id = item.gameId === 'mhp2g' ? item.itemId : item.saveId; go(`/game/${item.gameId}/catalog/items?target=${id}&item=${id}`) }}
      onSelectQuest={key => go(`/game/${gameId}/catalog/quests?target=${encodeURIComponent(key)}&quest=${encodeURIComponent(key)}&tab=unlocks`)}
      onSelectHunterArt={id => { if (gameId === 'mhgu') go(`/game/mhgu/catalog/hunter-arts?target=${id}&art=${id}`) }} />
  </DetailDrawer></div>, document.body)
}
