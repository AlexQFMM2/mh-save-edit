import type { HunterArtDetail, HunterArtUnlockCondition } from '../../../api/catalog/types'
import './HunterArtDetailPanel.css'

type Props = {
  art: HunterArtDetail | null
  loading: boolean
  error?: string
  onSelectQuest: (key: string) => void
  onSelectMonster?: (id: number) => void
}

const unlockKindNames = {
  initial: '初始解锁',
  quest: '任务解锁',
  hunterRank: '猎人等级',
  contribution: '村庄进度',
  palicoLevel: '随从等级',
  monster: '狩猎怪物',
  npc: 'NPC 对话',
  compound: '复合条件',
  other: '其他条件',
} as const

export function HunterArtDetailPanel({ art, loading, error, onSelectQuest, onSelectMonster = () => undefined }: Props) {
  if (error) return <section className="hunter-art-detail-panel hunter-art-detail-panel--state" role="alert">{error}</section>
  if (!art) return <section className="hunter-art-detail-panel hunter-art-detail-panel--state">{loading ? '正在读取狩技…' : '请选择狩技。'}</section>

  return (
    <section className="hunter-art-detail-panel" aria-busy={loading}>
      <header className="hunter-art-detail-panel__header">
        <small className="hunter-art-detail-panel__eyebrow">GU/XX 共通 · 狩技 ID {art.hunterArtId} · {art.weaponTypeNameCn}{art.level ? ` · 等级 ${art.level}` : ''}</small>
        <h2 className="hunter-art-detail-panel__title">{art.nameCn}</h2>
        <p className="hunter-art-detail-panel__alternate-name">{art.nameEn}</p>
        <p className="hunter-art-detail-panel__alternate-name">{art.nameJp}</p>
        {loading && <em className="hunter-art-detail-panel__updating">正在更新…</em>}
      </header>
      <div className="hunter-art-detail-panel__body">
        <section className="hunter-art-detail-panel__section">
          <h3 className="hunter-art-detail-panel__section-title">狩技说明</h3>
          <p className="hunter-art-detail-panel__description">{art.longDescriptionCn || art.shortDescriptionCn}</p>
          {art.longDescriptionEn && (
            <details className="hunter-art-detail-panel__translation">
              <summary className="hunter-art-detail-panel__translation-summary">英文说明</summary>
              <p className="hunter-art-detail-panel__description">{art.longDescriptionEn}</p>
            </details>
          )}
        </section>
        <section className="hunter-art-detail-panel__section">
          <h3 className="hunter-art-detail-panel__section-title">解锁条件</h3>
          {art.unlocks.map(unlock => (
            <div className="hunter-art-detail-panel__unlock" key={unlock.id}>
              <div className="hunter-art-detail-panel__unlock-heading">
                <strong>{unlockKindNames[unlock.kind]}</strong>
                {unlock.evidenceStatus === 'wiki_only' && <span className="hunter-art-detail-panel__source-badge">Wiki 资料</span>}
              </div>
              <Condition condition={unlock.condition} onSelectQuest={onSelectQuest} onSelectMonster={onSelectMonster} />
              {unlock.condition.kind !== 'sourceText' && unlock.kind !== 'initial' && <p className="hunter-art-detail-panel__source-text">来源原文：{unlock.sourceText}</p>}
            </div>
          ))}
        </section>
        {art.quests.length > 0 && (
          <section className="hunter-art-detail-panel__section">
            <h3 className="hunter-art-detail-panel__section-title">关联任务</h3>
            <div className="hunter-art-detail-panel__quests">
              {art.quests.map(quest => (
                <button className="hunter-art-detail-panel__relation-button" type="button" key={quest.questKey} onClick={() => onSelectQuest(quest.questKey)}>
                  <span>{quest.nameCn}</span>
                  <small className="hunter-art-detail-panel__relation-meta">{quest.afterNpcConversation ? '完成后与 NPC 对话' : '完成任务'} · {quest.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '已验证'}</small>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

function Condition({ condition, onSelectQuest, onSelectMonster }: { condition: HunterArtUnlockCondition; onSelectQuest: (key: string) => void; onSelectMonster: (id: number) => void }) {
  switch (condition.kind) {
    case 'initial': return <p className="hunter-art-detail-panel__condition-text">游戏开始时即可使用。</p>
    case 'sourceText': return <p className="hunter-art-detail-panel__condition-text">{condition.text}</p>
    case 'quest': return <button className="hunter-art-detail-panel__relation-button" type="button" onClick={() => onSelectQuest(condition.questKey)}>{condition.nameCn || condition.nameEn}</button>
    case 'hunterRank': return <p className="hunter-art-detail-panel__condition-text">猎人等级达到 HR {condition.minimum}</p>
    case 'villageContribution': return <p className="hunter-art-detail-panel__condition-text">{condition.village}村贡献度达到 {condition.minimum}</p>
    case 'villageQuestCount': return <p className="hunter-art-detail-panel__condition-text">完成 {condition.village}村任务 {condition.minimum} 个</p>
    case 'palicoLevel': return <p className="hunter-art-detail-panel__condition-text">任一随从等级达到 {condition.minimum}</p>
    case 'huntMonster': return <button className="hunter-art-detail-panel__relation-button" type="button" onClick={() => onSelectMonster(condition.monsterId)}>狩猎{condition.nameCn} × {condition.quantity}</button>
    case 'npcConversation': return <p className="hunter-art-detail-panel__condition-text">与 {condition.npcName} 对话</p>
    case 'arenaQuest': return <p className="hunter-art-detail-panel__condition-text">完成斗技场任务“{condition.name}”</p>
    case 'all':
    case 'any':
      return (
        <div className="hunter-art-detail-panel__condition-group">
          <strong>{condition.kind === 'any' ? '满足任意一项' : '满足全部条件'}</strong>
          {condition.conditions.map((child, index) => <Condition key={index} condition={child} onSelectQuest={onSelectQuest} onSelectMonster={onSelectMonster} />)}
        </div>
      )
  }
}
