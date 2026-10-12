import type { P2gQuestCondition, P2gQuestData } from '../../../api/catalog/p2gQuestTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gQuestConditions.css'

type Props = { data: P2gQuestData; node?: P2gQuestCondition; onSelectQuest: (key: string) => void; onSelectMonster: (id: number) => void }
export function P2gQuestConditions({ data, node, onSelectQuest, onSelectMonster }: Props) {
  if (!node) return <DetailSection title="开放与显示条件"><div className="p2g-quest-conditions"><p className="p2g-quest-conditions__note">按以下条件结构阅读；此外仍需满足对应任务等级及游戏进度。</p>{data.keyPrerequisite && <p className="p2g-quest-conditions__note">此任务是关键任务的前置。</p>}<P2gQuestConditions data={data} node={data.condition} onSelectQuest={onSelectQuest} onSelectMonster={onSelectMonster} /></div></DetailSection>
  const quest = data.conditionQuests.find(q => q.questKey === node.questKey)
  if (node.kind === 'condition') return <div className="p2g-quest-conditions__entry">{node.text} {quest && <button type="button" className="p2g-quest-conditions__link" onClick={() => onSelectQuest(quest.questKey)}>{quest.nameCn}</button>}{node.monsterIds?.map(id => <button type="button" className="p2g-quest-conditions__link" key={id} onClick={() => onSelectMonster(id)}>{data.conditionMonsters.find(m => m.monsterId === id)?.nameCn}</button>)}</div>
  const content = node.children?.map((child, index) => <P2gQuestConditions key={index} data={data} node={child} onSelectQuest={onSelectQuest} onSelectMonster={onSelectMonster} />)
  const label = node.kind === 'any' ? '满足任一分支（OR）' : node.kind === 'not' ? '下列条件未满足' : '同时满足（AND）'
  return <details className="p2g-quest-conditions__group" open={(node.children?.length ?? 0) < 12}><summary className="p2g-quest-conditions__label">{node.text ? `${node.text} · ${label}` : label}</summary>{content}</details>
}
