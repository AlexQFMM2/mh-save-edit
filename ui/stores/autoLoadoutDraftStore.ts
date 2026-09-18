import type { LoadoutGame, LogicalLoadout } from '../../api/loadout/types'

export type AutoLoadoutDraft = {
  baseLoadout: LogicalLoadout
  targetKeys: string[]
  maxSeconds: number
  resultLimit?: number
  parentJobId?: string
  tab: 'conditions' | 'results'
  jobId?: string
}
const drafts = new Map<LoadoutGame, AutoLoadoutDraft>()
/** Search-form state is separate from persistent main-process job records. */
export function getAutoLoadoutDraft(gameId: LoadoutGame): AutoLoadoutDraft | undefined {
  const value = drafts.get(gameId)
  return value ? structuredClone(value) : undefined
}
export function saveAutoLoadoutDraft(gameId: LoadoutGame, value: AutoLoadoutDraft) {
  if (value.baseLoadout.gameId !== gameId) throw new Error('不能跨游戏保存搜索条件')
  drafts.set(gameId, structuredClone(value))
}
