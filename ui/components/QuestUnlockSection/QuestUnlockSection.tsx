import type { QuestDetail } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import { P2gQuestConditions } from '../P2gQuestConditions/P2gQuestConditions'
import './QuestUnlockSection.css'

export function QuestUnlockSection({ quest, onSelectQuest, onSelectHunterArt, onSelectMonster }: { quest: QuestDetail; onSelectQuest: (key: string) => void; onSelectHunterArt: (id: number) => void; onSelectMonster: (id: number) => void }) {
  const prerequisites = quest.relations.filter(value => value.direction === 'prerequisite')
  const unlocks = quest.relations.filter(value => value.direction === 'unlocks')
  const arts = quest.specialRewards.filter(value => value.hunterArt)
  return (
    <div className="quest-unlock-section">
      {quest.p2g && <P2gQuestConditions data={quest.p2g} onSelectQuest={onSelectQuest} onSelectMonster={onSelectMonster} />}
      {!quest.p2g && prerequisites.length === 0 && unlocks.length === 0 && arts.length === 0 && <p className="quest-unlock-section__empty">暂无已确认的解锁关系。</p>}
      {!quest.p2g && prerequisites.length > 0 && <RelationGroup title="前置任务" rows={prerequisites} onSelect={onSelectQuest} />}
      {unlocks.length > 0 && <RelationGroup title="解锁任务" rows={unlocks} onSelect={onSelectQuest} />}
      {arts.length > 0 && (
        <DetailSection title="解锁狩技" className="quest-unlock-section__group">
          <div className="quest-unlock-section__items">
            {arts.map(value => <button className="quest-unlock-section__item" key={value.id} type="button" onClick={() => onSelectHunterArt(value.hunterArt!.hunterArtId)}><span>{value.hunterArt!.nameCn}</span>{value.evidenceStatus === 'wiki_only' && <small className="quest-unlock-section__source">Wiki 资料</small>}</button>)}
          </div>
        </DetailSection>
      )}
    </div>
  )
}

function RelationGroup({ title, rows, onSelect }: { title: string; rows: QuestDetail['relations']; onSelect: (key: string) => void }) {
  return (
    <DetailSection title={title} className="quest-unlock-section__group">
      <div className="quest-unlock-section__items">
        {rows.map(value => <button className="quest-unlock-section__item" key={value.id} type="button" onClick={() => onSelect(value.quest.questKey)}><span>{value.quest.nameCn}</span><small className="quest-unlock-section__source">{value.operator === 'any' ? '满足任一条件' : '需满足条件'} · {value.evidenceStatus === 'wiki_only' ? 'Wiki 资料' : '已验证'}</small></button>)}
      </div>
    </DetailSection>
  )
}
