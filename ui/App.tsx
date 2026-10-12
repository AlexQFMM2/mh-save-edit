import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes, useOutletContext } from 'react-router-dom'
import { HomePage } from './pages/HomePage/HomePage'
import { GameHomePage } from './pages/GameHomePage/GameHomePage'
import { GameOverviewPage } from './pages/GameOverviewPage/GameOverviewPage'
import { WorkspaceFeaturePage } from './pages/WorkspaceFeaturePage/WorkspaceFeaturePage'
import { workspaceNavigation } from './data/workspaceNavigation'
import { hasRuntimeWorkspace } from './data/gameVersions'
import type { ShellOutletContext } from './components/WorkspaceContent/WorkspaceContent'
import { SaveEditorPage } from './pages/SaveEditorPage/SaveEditorPage'
import { SaveSessionProvider } from './components/SaveSessionProvider/SaveSessionProvider'
import { ItemCatalogPage } from './pages/ItemCatalogPage/ItemCatalogPage'
import { DecorationCatalogPage } from './pages/DecorationCatalogPage/DecorationCatalogPage'
const WeaponCatalogPage=lazy(async()=>({default:(await import('./pages/WeaponCatalogPage/WeaponCatalogPage')).WeaponCatalogPage}))
const ArmorCatalogPage=lazy(async()=>({default:(await import('./pages/ArmorCatalogPage/ArmorCatalogPage')).ArmorCatalogPage}))
const MonsterCatalogPage=lazy(async()=>({default:(await import('./pages/MonsterCatalogPage/MonsterCatalogPage')).MonsterCatalogPage}))
const QuestCatalogPage=lazy(async()=>({default:(await import('./pages/QuestCatalogPage/QuestCatalogPage')).QuestCatalogPage}))
const HunterArtCatalogPage=lazy(async()=>({default:(await import('./pages/HunterArtCatalogPage/HunterArtCatalogPage')).HunterArtCatalogPage}))
const SkillCatalogPage=lazy(async()=>({default:(await import('./pages/SkillCatalogPage/SkillCatalogPage')).SkillCatalogPage}))
const LoadoutBuilderPage=lazy(async()=>({default:(await import('./pages/LoadoutBuilderPage/LoadoutBuilderPage')).LoadoutBuilderPage}))
const PalicoTypesCatalogPage=lazy(async()=>({default:(await import('./pages/PalicoTypesCatalogPage/PalicoTypesCatalogPage')).PalicoTypesCatalogPage}))
const PalicoSupportMovesCatalogPage=lazy(async()=>({default:(await import('./pages/PalicoSupportMovesCatalogPage/PalicoSupportMovesCatalogPage')).PalicoSupportMovesCatalogPage}))
const PalicoSkillsCatalogPage=lazy(async()=>({default:(await import('./pages/PalicoSkillsCatalogPage/PalicoSkillsCatalogPage')).PalicoSkillsCatalogPage}))
const PalicoEquipmentCatalogPage=lazy(async()=>({default:(await import('./pages/PalicoEquipmentCatalogPage/PalicoEquipmentCatalogPage')).PalicoEquipmentCatalogPage}))
function Feature({item}:{item:typeof workspaceNavigation[number]['items'][number]}){
  const {game}=useOutletContext<ShellOutletContext>()
  if(item.supportedGames && !item.supportedGames.includes(game.id))return <Navigate to={`/game/${game.id}/overview`} replace/>
  if(!hasRuntimeWorkspace(game) && item.id!=='items' && item.id!=='monsters' && item.id!=='quests')return <WorkspaceFeaturePage pageId={item.id}/>
  if(item.id==='save-editor')return <SaveEditorPage/>
  if(item.id==='items')return <ItemCatalogPage/>
  if(item.id==='decorations')return <DecorationCatalogPage/>
  const pages={skills:SkillCatalogPage,weapons:WeaponCatalogPage,armor:ArmorCatalogPage,monsters:MonsterCatalogPage,quests:QuestCatalogPage,'hunter-arts':HunterArtCatalogPage,'palico-types':PalicoTypesCatalogPage,'palico-support-moves':PalicoSupportMovesCatalogPage,'palico-skills':PalicoSkillsCatalogPage,'palico-equipment':PalicoEquipmentCatalogPage,loadout:LoadoutBuilderPage} as const
  const Page=pages[item.id as keyof typeof pages]
  return Page?<Suspense fallback={<WorkspaceFeaturePage pageId={item.id}/>}><Page/></Suspense>:<WorkspaceFeaturePage pageId={item.id}/>
}
export default function App(){return <SaveSessionProvider><HashRouter><Routes><Route path="/" element={<HomePage/>}/><Route path="/game/:gameId" element={<GameHomePage/>}><Route index element={<Navigate to="overview" replace/>}/><Route path="overview" element={<GameOverviewPage/>}/>{workspaceNavigation.flatMap(group=>group.items).map(item=><Route key={item.id} path={item.path} element={<Feature item={item}/>}/>) }<Route path="*" element={<Navigate to="overview" replace/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></HashRouter></SaveSessionProvider>}
