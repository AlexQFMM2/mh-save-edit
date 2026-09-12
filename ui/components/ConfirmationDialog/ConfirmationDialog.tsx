import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmationDialog.css'

type ConfirmationDialogProps = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  alternateLabel?: string
  alternateDestructive?: boolean
  onConfirm(): void
  onAlternate?: () => void
  onCancel(): void
}

export function ConfirmationDialog({ title, message, confirmLabel = '确认', destructive = false, alternateLabel, alternateDestructive = false, onConfirm, onAlternate, onCancel }: ConfirmationDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const cancelAction = useRef(onCancel)
  cancelAction.current = onCancel

  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancel.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelAction.current(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); returnFocus.current?.focus() }
  }, [])

  return createPortal(<div className="confirmation-dialog" role="presentation">
    <button type="button" className="confirmation-dialog__backdrop" onClick={onCancel} aria-label="点击遮罩取消" />
    <section ref={panel} role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
      <AlertTriangle aria-hidden="true" />
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-message">{message}</p>
      <footer>
        <button ref={cancel} type="button" onClick={onCancel}>取消</button>
        {alternateLabel && onAlternate && <button type="button" className={alternateDestructive ? 'confirmation-dialog__danger' : ''} onClick={onAlternate}>{alternateLabel}</button>}
        <button type="button" className={destructive ? 'confirmation-dialog__danger' : ''} onClick={onConfirm}>{confirmLabel}</button>
      </footer>
    </section>
  </div>, document.body)
}
