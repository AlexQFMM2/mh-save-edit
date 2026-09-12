import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import './SaveMutationToastRegion.css'

type Toast = { id: number; text: string; tone: 'success' | 'warning' | 'error' }
export function SaveMutationToastRegion({ toast, onDismiss }: { toast: Toast | null; onDismiss(): void }) {
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(onDismiss, 5200); return () => window.clearTimeout(timer) }, [toast, onDismiss])
  if (!toast) return <div className="save-toast-region" aria-live="polite" />
  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'warning' ? AlertTriangle : XCircle
  return <div className="save-toast-region" aria-live="polite"><div className={`save-toast save-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}><Icon aria-hidden="true" /><span>{toast.text}</span><button type="button" onClick={onDismiss} aria-label="关闭提示"><X aria-hidden="true" /></button></div></div>
}
