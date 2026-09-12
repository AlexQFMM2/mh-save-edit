import type { ReactNode } from 'react'
import './DetailStatGrid.css'

export type DetailStatItem = {
  label: string
  value: ReactNode
  className?: string
}

type DetailStatGridProps = {
  items: DetailStatItem[]
  variant?: 'two-column' | 'five-element' | 'compact' | 'wide'
  ariaLabel?: string
  className?: string
}

export function DetailStatGrid({ items, variant = 'wide', ariaLabel, className }: DetailStatGridProps) {
  return <dl className={`detail-stat-grid detail-stat-grid--${variant}${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
    {items.map((item, index) => <div className={`detail-stat-grid__item${item.className ? ` ${item.className}` : ''}`} key={`${item.label}-${index}`}>
      <dt>{item.label}</dt>
      <dd>{item.value}</dd>
    </div>)}
  </dl>
}
