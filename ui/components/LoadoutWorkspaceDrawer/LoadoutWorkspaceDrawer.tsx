import { ArrowLeft, X } from 'lucide-react'
import { Children, Fragment, cloneElement, isValidElement, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './LoadoutWorkspaceDrawer.css'

type Props = { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; onBack?: () => void; onEscape?: () => void; busy?: boolean }

function enhanceFooter(node: ReactNode): ReactNode {
  return Children.map(node, child => {
    if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return child
    if (child.type === 'button') return cloneElement(child, { className: `loadout-workspace-drawer__footer-action ${child.props.className ?? ''}`.trim() })
    if (child.type === Fragment) return cloneElement(child, undefined, enhanceFooter(child.props.children))
    return child
  })
}

export function LoadoutWorkspaceDrawer({ title, children, footer, onClose, onBack, onEscape, busy = false }: Props) {
  const panel = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const busyRef = useRef(busy)
  const closeRef = useRef(onClose)
  const escapeRef = useRef(onEscape ?? onClose)
  busyRef.current = busy
  closeRef.current = onClose
  escapeRef.current = onEscape ?? onClose

  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const initial = panel.current?.querySelector<HTMLElement>('.loadout-workspace-drawer__body input:not(:disabled),.loadout-workspace-drawer__body button:not(:disabled),.loadout-workspace-drawer__body [tabindex]:not([tabindex="-1"])')
    ;(initial ?? close.current)?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); escapeRef.current(); return }
      if (event.key !== 'Tab') return
      const values = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[href],[tabindex]:not([tabindex="-1"])') ?? [])]
      if (!values.length) return
      const first = values[0]
      const last = values.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); returnFocus.current?.focus() }
  }, [])

  const actions = enhanceFooter(footer)
  return createPortal(<div className="loadout-workspace-drawer">
    <button className="loadout-workspace-drawer__backdrop" type="button" aria-label={`关闭${title}`} onClick={() => !busy && onClose()} />
    <aside ref={panel} className="loadout-workspace-drawer__panel" role="dialog" aria-modal="true" aria-label={title}>
      <header className="loadout-workspace-drawer__header">{onBack && <button type="button" className="loadout-workspace-drawer__icon-button" onClick={onBack} aria-label="返回"><ArrowLeft className="loadout-workspace-drawer__icon" aria-hidden="true" /></button>}<h2 className="loadout-workspace-drawer__title">{title}</h2><button ref={close} type="button" className="loadout-workspace-drawer__icon-button loadout-workspace-drawer__close" onClick={onClose} disabled={busy} aria-label={`关闭${title}`}><X className="loadout-workspace-drawer__icon" aria-hidden="true" /></button></header>
      <div className="loadout-workspace-drawer__body">{children}</div>
      {footer && <footer className="loadout-workspace-drawer__footer">{actions}</footer>}
    </aside>
  </div>, document.body)
}
