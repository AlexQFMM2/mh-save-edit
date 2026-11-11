import { P3MonsterContext } from '../P3MonsterContext/P3MonsterContext'
import { P3MonsterAppearanceList } from '../P3MonsterAppearances/P3MonsterAppearances'
import type { MonsterCatalogGameId, ItemIdentity, MonsterCatalogTab, MonsterDetail, QuestAvailability } from '../../../api/catalog/types'
import { useId } from 'react'
import { MonsterAilmentTable } from '../MonsterAilmentTable/MonsterAilmentTable'
import { MonsterDetailHeader } from '../MonsterDetailHeader/MonsterDetailHeader'
import { MonsterDetailTabs } from '../MonsterDetailTabs/MonsterDetailTabs'
import { MonsterDropTable } from '../MonsterDropTable/MonsterDropTable'
import { MonsterQuestAppearanceTable } from '../MonsterQuestAppearanceTable/MonsterQuestAppearanceTable'
import { MonsterWeaknessTable } from '../MonsterWeaknessTable/MonsterWeaknessTable'
import { P2gMonsterQuestList } from '../P2gMonsterQuestList/P2gMonsterQuestList'
import './MonsterDetailPanel.css'

export function MonsterDetailPanel({ gameId, monster, loading, error, tab, dropDirection, taskAvailability, onTabChange, onDropDirectionChange, onTaskAvailabilityChange, onSelectItem, onSelectQuest, onRetry, missing = false }: { gameId:MonsterCatalogGameId;onRetry?:()=>void;missing?:boolean;monster:MonsterDetail|null;loading:boolean;error?:string;tab:MonsterCatalogTab;dropDirection:'asc'|'desc';taskAvailability:'all'|QuestAvailability;onTabChange:(tab:MonsterCatalogTab)=>void;onDropDirectionChange:(value:'asc'|'desc')=>void;onTaskAvailabilityChange:(value:'all'|QuestAvailability)=>void;onSelectItem:(item:ItemIdentity)=>void;onSelectQuest:(key:string)=>void }) {
  const panelId=useId()
  if(error&&!monster)return <section className="monster-detail-panel monster-detail-panel--state" role="alert">{error}{onRetry&&<button type="button" onClick={onRetry}>重试详情</button>}</section>
  if(!monster)return <section className="monster-detail-panel monster-detail-panel--state">{loading?'正在读取怪物资料…':missing?'未找到此怪物。':'从左侧选择一个怪物查看详情。'}</section>
  return <section className={`monster-detail-panel${monster.p3?' monster-detail-panel--p3':''}`} aria-label={`${monster.nameCn}详情`}><MonsterDetailHeader monster={monster} updating={loading}/>{monster.p3&&<P3MonsterContext data={monster.p3}/>}<MonsterDetailTabs value={tab} panelId={panelId} onChange={onTabChange}/><div id={panelId} className="monster-detail-panel__body" role="tabpanel">
    {tab==='weakness'&&<MonsterWeaknessTable rows={monster.weakness}/>} {tab==='ailments'&&<MonsterAilmentTable ailments={monster.ailments} traps={monster.traps} p2g={gameId==='mhp2g'} p3={gameId==='mhp3'}/>} {tab==='drops'&&<MonsterDropTable rows={monster.drops} direction={dropDirection} onDirectionChange={onDropDirectionChange} onSelectItem={onSelectItem}/>} {tab==='quests'&&(gameId==='mhp3'?<P3MonsterAppearanceList rows={monster.p3?.appearances??[]} onSelect={onSelectQuest}/>:gameId==='mhp2g'?<P2gMonsterQuestList quests={monster.p2gQuests??[]} onSelectQuest={onSelectQuest}/>:<MonsterQuestAppearanceTable quests={monster.quests} availability={taskAvailability} showAvailabilityFilter={gameId==='mhgu'} onAvailabilityChange={onTaskAvailabilityChange} onSelectQuest={onSelectQuest}/>)}
  </div>{error&&<div className="monster-detail-panel__notice" role="alert">更新失败：{error}{onRetry&&<button type="button" onClick={onRetry}>重试详情</button>}</div>}</section>
}
