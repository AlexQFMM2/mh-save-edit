import type { ReactNode } from 'react'
import './DetailActionBar.css'

type DetailActionBarProps = {
  children: ReactNode
  className?: string
}

export function DetailActionBar({ children, className }: DetailActionBarProps) {
  return <div className={`detail-action-bar${className ? ` ${className}` : ''}`}>{children}</div>
}
