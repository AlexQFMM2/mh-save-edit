import { HomePage } from './pages/HomePage/HomePage'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GameHomePage } from './pages/GameHomePage/GameHomePage'
import { GameOverviewPage } from './pages/GameOverviewPage/GameOverviewPage'
import { WorkspaceFeaturePage } from './pages/WorkspaceFeaturePage/WorkspaceFeaturePage'
import { workspaceNavigation } from './data/workspaceNavigation'
import { SaveEditorPage } from './pages/SaveEditorPage/SaveEditorPage'
import { ItemCatalogPage } from './pages/ItemCatalogPage/ItemCatalogPage'

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
              element={item.id === 'save-editor' ? <SaveEditorPage /> : item.id === 'items' ? <ItemCatalogPage /> : <WorkspaceFeaturePage pageId={item.id} />}
            />
          ))}
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
