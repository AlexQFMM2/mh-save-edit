import type { LoadoutGame, LogicalLoadout } from '../../api/loadout/types'

export type LoadoutDraftState = {
  loadout?: LogicalLoadout
  undo: LogicalLoadout[]
  autoJobId?: string
}
const drafts = new Map<LoadoutGame, LoadoutDraftState>()
const listeners = new Set<() => void>()
const clone = <T>(value: T): T => structuredClone(value)

/** Renderer-lifetime state only: never writes localStorage, save files or game databases. */
export function getLoadoutDraft(gameId: LoadoutGame): LoadoutDraftState {
  let state = drafts.get(gameId)
  if (!state) { state = { undo: [] }; drafts.set(gameId, state) }
  return state
}
export function subscribeLoadoutDraft(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function publish(gameId: LoadoutGame, state: LoadoutDraftState) {
  drafts.set(gameId, state)
  for (const listener of listeners) listener()
}
export function restoreLoadoutDraft(gameId: LoadoutGame, loadout: LogicalLoadout, undo: LogicalLoadout[] = []) {
  if (loadout.gameId !== gameId || undo.some(value => value.gameId !== gameId)) throw new Error('不能跨游戏恢复配装草稿')
  publish(gameId, { ...getLoadoutDraft(gameId), loadout: clone(loadout), undo: clone(undo).slice(-30) })
}
export function commitLoadoutDraft(gameId: LoadoutGame, recipe: (current: LogicalLoadout) => LogicalLoadout) {
  const state = getLoadoutDraft(gameId)
  if (!state.loadout) return
  const next = recipe(clone(state.loadout))
  if (next.gameId !== gameId) throw new Error('不能跨游戏修改配装草稿')
  if (JSON.stringify(next) === JSON.stringify(state.loadout)) return
  publish(gameId, { ...state, loadout: clone(next), undo: [...state.undo, clone(state.loadout)].slice(-30) })
}
export function undoLoadoutDraft(gameId: LoadoutGame): boolean {
  const state = getLoadoutDraft(gameId)
  const previous = state.undo.at(-1)
  if (!previous) return false
  publish(gameId, { ...state, loadout: clone(previous), undo: state.undo.slice(0, -1) })
  return true
}
export function setLoadoutDraftJob(gameId: LoadoutGame, autoJobId: string | undefined) {
  publish(gameId, { ...getLoadoutDraft(gameId), autoJobId })
}
