import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SaveCharacterSummary, SaveCommand, SaveCommandDraft, SaveMutationResult, SaveOpenRequest, SaveResult, SaveSectionRequest, SaveSectionSnapshot, SaveSessionSnapshot } from '../../../api/save/types'
import { ConfirmationDialog } from '../ConfirmationDialog/ConfirmationDialog'
import { SaveMutationToastRegion } from '../SaveMutationToastRegion/SaveMutationToastRegion'

type ContextValue = {
  session: SaveSessionSnapshot | null
  characters: SaveCharacterSummary[]
  busy: boolean
  error: string | null
  navigationBlockReason: string | null
  setNavigationBlockReason(reason: string | null): void
  open(request: SaveOpenRequest): Promise<void>
  refreshCharacters(): Promise<SaveCharacterSummary[]>
  selectCharacter(slot: number): Promise<void>
  getSection(request: Omit<SaveSectionRequest, 'sessionId' | 'revision'>): Promise<SaveSectionSnapshot>
  apply(command: SaveCommandDraft): Promise<SaveMutationResult>
  undo(): Promise<void>
  redo(): Promise<void>
  save(): Promise<SaveResult | null>
  saveAndClose(): Promise<void>
  close(discard?: boolean): Promise<void>
  notify(message: string, tone?: 'success' | 'warning' | 'error'): void
}

const SaveSessionContext = createContext<ContextValue | null>(null)
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause || '操作失败')
const gameFromHash = (hash: string) => /^#\/game\/(mh3g|mh4g|mhgu)(?:\/|$)/.exec(hash)?.[1] ?? null

