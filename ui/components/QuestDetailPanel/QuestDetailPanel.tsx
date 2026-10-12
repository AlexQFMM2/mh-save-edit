import { useId, type KeyboardEvent } from 'react'
import type { ItemIdentity, QuestDetail, QuestDetailTab } from '../../../api/catalog/types'
import { QuestInfoSection } from '../QuestInfoSection/QuestInfoSection'
import { QuestRewardsSection } from '../QuestRewardsSection/QuestRewardsSection'
import { QuestUnlockSection } from '../QuestUnlockSection/QuestUnlockSection'
import './QuestDetailPanel.css'

const tabs: { id: QuestDetailTab; label: string }[] = [
  { id: 'info', label: '任务信息' },
  { id: 'rewards', label: '报酬' },
  { id: 'unlocks', label: '解锁关系' },
]
const availability = (value: QuestDetail['availability']) => value === 'common' ? '共通' : value === 'mhgu' ? 'MHGU' : 'MHXX'
const keyStatus = (value: QuestDetail['keyStatus']) => value === 'key' ? '关键任务' : value === 'urgent' ? '紧急任务' : '普通任务'

type Props = {
  quest: QuestDetail | null
  loading: boolean
  error?: string
  tab?: QuestDetailTab
  onTabChange?: (tab: QuestDetailTab) => void
  onSelectMonster: (id: number) => void
  onSelectItem?: (item: ItemIdentity) => void
  onSelectQuest?: (key: string) => void
  onSelectHunterArt?: (id: number) => void
}

export function QuestDetailPanel({ quest, loading, error, tab = 'info', onTabChange = () => undefined, onSelectMonster, onSelectItem = () => undefined, onSelectQuest = () => undefined, onSelectHunterArt = () => undefined }: Props) {
  const tabPrefix = useId()
  if (error) return <section className="quest-detail-panel quest-detail-panel--state" role="alert">{error}</section>
  if (!quest) return <section className="quest-detail-panel quest-detail-panel--state">{loading ? '正在读取任务资料…' : '未找到任务资料。'}</section>

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, current: QuestDetailTab) => {
    const index = tabs.findIndex(value => value.id === current)
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : undefined
    if (next == null) return
    event.preventDefault()
    const nextTab = tabs[(next + tabs.length) % tabs.length]
    onTabChange(nextTab.id)
    document.getElementById(`${tabPrefix}-quest-detail-tab-${nextTab.id}`)?.focus()
  }

  return (
    <section className="quest-detail-panel" aria-busy={loading}>
      <header className="quest-detail-panel__header">
        <small className="quest-detail-panel__eyebrow">{quest.gameId === 'mhp2g' ? (quest.p2g?.source === 'wiki' ? 'Wiki 配信' : 'P2G 本体') : availability(quest.availability)} · {quest.questKey}</small>
        <div className="quest-detail-panel__title-row">
          <h2 className="quest-detail-panel__title">{quest.nameCn}</h2>
          <span className={`quest-detail-panel__key quest-detail-panel__key--${quest.keyStatus}`}>{keyStatus(quest.keyStatus)}</span>
        </div>
        {quest.nameEn && <p className="quest-detail-panel__alternate-name">{quest.nameEn}</p>}
        {quest.nameJp && <p className="quest-detail-panel__alternate-name">{quest.nameJp}</p>}
        {loading && <em className="quest-detail-panel__updating">正在更新…</em>}
      </header>
      <div className="quest-detail-panel__tabs" role="tablist" aria-label="任务详情">
        {tabs.map(value => (
          <button
            className="quest-detail-panel__tab"
            id={`${tabPrefix}-quest-detail-tab-${value.id}`}
            key={value.id}
            type="button"
            role="tab"
            aria-selected={tab === value.id}
            tabIndex={tab === value.id ? 0 : -1}
            onClick={() => onTabChange(value.id)}
            onKeyDown={event => moveTab(event, value.id)}
          >{value.label}</button>
        ))}
      </div>
      <div className="quest-detail-panel__body" role="tabpanel" aria-labelledby={`${tabPrefix}-quest-detail-tab-${tab}`}>
        {tab === 'info' && <QuestInfoSection quest={quest} onSelectMonster={onSelectMonster} onSelectItem={onSelectItem} />}
        {tab === 'rewards' && <QuestRewardsSection quest={quest} onSelectItem={onSelectItem} onSelectHunterArt={onSelectHunterArt} />}
        {tab === 'unlocks' && <QuestUnlockSection quest={quest} onSelectQuest={onSelectQuest} onSelectHunterArt={onSelectHunterArt} onSelectMonster={onSelectMonster} />}
      </div>
    </section>
  )
}
