import { useRef, useState } from 'react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { CommonHeader } from '../CommonHeader/CommonHeader'
import { GuildBackdrop } from '../GuildBackdrop/GuildBackdrop'
import { WorkspaceContent } from '../WorkspaceContent/WorkspaceContent'
import { WorkspaceSidebar } from '../WorkspaceSidebar/WorkspaceSidebar'
import './GameShell.css'

type GameShellProps = {
  game: GameVersionDefinition
}

export function GameShell({ game }: GameShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loadedSaveName, setLoadedSaveName] = useState<string>()
  const saveInputRef = useRef<HTMLInputElement>(null)

  const openSavePicker = () => saveInputRef.current?.click()

  return (
    <main className={`game-shell${sidebarCollapsed ? ' game-shell--sidebar-collapsed' : ''}`}>
      <a className="game-shell__skip-link" href="#workspace-content">跳到内容区域</a>
      <input
        ref={saveInputRef}
        className="game-shell__file-input"
        type="file"
        aria-label="选择存档文件"
        onChange={(event) => setLoadedSaveName(event.target.files?.[0]?.name)}
      />
      <GuildBackdrop />
      <CommonHeader currentGame={game} saveStatus={loadedSaveName ?? '暂未选择存档'} />
      <div className="game-shell__body">
        <WorkspaceSidebar
          game={game}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <WorkspaceContent
          game={game}
          loadedSaveName={loadedSaveName}
          onOpenSave={openSavePicker}
        />
      </div>
    </main>
  )
}
