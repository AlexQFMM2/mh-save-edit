import { Outlet } from 'react-router-dom'
import type { GameVersionDefinition } from '../../data/gameVersions'
import './WorkspaceContent.css'

export type WorkspaceOutletContext = {
  game: GameVersionDefinition
  loadedSaveName?: string
  onOpenSave: () => void
}

type WorkspaceContentProps = {
  game: GameVersionDefinition
  loadedSaveName?: string
  onOpenSave: () => void
}

export function WorkspaceContent({ game, loadedSaveName, onOpenSave }: WorkspaceContentProps) {
  const context: WorkspaceOutletContext = { game, loadedSaveName, onOpenSave }

  return (
    <section id="workspace-content" className="workspace-content" aria-label={`${game.title} 内容区域`} tabIndex={-1}>
      <div className="workspace-content__surface">
        <Outlet context={context} />
      </div>
    </section>
  )
}
