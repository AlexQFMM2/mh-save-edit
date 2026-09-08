import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SkillDetail } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { SkillDetailPanel } from '../SkillDetailPanel/SkillDetailPanel'
import './SkillDetailDrawer.css'

export function SkillDetailDrawer({ gameId, skillId, onClose }: { gameId: GameId; skillId: number | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [skill, setSkill] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (skillId == null) return
    let active = true
    setLoading(true); setError(undefined); setSkill(null)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    void api.getSkill({ gameId, skillId }).then(value => { if (active) setSkill(value) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '技能详情读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, skillId])
  if (skillId == null) return null
  const go = (path: string) => { onClose(); navigate(path) }
  return <div className="skill-detail-drawer"><DetailDrawer title="关联技能" onClose={onClose}><SkillDetailPanel skill={skill} loading={loading} error={error} onSelectDecoration={decoration => go(`/game/${gameId}/catalog/decorations?target=${decoration.saveId}&item=${decoration.saveId}`)} onSelectArmor={armor => go(`/game/${gameId}/catalog/armor?target=${armor.dexId}&armor=${armor.dexId}`)}/></DetailDrawer></div>
}
