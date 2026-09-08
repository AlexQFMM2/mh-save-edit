import { useMemo } from 'react'
import type { MonsterQuestAppearance, QuestAvailability } from '../../../api/catalog/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './MonsterQuestAppearanceTable.css'

const options=[{value:'all',label:'全部版本'},{value:'common',label:'共通'},{value:'mhgu',label:'MHGU'}]
const availabilityName=(value:QuestAvailability)=>value==='common'?'共通':value==='mhgu'?'MHGU':'MHXX'
export function MonsterQuestAppearanceTable({ quests, availability, showAvailabilityFilter, onAvailabilityChange, onSelectQuest }: { quests:MonsterQuestAppearance[];availability:'all'|QuestAvailability;showAvailabilityFilter:boolean;onAvailabilityChange:(value:'all'|QuestAvailability)=>void;onSelectQuest:(key:string)=>void }) {
  const rows=useMemo(()=>availability==='all'?quests:quests.filter(quest=>quest.availability===availability),[quests,availability])
  return <div className="monster-quest-appearance-table"><div className="monster-quest-appearance-table__toolbar"><span>{rows.length} 个任务</span>{showAvailabilityFilter&&<label><span>版本</span><SearchableSelect value={availability} options={options} ariaLabel="筛选任务版本" onChange={value=>onAvailabilityChange(value as 'all'|QuestAvailability)}/></label>}</div><div className="monster-quest-appearance-table__scroller"><table><thead><tr><th>版本</th><th>位阶</th><th>任务</th><th>类型</th><th>地图</th><th>目标</th><th>时间</th><th>报酬</th><th>HRP</th></tr></thead><tbody>{rows.map(quest=><tr key={quest.questKey}><td>{availabilityName(quest.availability)}</td><td>{quest.levelNameCn}</td><th><button type="button" onClick={()=>onSelectQuest(quest.questKey)}>{quest.nameCn}</button></th><td>{quest.questTypeNameCn}</td><td>{quest.locationNameCn}</td><td title={quest.goalCn}>{quest.goalCn||'—'}</td><td>{quest.timeMinutes==null?'—':`${quest.timeMinutes} 分`}</td><td>{quest.reward==null?'—':`${quest.reward} z`}</td><td>{quest.hrp??'—'}</td></tr>)}</tbody></table></div></div>
}
