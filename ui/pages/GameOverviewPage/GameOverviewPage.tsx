import { useOutletContext } from 'react-router-dom'
import { GameOverviewPanel } from '../../components/GameOverviewPanel/GameOverviewPanel'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './GameOverviewPage.css'

export function GameOverviewPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()

  return (
    <div className="game-overview-page">
      <GameOverviewPanel game={game} />
    </div>
  )
}
