import type { ItemIdentity, QuestDetail } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import { P2gQuestIndividuals } from '../P2gQuestIndividuals/P2gQuestIndividuals'
import './P2gQuestSpawns.css'

export function P2gQuestSpawns({ quest, onSelectMonster, onSelectItem }: { quest: QuestDetail; onSelectMonster: (id: number) => void; onSelectItem: (item: ItemIdentity) => void }) {
  const data = quest.p2g!
  const monsterName = (id: number) => [...quest.monsters, ...data.conditionMonsters].find(m => m.monsterId === id)?.nameCn ?? `怪物 ${id}`
  return <div className="p2g-quest-spawns">
    <DetailSection title="出场配置">
      {data.largeGroups == null ? <p className="p2g-quest-spawns__note">出场分组与时机未收录。</p> : <>
        <p className="p2g-quest-spawns__note">{data.sequential ? '以下各组在同一运行槽依次出场。' : '以下为任务配置；配置数量不代表同时出场数量。'}</p>
        {data.largeGroups.map((group, index) => <div className="p2g-quest-spawns__group" key={index}><span>大型 · 第 {index + 1} 组</span>{group.map((m, ordinal) => <button type="button" className="p2g-quest-spawns__link" key={ordinal} onClick={() => onSelectMonster(m.monsterId)}>{monsterName(m.monsterId)} <span className="p2g-quest-spawns__data">×{m.quantity}</span></button>)}</div>)}
        {data.wait && <p className="p2g-quest-spawns__note">第二只金狮子在前一只结束或等待约 10 分钟后进入战斗。{data.wait.introFlagBeforeTimer != null && '首次还需等待介绍事件结束。'}计时受游戏运行状态影响。</p>}
      </>}
      {data.smallGroups && <details className="p2g-quest-spawns__details"><summary>小型怪物分组</summary>
        <p className="p2g-quest-spawns__note">初始使用第 1 组；只向后切换。条件计数从任务开始时独立累计，切换后不回退。</p>
        {data.smallGroups.map(group => <div className="p2g-quest-spawns__group" key={group.index}><span>第 {group.index + 1} 组</span>{group.monsterIds.length ? group.monsterIds.map(id => <button type="button" className="p2g-quest-spawns__link" key={id} onClick={() => onSelectMonster(id)}>{monsterName(id)}</button>) : <span>无怪物配置</span>}</div>)}
        {data.transitions.map(t => { const c = t.condition; const item = data.transitionItems.find(i => i.gameId === 'mhp2g' && i.itemId === c.itemId); return <p className="p2g-quest-spawns__note" key={t.nextGroupIndex}>切换到第 {t.nextGroupIndex + 1} 组：{c.monsterId != null ? <>讨伐 <button type="button" className="p2g-quest-spawns__link" onClick={() => onSelectMonster(c.monsterId!)}>{monsterName(c.monsterId)}</button> 至少 <span className="p2g-quest-spawns__data">{c.requiredEvents}</span> 次（捕获不计）。</> : item ? <>当前携带 <button type="button" className="p2g-quest-spawns__link" onClick={() => onSelectItem(item)}>{item.nameCn}</button> 至少 <span className="p2g-quest-spawns__data">{c.count ?? c.minimum ?? c.quantity ?? c.threshold}</span> 个。</> : '条件未收录'}</p> })}
      </details>}
      <P2gQuestIndividuals data={data} onSelectMonster={onSelectMonster} />
    </DetailSection>
  </div>
}