export function SaveSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SaveSessionSnapshot | null>(null); const [characters, setCharacters] = useState<SaveCharacterSummary[]>([])
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [toast, setToast] = useState<{ id: number; text: string; tone: 'success' | 'warning' | 'error' } | null>(null)
  const [navigationBlockReason, setNavigationBlockReason] = useState<string | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const acceptedHash = useRef(window.location.hash || '#/')
  const bypassHash = useRef<string | null>(null)
  const sessionRef = useRef<SaveSessionSnapshot | null>(null)
  sessionRef.current = session
  const notify = useCallback((text: string, tone: 'success' | 'warning' | 'error' = 'success') => setToast({ id: Date.now(), text, tone }), [])
  useEffect(() => {
    const api = window.mhSaveEditor?.save
    if (!api) { setError('存档服务未连接，请在桌面应用中打开。'); return }
    let live = true; void api.getSession().then(value => { if (live) setSession(value) }).catch(cause => { if (live) setError(message(cause)) })
    const unsubscribe = api.subscribe(value => { if (live) setSession(value) })
    return () => { live = false; unsubscribe() }
  }, [])
  useEffect(() => {
    const blockTarget = (targetHash: string) => {
      if (navigationBlockReason) {
        notify(navigationBlockReason, 'warning')
        return true
      }
      const currentSession = sessionRef.current
      if (!currentSession || gameFromHash(targetHash) === currentSession.contentGameId) return false
      setPendingNavigation(targetHash)
      return true
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.hash || anchor.hash === acceptedHash.current || !blockTarget(anchor.hash)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const onHashChange = () => {
      const targetHash = window.location.hash || '#/'
      if (bypassHash.current === targetHash) {
        bypassHash.current = null
        acceptedHash.current = targetHash
        return
      }
      if (targetHash === acceptedHash.current) return
      if (!blockTarget(targetHash)) {
        acceptedHash.current = targetHash
        return
      }
      bypassHash.current = acceptedHash.current
      window.location.replace(acceptedHash.current || '#/')
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('hashchange', onHashChange)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('hashchange', onHashChange) }
  }, [navigationBlockReason, notify, session?.contentGameId, session?.sessionId])
  useEffect(() => {
    if (!session) return
    const currentHash = window.location.hash || '#/'
    if (gameFromHash(currentHash) === session.contentGameId) {
      acceptedHash.current = currentHash
      return
    }
    const safeHash = `#/game/${session.contentGameId}/overview`
    setPendingNavigation(currentHash)
    acceptedHash.current = safeHash
    bypassHash.current = safeHash
    window.location.replace(safeHash)
  }, [session?.sessionId])
  useEffect(() => { if (session?.state !== 'selectingCharacter') return; let live = true; void window.mhSaveEditor.save.listCharacters(session.sessionId, session.revision).then(value => { if (live) setCharacters(value) }).catch(cause => { if (live) setError(message(cause)) }); return () => { live = false } }, [session?.sessionId, session?.revision, session?.state])
  const perform = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => { setBusy(true); setError(null); try { return await operation() } catch (cause) { const text = message(cause); setError(text); notify(text, 'error'); throw cause } finally { setBusy(false) } }, [notify])
  const open = useCallback((request: SaveOpenRequest) => perform(async () => { const result = await window.mhSaveEditor.save.open(request); if (!result.cancelled) { setSession(result.session); setCharacters(result.characters) } }), [perform])
  const refreshCharacters = useCallback(() => perform(async () => {
    if (!session) throw new Error('存档会话不存在')
    const values = await window.mhSaveEditor.save.listCharacters(session.sessionId, session.revision)
    setCharacters(values)
    return values
  }), [perform, session])
  const selectCharacter = useCallback((slot: number) => perform(async () => { if (!session) throw new Error('存档会话不存在'); setSession(await window.mhSaveEditor.save.selectCharacter(session.sessionId, session.revision, slot)); setCharacters([]) }), [perform, session])
  const getSection = useCallback((request: Omit<SaveSectionRequest, 'sessionId' | 'revision'>) => { if (!session) return Promise.reject(new Error('存档会话不存在')); return window.mhSaveEditor.save.getSection({ ...request, sessionId: session.sessionId, revision: session.revision }) }, [session])
  const apply = useCallback((command: SaveCommandDraft) => perform(async () => { if (!session) throw new Error('存档会话不存在'); const result = await window.mhSaveEditor.save.applyCommand({ ...command, sessionId: session.sessionId, revision: session.revision } as SaveCommand); setSession(result.session); notify(result.message); return result }), [notify, perform, session])
  const undo = useCallback(() => perform(async () => { if (!session) return; const result = await window.mhSaveEditor.save.undo(session.sessionId, session.revision); setSession(result.session); notify(result.message) }), [notify, perform, session])
  const redo = useCallback(() => perform(async () => { if (!session) return; const result = await window.mhSaveEditor.save.redo(session.sessionId, session.revision); setSession(result.session); notify(result.message) }), [notify, perform, session])
  const save = useCallback(() => perform(async () => { if (!session) return null; const result = await window.mhSaveEditor.save.saveCurrent(session.sessionId, session.revision); if (!result.cancelled) { setSession(result.session); notify(result.message) }; return result }), [notify, perform, session])
  const saveAndClose = useCallback(() => perform(async () => {
    const current = sessionRef.current
    if (!current) return
    const result = await window.mhSaveEditor.save.saveCurrent(current.sessionId, current.revision)
    if (result.cancelled) return
    await window.mhSaveEditor.save.close(result.session.sessionId, result.session.revision, false)
    setSession(null)
    setCharacters([])
    setNavigationBlockReason(null)
    notify('存档已保存，会话已关闭', 'success')
  }), [notify, perform])
  const close = useCallback((discard = false) => perform(async () => { if (!session) return; await window.mhSaveEditor.save.close(session.sessionId, session.revision, discard); setSession(null); setCharacters([]); notify('存档会话已关闭', 'warning') }), [notify, perform, session])
  const continueNavigation = useCallback((targetHash: string) => {
    setPendingNavigation(null)
    acceptedHash.current = targetHash
    bypassHash.current = targetHash
    window.location.hash = targetHash
  }, [])
  const leaveForNavigation = useCallback((mode: 'save' | 'discard' | 'close') => perform(async () => {
    const current = sessionRef.current
    const targetHash = pendingNavigation
    if (!current || !targetHash) return
    let identity = current
    if (mode === 'save') {
      const result = await window.mhSaveEditor.save.saveCurrent(current.sessionId, current.revision)
      if (result.cancelled) return
      identity = result.session
    }
    await window.mhSaveEditor.save.close(identity.sessionId, identity.revision, mode === 'discard')
    setSession(null)
    setCharacters([])
    setNavigationBlockReason(null)
    continueNavigation(targetHash)
  }), [continueNavigation, pendingNavigation, perform])
  const value = useMemo<ContextValue>(() => ({ session, characters, busy, error, navigationBlockReason, setNavigationBlockReason, open, refreshCharacters, selectCharacter, getSection, apply, undo, redo, save, saveAndClose, close, notify }), [session, characters, busy, error, navigationBlockReason, open, refreshCharacters, selectCharacter, getSection, apply, undo, redo, save, saveAndClose, close, notify])
  return <SaveSessionContext.Provider value={value}>
    {children}
    {pendingNavigation && session && <ConfirmationDialog
      title="离开当前游戏版本？"
      message={`已读取 ${session.contentGameId.toUpperCase()} 存档${session.dirty ? '，并且存在未保存修改' : ''}。离开当前版本会关闭这次存档会话。`}
      confirmLabel={session.dirty ? '保存并继续' : '关闭并继续'}
      alternateLabel={session.dirty ? '放弃修改并继续' : undefined}
      alternateDestructive
      onConfirm={() => void leaveForNavigation(session.dirty ? 'save' : 'close')}
      onAlternate={session.dirty ? () => void leaveForNavigation('discard') : undefined}
      onCancel={() => setPendingNavigation(null)}
    />}
    <SaveMutationToastRegion toast={toast} onDismiss={() => setToast(null)} />
  </SaveSessionContext.Provider>
}

export function useSaveSession() { const value = useContext(SaveSessionContext); if (!value) throw new Error('SaveSessionProvider is missing'); return value }
export function useOptionalSaveSession() { return useContext(SaveSessionContext) }
