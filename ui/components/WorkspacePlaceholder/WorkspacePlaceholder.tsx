import { Construction } from 'lucide-react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import './WorkspacePlaceholder.css'

type WorkspacePlaceholderProps = {
  game: GameVersionDefinition
  title: string
  description: string
}

export function WorkspacePlaceholder({ game, title, description }: WorkspacePlaceholderProps) {
  return (
    <article className="workspace-placeholder" aria-label={`${game.title} ${title}`}>
      <div className="workspace-placeholder__empty">
        <span className="workspace-placeholder__icon" aria-hidden="true"><Construction size={26} /></span>
        <h1>{title}</h1>
        <p>{description}</p>
        <span className="workspace-placeholder__hint">功能开发中</span>
      </div>
    </article>
  )
}
