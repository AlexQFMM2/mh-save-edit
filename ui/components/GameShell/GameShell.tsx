import { useEffect, useState } from 'react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { CommonHeader } from '../CommonHeader/CommonHeader'
import { GuildBackdrop } from '../GuildBackdrop/GuildBackdrop'
import { WorkspaceContent } from '../WorkspaceContent/WorkspaceContent'
import { WorkspaceSidebar } from '../WorkspaceSidebar/WorkspaceSidebar'
import { useSaveSession } from '../SaveSessionProvider/SaveSessionProvider'
import './GameShell.css'

type GameShellProps = {
  game: GameVersionDefinition
}

export function GameShell({ game }: GameShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 1180)
  const { session } = useSaveSession()
  useEffect(() => {
    const collapseForNarrowWorkspace = () => { if (window.innerWidth <= 1180) setSidebarCollapsed(true) }
    window.addEventListener('resize', collapseForNarrowWorkspace)
    return () => window.removeEventListener('resize', collapseForNarrowWorkspace)
  }, [])

  return (
    <main className={`game-shell${sidebarCollapsed ? ' game-shell--sidebar-collapsed' : ''}`}>
      <a className="game-shell__skip-link" href="#workspace-content">跳到内容区域</a>
      <GuildBackdrop />
      <CommonHeader currentGame={game} saveStatus={session ? `${session.fileName}${session.dirty ? ' · 有未保存修改' : ''}` : '暂未选择存档'} />
      <div className="game-shell__body">
        <WorkspaceSidebar
          game={game}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <WorkspaceContent game={game} />
      </div>
    </main>
  )
}
