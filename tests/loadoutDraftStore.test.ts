import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyLogicalLoadout } from '../api/loadout/types'
import { commitLoadoutDraft, getLoadoutDraft, restoreLoadoutDraft, setLoadoutDraftJob, subscribeLoadoutDraft, undoLoadoutDraft } from '../ui/stores/loadoutDraftStore'

beforeEach(() => { for (const game of ['mh3g', 'mh4g', 'mhgu'] as const) { restoreLoadoutDraft(game, createEmptyLogicalLoadout(game, 'v1')); setLoadoutDraftJob(game, undefined) } })
describe('renderer-session loadout drafts', () => {
  it('isolates games and preserves a stable snapshot until a real change', () => {
    const before = getLoadoutDraft('mhgu'); const listener = vi.fn(); const unsubscribe = subscribeLoadoutDraft(listener)
    commitLoadoutDraft('mhgu', value => value)
    expect(getLoadoutDraft('mhgu')).toBe(before); expect(listener).not.toHaveBeenCalled()
    commitLoadoutDraft('mhgu', value => ({ ...value, name: 'GU draft' })); setLoadoutDraftJob('mhgu', 'job-gu')
    expect(getLoadoutDraft('mhgu')).toMatchObject({ loadout: { name: 'GU draft' }, autoJobId: 'job-gu' })
    expect(getLoadoutDraft('mh4g').loadout?.name).toBe('未命名配装')
    expect(getLoadoutDraft('mh4g').autoJobId).toBeUndefined()
    unsubscribe()
  })
  it('clones inputs and caps every commit at thirty undo steps', () => {
    const source = createEmptyLogicalLoadout('mhgu', 'v1'); restoreLoadoutDraft('mhgu', source); source.name = 'external mutation'
    expect(getLoadoutDraft('mhgu').loadout?.name).toBe('未命名配装')
    for (let i = 0; i < 40; i++) commitLoadoutDraft('mhgu', value => ({ ...value, name: String(i) }))
    expect(getLoadoutDraft('mhgu').undo).toHaveLength(30)
    for (let i = 0; i < 30; i++) expect(undoLoadoutDraft('mhgu')).toBe(true)
    expect(getLoadoutDraft('mhgu').loadout?.name).toBe('9')
    expect(undoLoadoutDraft('mhgu')).toBe(false)
  })
  it('rejects cross-game state without destroying the previous draft', () => {
    const before = getLoadoutDraft('mhgu')
    expect(() => restoreLoadoutDraft('mhgu', createEmptyLogicalLoadout('mh4g'))).toThrow(/跨游戏/)
    expect(() => commitLoadoutDraft('mhgu', () => createEmptyLogicalLoadout('mh3g'))).toThrow(/跨游戏/)
    expect(getLoadoutDraft('mhgu')).toBe(before)
  })
})
