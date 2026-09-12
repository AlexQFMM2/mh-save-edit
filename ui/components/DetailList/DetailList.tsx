import type { ReactNode } from 'react'
import './DetailList.css'

type DetailListProps = {
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function DetailList({ children, className, ariaLabel }: DetailListProps) {
  return <div className={`detail-list${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>{children}</div>
}
