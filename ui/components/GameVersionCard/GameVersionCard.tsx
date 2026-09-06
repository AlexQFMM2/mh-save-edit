import { motion, useReducedMotion } from 'motion/react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { assetUrl } from '../../lib/assetUrl'
import { PlatformBadgeList } from '../PlatformBadgeList/PlatformBadgeList'
import './GameVersionCard.css'

type GameVersionCardProps = {
  game: GameVersionDefinition
  selected: boolean
  onSelect: (gameId: GameVersionDefinition['id']) => void
  onPreviewChange: (gameId: GameVersionDefinition['id'] | null) => void
}

export function GameVersionCard({ game, selected, onSelect, onPreviewChange }: GameVersionCardProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      className={`game-version-card${selected ? ' game-version-card--selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={`选择 ${game.title}`}
      onClick={() => onSelect(game.id)}
      onMouseEnter={() => onPreviewChange(game.id)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.matches(':focus-visible')) onPreviewChange(null)
      }}
      onFocus={() => onPreviewChange(game.id)}
      onBlur={() => onPreviewChange(null)}
      whileHover={reducedMotion ? undefined : { y: -5 }}
      whileTap={reducedMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <span className="game-version-card__media">
        <img className="game-version-card__poster" src={assetUrl(game.posterPath)} alt={game.posterAlt} />
        <span className="game-version-card__platform-strip">
          <PlatformBadgeList platforms={game.platforms} />
        </span>
      </span>
      <span className="game-version-card__copy">
        <span className="game-version-card__title">{game.title}</span>
        <span className="game-version-card__subtitle">{game.subtitle}</span>
      </span>
    </motion.button>
  )
}
