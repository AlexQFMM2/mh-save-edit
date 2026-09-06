import type { GameId } from '../../../api/core/loadout'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { GameVersionCard } from '../GameVersionCard/GameVersionCard'
import './GameVersionGrid.css'

type GameVersionGridProps = {
  games: GameVersionDefinition[]
  selectedGameId: GameId | null
  onSelect: (gameId: GameId) => void
  onPreviewChange: (gameId: GameId | null) => void
}

export function GameVersionGrid({ games, selectedGameId, onSelect, onPreviewChange }: GameVersionGridProps) {
  return (
    <div className="game-version-grid" role="group" aria-label="游戏版本列表">
      {games.map((game) => (
        <GameVersionCard
          key={game.id}
          game={game}
          selected={game.id === selectedGameId}
          onSelect={onSelect}
          onPreviewChange={onPreviewChange}
        />
      ))}
    </div>
  )
}
