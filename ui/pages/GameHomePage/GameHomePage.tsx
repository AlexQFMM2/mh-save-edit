import { Navigate, useParams } from 'react-router-dom'
import type { GameId } from '../../../api/core/loadout'
import { GameShell } from '../../components/GameShell/GameShell'
import { gameVersions } from '../../data/gameVersions'
import './GameHomePage.css'

export function GameHomePage() {
  const { gameId } = useParams<{ gameId: string }>()

  if (!isGameId(gameId)) return <Navigate to="/" replace />

  const game = gameVersions.find((item) => item.id === gameId)!

  return <div className="game-home-page"><GameShell key={game.id} game={game} /></div>
}

export function isGameId(value: string | undefined): value is GameId {
  return gameVersions.some((game) => game.id === value)
}
