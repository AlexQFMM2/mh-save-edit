import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import './DetailDrawer.css'
type DetailDrawerProps = { title: string; children: ReactNode; onClose: () => void }
export function DetailDrawer({ title, children, onClose }: DetailDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCloseRef.current(); return }
      if (event.key !== 'Tab') return
      const candidates = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),summary,[tabindex]:not([tabindex="-1"])') ?? [])]
      const focusable = candidates.filter(element => {
        // Collapsed recipe groups contain buttons, but only their summary is
        // reachable. Include summaries without trapping focus in hidden content.
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement && !parent.open && !parent.querySelector('summary')?.contains(element)) return false
        }
        return true
      })
      if (!focusable.length) return
      const [first, last] = [focusable[0], focusable[focusable.length - 1]]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocus?.focus() }
  }, [])
  return <div className="detail-drawer"><button className="detail-drawer__backdrop" type="button" aria-label={`关闭${title}`} onClick={onClose} /><aside ref={panelRef} className="detail-drawer__panel" role="dialog" aria-modal="true" aria-label={title}><header className="detail-drawer__header"><strong>{title}</strong><button ref={closeRef} type="button" onClick={onClose} aria-label={`关闭${title}`}><X aria-hidden="true" /></button></header><div className="detail-drawer__body">{children}</div></aside></div>
}
