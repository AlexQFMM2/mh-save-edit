import type { MonsterCatalogTab, MonsterDetail, QuestAvailability } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { useId } from 'react'
import { MonsterAilmentTable } from '../MonsterAilmentTable/MonsterAilmentTable'
import { MonsterDetailHeader } from '../MonsterDetailHeader/MonsterDetailHeader'
import { MonsterDetailTabs } from '../MonsterDetailTabs/MonsterDetailTabs'
import { MonsterDropTable } from '../MonsterDropTable/MonsterDropTable'
import { MonsterQuestAppearanceTable } from '../MonsterQuestAppearanceTable/MonsterQuestAppearanceTable'
import { MonsterWeaknessTable } from '../MonsterWeaknessTable/MonsterWeaknessTable'
import './MonsterDetailPanel.css'

export function MonsterDetailPanel({ gameId, monster, loading, error, tab, dropDirection, taskAvailability, onTabChange, onDropDirectionChange, onTaskAvailabilityChange, onSelectItem, onSelectQuest }: { gameId:GameId;monster:MonsterDetail|null;loading:boolean;error?:string;tab:MonsterCatalogTab;dropDirection:'asc'|'desc';taskAvailability:'all'|QuestAvailability;onTabChange:(tab:MonsterCatalogTab)=>void;onDropDirectionChange:(value:'asc'|'desc')=>void;onTaskAvailabilityChange:(value:'all'|QuestAvailability)=>void;onSelectItem:(saveId:number)=>void;onSelectQuest:(key:string)=>void }) {
  const panelId=useId()
  if(error&&!monster)return <section className="monster-detail-panel monster-detail-panel--state" role="alert">{error}</section>
  if(!monster)return <section className="monster-detail-panel monster-detail-panel--state">{loading?'正在读取怪物资料…':'从左侧选择一个怪物查看详情。'}</section>
  return <section className="monster-detail-panel" aria-label={`${monster.nameCn}详情`}><MonsterDetailHeader monster={monster} updating={loading}/><MonsterDetailTabs value={tab} panelId={panelId} onChange={onTabChange}/><div id={panelId} className="monster-detail-panel__body" role="tabpanel">
    {tab==='weakness'&&<MonsterWeaknessTable rows={monster.weakness}/>} {tab==='ailments'&&<MonsterAilmentTable ailments={monster.ailments} traps={monster.traps}/>} {tab==='drops'&&<MonsterDropTable rows={monster.drops} direction={dropDirection} onDirectionChange={onDropDirectionChange} onSelectItem={onSelectItem}/>} {tab==='quests'&&<MonsterQuestAppearanceTable quests={monster.quests} availability={taskAvailability} showAvailabilityFilter={gameId==='mhgu'} onAvailabilityChange={onTaskAvailabilityChange} onSelectQuest={onSelectQuest}/>}
  </div>{error&&<div className="monster-detail-panel__notice" role="alert">更新失败：{error}</div>}</section>
}
