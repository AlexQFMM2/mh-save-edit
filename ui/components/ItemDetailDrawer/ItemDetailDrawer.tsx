import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ItemDetail } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { ItemDetailPanel } from '../ItemDetailPanel/ItemDetailPanel'
import './ItemDetailDrawer.css'

type Props = { gameId: GameId; itemSaveId: number | null; onClose: () => void }

export function ItemDetailDrawer({ gameId, itemSaveId, onClose }: Props) {
  const navigate = useNavigate()
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (itemSaveId == null) return
    let active = true
    setLoading(true); setError(undefined); setItem(null)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return () => { active = false } }
    void api.getItem({ gameId, saveId: itemSaveId }).then((result) => { if (active) setItem(result) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '道具详情读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [gameId, itemSaveId])
  if (itemSaveId == null) return null
  const go = (path: string) => { onClose(); navigate(path) }
  return <div className="item-detail-drawer"><DetailDrawer title="关联道具" onClose={onClose}><ItemDetailPanel item={item} loading={loading} error={error}
    onSelectItem={(saveId) => go(`/game/${gameId}/catalog/items?target=${saveId}&item=${saveId}`)}
    onSelectDecoration={(saveId) => go(`/game/${gameId}/catalog/decorations?target=${saveId}&item=${saveId}`)}
    onSelectWeapon={(weapon) => go(`/game/${gameId}/catalog/weapons?target=${encodeURIComponent(weapon.weaponKey)}&type=${weapon.typeId}&weapon=${encodeURIComponent(weapon.weaponKey)}`)}
    onSelectArmor={(armor) => go(`/game/${gameId}/catalog/armor?target=${armor.dexId}&armor=${armor.dexId}`)}
    onSelectMonster={(monster) => go(`/game/${gameId}/catalog/monsters?target=${monster.monsterId}&monster=${monster.monsterId}`)}
    onSelectQuest={(quest) => go(`/game/${gameId}/catalog/quests?target=${encodeURIComponent(quest.questKey)}&quest=${encodeURIComponent(quest.questKey)}`)}
    onSelectPalicoEquipment={(equipment) => go(`/game/mhgu/catalog/palico/equipment?view=${equipment.kind === 'weapon' ? 'weapon' : 'armor'}&target=${equipment.equipmentId}&equipment=${equipment.equipmentId}`)}
  /></DetailDrawer></div>
}
