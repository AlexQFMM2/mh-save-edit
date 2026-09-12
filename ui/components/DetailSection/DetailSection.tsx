import type { ReactNode } from 'react'
import './DetailSection.css'

type DetailSectionProps = {
  title: string
  meta?: ReactNode
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function DetailSection({ title, meta, children, className, ariaLabel }: DetailSectionProps) {
  return <section className={`detail-section${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
    <header className="detail-section__header">
      <h3 className="detail-section__title">{title}</h3>
      {meta && <div className="detail-section__meta">{meta}</div>}
    </header>
    <div className="detail-section__body">{children}</div>
  </section>
}
