import { ArrowLeft, X } from 'lucide-react'
import { Children, Fragment, cloneElement, isValidElement, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './WorkspaceDrawer.css'

export type WorkspaceDrawerProps = { title: string; children: ReactNode; footer?: ReactNode; busy?: boolean; className?: string; onBack?: () => void; onClose(): void; onEscape?: () => void }

function footerActions(node: ReactNode): ReactNode {
  return Children.map(node, child => {
    if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return child
    if (child.type === 'button') return cloneElement(child, { className: `workspace-drawer__footer-action ${child.props.className ?? ''}`.trim() })
    if (child.type === Fragment) return cloneElement(child, undefined, footerActions(child.props.children))
    return child
  })
}

export function WorkspaceDrawer({ title, children, footer, busy = false, className, onBack, onClose, onEscape }: WorkspaceDrawerProps) {
  const panel = useRef<HTMLElement>(null); const closeButton = useRef<HTMLButtonElement>(null); const returnFocus = useRef<HTMLElement | null>(null)
  const values = useRef({ busy, onClose, onEscape: onEscape ?? onClose }); values.current = { busy, onClose, onEscape: onEscape ?? onClose }
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const initial = panel.current?.querySelector<HTMLElement>('.workspace-drawer__body input:not(:disabled),.workspace-drawer__body select:not(:disabled),.workspace-drawer__body button:not(:disabled),.workspace-drawer__body [tabindex]:not([tabindex="-1"])'); (initial ?? closeButton.current)?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && !values.current.busy) { event.preventDefault(); values.current.onEscape(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[href],[tabindex]:not([tabindex="-1"])') ?? [])]
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keyboard); returnFocus.current?.focus() }
  }, [])
  return createPortal(<div className={`workspace-drawer${className ? ` ${className}` : ''}`}>
    <button type="button" className="workspace-drawer__backdrop" aria-label={`关闭${title}`} onClick={() => !busy && onClose()} />
    <aside ref={panel} className="workspace-drawer__panel" role="dialog" aria-modal="true" aria-label={title}>
      <header className="workspace-drawer__header">{onBack && <button type="button" className="workspace-drawer__icon-button" onClick={onBack} aria-label="返回"><ArrowLeft aria-hidden="true" /></button>}<h2>{title}</h2><button ref={closeButton} type="button" className="workspace-drawer__icon-button workspace-drawer__close" onClick={onClose} disabled={busy} aria-label={`关闭${title}`}><X aria-hidden="true" /></button></header>
      <div className="workspace-drawer__body">{children}</div>
      {footer && <footer className="workspace-drawer__footer">{footerActions(footer)}</footer>}
    </aside>
  </div>, document.body)
}
