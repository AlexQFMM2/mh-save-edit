import { decorationNumber } from '../../../api/catalog/decorationIdentity'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { SkillCatalogGameId, SkillCatalogTab, SkillDetail } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { SkillDetailPanel } from '../SkillDetailPanel/SkillDetailPanel'
import './SkillDetailDrawer.css'

export function SkillDetailDrawer({ gameId, skillId, onClose }: { gameId: SkillCatalogGameId; skillId: number | null; onClose: () => void }) {
  const navigate = useNavigate()
  const [skill, setSkill] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [tab, setTab] = useState<SkillCatalogTab>('armor')
  useEffect(() => {
    setTab('armor')
    if (skillId == null) { setSkill(null); return }
    let active = true
    setLoading(true); setError(undefined); setSkill(null)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    void api.getSkill({ gameId, skillId }).then(value => { if (active) setSkill(value) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '技能详情读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, skillId, retry])
  if (skillId == null) return null
  const go = (path: string) => { onClose(); navigate(path) }
  const content = <div className="skill-detail-drawer"><DetailDrawer title="关联技能" onClose={onClose}><SkillDetailPanel skill={skill} loading={loading} error={error} onRetry={() => setRetry(n => n + 1)} emptyMessage="未找到对应技能资料。" tab={tab} onTabChange={setTab} onSelectSkill={id => go(`/game/${gameId}/catalog/skills?target=${id}&skill=${id}`)} onSelectP2gEquipment={equipment => go(equipment.decorationItemId!=null?`/game/mhp2g/catalog/decorations?target=${equipment.decorationItemId}&item=${equipment.decorationItemId}`:equipment.kind==='armor'?`/game/mhp2g/catalog/armor?target=${encodeURIComponent(equipment.equipmentKey)}&armor=${encodeURIComponent(equipment.equipmentKey)}`:`/game/mhp2g/catalog/skills?skill=${skillId}&equipment=${encodeURIComponent(equipment.equipmentKey)}`)} onSelectDecoration={decoration => go(`/game/${gameId}/catalog/decorations?target=${decorationNumber(decoration)}&item=${decorationNumber(decoration)}`)} onSelectArmor={armor => go(armor.gameId === 'mhp3' ? `/game/mhp3/catalog/skills?target=${skillId}&skill=${skillId}&equipment=${encodeURIComponent(armor.armorKey)}` : `/game/${gameId}/catalog/armor?target=${armor.dexId}&armor=${armor.dexId}`)}/></DetailDrawer></div>
  return (gameId === 'mhp2g' || gameId === 'mhp3') ? createPortal(content, document.body) : content
}
