import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { MonsterSummary, P2gMonsterQuest } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import './P2gMonsterQuestDrawer.css'

const labels: Record<string, string> = {
  区分: '类别', 難度: '难度', 種別: '种类', サイズ倍率: '尺寸倍率', 体力: '体力',
  攻撃力倍率: '攻击力倍率', 全体防御率: '整体防御率', 備考: '备注',
}
export function P2gMonsterQuestDrawer({ questKey, quest, monster, onClose }: {
  questKey: string | null; quest?: P2gMonsterQuest; monster: MonsterSummary | null; onClose: () => void
}) {
  const navigate = useNavigate()
  if (!questKey) return null
  return createPortal(<DetailDrawer title="关联任务" onClose={onClose}>
    <div className="p2g-monster-quest-drawer">
      {quest && monster ? <>
        <h2 className="p2g-monster-quest-drawer__title">{quest.nameJp}</h2>
        <p className="p2g-monster-quest-drawer__note">以下数值对应本任务中的关联怪物；空缺信息保留未知。</p>
        <button type="button" className="p2g-monster-quest-drawer__monster" onClick={() => {
          onClose()
          navigate(`/game/mhp2g/catalog/monsters?monster=${monster.monsterId}&target=${monster.monsterId}`)
        }}>{monster.nameCn}</button>
        <dl className="p2g-monster-quest-drawer__fields">{quest.fields.map((field, index) => <div className="p2g-monster-quest-drawer__field" key={index}>
          <dt className="p2g-monster-quest-drawer__label">{labels[field.label.replace(/\s/g, '')] || field.label}</dt>
          <dd className="p2g-monster-quest-drawer__value">{field.value || '未知'}</dd>
        </div>)}</dl>
      </> : <p className="p2g-monster-quest-drawer__note">未找到此怪物的关联任务资料。</p>}
    </div>
  </DetailDrawer>, document.body)
}
