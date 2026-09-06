import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cssAssetUrl } from '../../lib/assetUrl'
import './GuildBackdrop.css'

type GuildBackdropProps = {
  backgroundImage?: string
}

export function GuildBackdrop({ backgroundImage }: GuildBackdropProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className={`guild-backdrop${backgroundImage ? ' guild-backdrop--game-active' : ''}`} aria-hidden="true">
      <AnimatePresence initial={false}>
        {backgroundImage ? (
          <motion.span
            className="guild-backdrop__game-image"
            key={backgroundImage}
            style={{ backgroundImage: cssAssetUrl(backgroundImage) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.42, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>
      <span className="guild-backdrop__grain" />
      <span className="guild-backdrop__warm-glow guild-backdrop__warm-glow--left" />
      <span className="guild-backdrop__warm-glow guild-backdrop__warm-glow--right" />
      <span className="guild-backdrop__seal">
        <span className="guild-backdrop__seal-ring" />
        <span className="guild-backdrop__seal-mark" />
      </span>
      <span className="guild-backdrop__rail guild-backdrop__rail--top" />
      <span className="guild-backdrop__rail guild-backdrop__rail--bottom" />
    </div>
  )
}
