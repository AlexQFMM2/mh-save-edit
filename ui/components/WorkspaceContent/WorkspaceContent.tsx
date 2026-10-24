import { Outlet } from 'react-router-dom'
import type { GameVersionDefinition, RuntimeGameVersionDefinition } from '../../data/gameVersions'
import './WorkspaceContent.css'

export type ShellOutletContext = {
  game: GameVersionDefinition
}

// Feature routes in App validate runtime support before rendering catalog/edit pages.
export type WorkspaceOutletContext = { game: RuntimeGameVersionDefinition }
export type DecorationCatalogOutletContext = { game: GameVersionDefinition & { id: import('../../../api/catalog/types').DecorationCatalogGameId } }
export type ItemCatalogOutletContext = { game: GameVersionDefinition & { id: import('../../../api/catalog/types').ItemCatalogGameId } }

type WorkspaceContentProps = {
  game: GameVersionDefinition
}

export function WorkspaceContent({ game }: WorkspaceContentProps) {
  const context: ShellOutletContext = { game }

  return (
    <section id="workspace-content" className="workspace-content" aria-label={`${game.title} 内容区域`} tabIndex={-1}>
      <div className="workspace-content__surface">
        <Outlet context={context} />
      </div>
    </section>
  )
}
