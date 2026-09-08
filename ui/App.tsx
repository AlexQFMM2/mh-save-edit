import { lazy, Suspense } from 'react'
import { HomePage } from './pages/HomePage/HomePage'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GameHomePage } from './pages/GameHomePage/GameHomePage'
import { GameOverviewPage } from './pages/GameOverviewPage/GameOverviewPage'
import { WorkspaceFeaturePage } from './pages/WorkspaceFeaturePage/WorkspaceFeaturePage'
import { workspaceNavigation } from './data/workspaceNavigation'
import { SaveEditorPage } from './pages/SaveEditorPage/SaveEditorPage'
import { ItemCatalogPage } from './pages/ItemCatalogPage/ItemCatalogPage'
import { DecorationCatalogPage } from './pages/DecorationCatalogPage/DecorationCatalogPage'

const WeaponCatalogPage = lazy(async () => ({ default: (await import('./pages/WeaponCatalogPage/WeaponCatalogPage')).WeaponCatalogPage }))
const ArmorCatalogPage = lazy(async () => ({ default: (await import('./pages/ArmorCatalogPage/ArmorCatalogPage')).ArmorCatalogPage }))
const MonsterCatalogPage = lazy(async () => ({ default: (await import('./pages/MonsterCatalogPage/MonsterCatalogPage')).MonsterCatalogPage }))
const QuestCatalogPage = lazy(async () => ({ default: (await import('./pages/QuestCatalogPage/QuestCatalogPage')).QuestCatalogPage }))
const HunterArtCatalogPage = lazy(async () => ({ default: (await import('./pages/HunterArtCatalogPage/HunterArtCatalogPage')).HunterArtCatalogPage }))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameId" element={<GameHomePage />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<GameOverviewPage />} />
          {workspaceNavigation.flatMap((group) => group.items).map((item) => (
            <Route
              key={item.id}
              path={item.path}
              element={item.id === 'save-editor' ? <SaveEditorPage /> : item.id === 'items' ? <ItemCatalogPage /> : item.id === 'decorations' ? <DecorationCatalogPage /> : item.id === 'weapons' ? <Suspense fallback={<WorkspaceFeaturePage pageId="weapons" />}><WeaponCatalogPage /></Suspense> : item.id === 'armor' ? <Suspense fallback={<WorkspaceFeaturePage pageId="armor" />}><ArmorCatalogPage /></Suspense> : item.id === 'monsters' ? <Suspense fallback={<WorkspaceFeaturePage pageId="monsters" />}><MonsterCatalogPage /></Suspense> : item.id === 'quests' ? <Suspense fallback={<WorkspaceFeaturePage pageId="quests" />}><QuestCatalogPage /></Suspense> : item.id === 'hunter-arts' ? <Suspense fallback={<WorkspaceFeaturePage pageId="hunter-arts" />}><HunterArtCatalogPage /></Suspense> : <WorkspaceFeaturePage pageId={item.id} />}
            />
          ))}
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
