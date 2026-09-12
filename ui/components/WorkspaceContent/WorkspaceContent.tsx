import { Outlet } from 'react-router-dom'
import type { GameVersionDefinition } from '../../data/gameVersions'
import './WorkspaceContent.css'

export type WorkspaceOutletContext = {
  game: GameVersionDefinition
}

type WorkspaceContentProps = {
  game: GameVersionDefinition
}

export function WorkspaceContent({ game }: WorkspaceContentProps) {
  const context: WorkspaceOutletContext = { game }

  return (
    <section id="workspace-content" className="workspace-content" aria-label={`${game.title} 内容区域`} tabIndex={-1}>
      <div className="workspace-content__surface">
        <Outlet context={context} />
      </div>
    </section>
  )
}
