// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { autoLoadoutRequestSchema } from '../api/loadout/schemas'
import { createEmptyLogicalLoadout, type AutoLoadoutJobDetail, type LoadoutCalculationSnapshot } from '../api/loadout/types'
import { AutoLoadoutDrawer } from '../ui/components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { AutoLoadoutHistoryDrawer } from '../ui/components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer'
import { getAutoLoadoutDraft, saveAutoLoadoutDraft } from '../ui/stores/autoLoadoutDraftStore'

const snapshot: LoadoutCalculationSnapshot = { gameId: 'mhgu', dataVersion: 'v1', decorations: [], skills: [10, 20].map(skillId => ({ skillId, nameCn: `合成技能${skillId}`, nameEn: `Synthetic ${skillId}`, nameJp: '', activations: [{ activationKey: `synthetic:${skillId}`, skillId, threshold: 10, direction: 'positive' as const, nameCn: `合成发动${skillId}` }] })), charmClasses: [], charmRanges: [], relicLookups: [] }
const base = () => {
  const value = createEmptyLogicalLoadout('mhgu', 'v1')
  value.weapon = { kind: 'weapon', gameId: 'mhgu', candidateKey: 'weapon', sourceKind: 'catalog', weaponKey: 'weapon', templateKey: null, saveType: 7, saveId: 1, nameCn: '合成大剑', nameEn: '', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'equipment' }
  return value
}
const source = (): AutoLoadoutJobDetail => {
  const time = new Date().toISOString(); const targets = [{ activationKey: 'synthetic:10', skillId: 10, threshold: 10, nameCn: '合成发动10' }]
  return { jobId: '00000000-0000-4000-8000-000000000001', parentJobId: null, gameId: 'mhgu', dataVersion: 'old', status: 'completed', createdAt: time, startedAt: time, updatedAt: time, completedAt: time, targets, timeoutMs: 12500, progress: null, resultCount: 0, error: null, selectedFingerprint: null, viewedAt: time, request: { requestId: 'old-request', gameId: 'mhgu', dataVersion: 'old', baseLoadout: { ...base(), dataVersion: 'old' }, targets, resultLimit: 7, timeoutMs: 12500 }, results: [] }
}
const api = { listAutoLoadoutJobs: vi.fn(), getAutoLoadoutJob: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(), startAutoLoadout: vi.fn(), retryAutoLoadoutJob: vi.fn(), reconcileLoadout: vi.fn(), markAutoLoadoutJobViewed: vi.fn() }
let original: AutoLoadoutJobDetail
beforeEach(() => {
  vi.resetAllMocks(); original = source()
  saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: [], maxSeconds: 30, tab: 'conditions' })
  api.listAutoLoadoutJobs.mockResolvedValue([original]); api.getAutoLoadoutJob.mockResolvedValue(original)
  api.subscribeAutoLoadoutJobs.mockReturnValue(() => {})
  api.reconcileLoadout.mockImplementation(async value => ({ ...structuredClone(value), dataVersion: 'v1' }))
  api.startAutoLoadout.mockResolvedValue({ ...original, jobId: 'new-job' })
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: api } })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })
function Flow() {
  const [copied, setCopied] = useState(false)
  return copied ? <AutoLoadoutDrawer snapshot={snapshot} loadout={base()} calculation={calculateLoadout(snapshot, base())} onApply={vi.fn()} onClose={vi.fn()} /> : <AutoLoadoutHistoryDrawer gameId="mhgu" snapshot={snapshot} onApply={vi.fn()} onClose={vi.fn()} onCopyConditions={() => setCopied(true)} />
}
async function openHistory() {
  fireEvent.click(await screen.findByRole('button', { name: /合成发动10.*MHGU/ }))
  await screen.findByRole('dialog', { name: '自动任务详情' })
}
describe('copy historical conditions into an editable new form', () => {
  it('rehydrates and copies without enqueueing, then submits edited conditions only on explicit Start', async () => {
    const originalRequest = structuredClone(original.request)
    render(<Flow />); await openHistory()
    fireEvent.click(screen.getByRole('button', { name: '复制条件新建' }))
    await screen.findByRole('dialog', { name: '自动配装' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('tab', { name: '条件' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '12.5')
    expect(api.retryAutoLoadoutJob).not.toHaveBeenCalled(); expect(api.startAutoLoadout).not.toHaveBeenCalled()
    expect(getAutoLoadoutDraft('mhgu')).toMatchObject({ parentJobId: original.jobId, resultLimit: 7, targetKeys: ['synthetic:10'], baseLoadout: { dataVersion: 'v1' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '47.5' } })
    fireEvent.click(screen.getByRole('button', { name: '自动配装目标技能' }))
    fireEvent.click(screen.getByRole('option', { name: /合成发动20/ })); fireEvent.click(screen.getByRole('button', { name: /完成/ }))
    fireEvent.click(screen.getByRole('button', { name: '武器固定状态' })); fireEvent.click(screen.getByRole('option', { name: '固定装备和珠子' }))
    expect(api.startAutoLoadout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '开始搜索' }))
    await waitFor(() => expect(api.startAutoLoadout).toHaveBeenCalledTimes(1))
    const request = api.startAutoLoadout.mock.calls[0][0]
    expect(autoLoadoutRequestSchema.parse(request)).toMatchObject({ parentJobId: original.jobId, timeoutMs: 47500, resultLimit: 7, dataVersion: 'v1', baseLoadout: { weapon: { lock: 'equipmentAndDecorations' } } })
    expect(request.targets.map((target: { activationKey: string }) => target.activationKey)).toEqual(['synthetic:10', 'synthetic:20'])
    expect(request.requestId).not.toBe(original.request.requestId)
    expect(original.request).toEqual(originalRequest)
  })
  it('preserves the existing form when source equipment cannot be rehydrated', async () => {
    const saved = getAutoLoadoutDraft('mhgu'); api.reconcileLoadout.mockRejectedValue(new Error('合成身份无法复核'))
    render(<Flow />); await openHistory(); fireEvent.click(screen.getByRole('button', { name: '复制条件新建' }))
    expect((await screen.findByRole('alert')).textContent).toContain('合成身份无法复核')
    expect(getAutoLoadoutDraft('mhgu')).toEqual(saved)
    expect(api.startAutoLoadout).not.toHaveBeenCalled(); expect(api.retryAutoLoadoutJob).not.toHaveBeenCalled()
  })
  it('does not replace the draft when copy finishes after the history drawer unmounted', async () => {
    let finish!: (value: ReturnType<typeof base>) => void
    const pending = new Promise<ReturnType<typeof base>>(resolve => { finish = resolve })
    api.reconcileLoadout.mockReturnValue(pending); const saved = getAutoLoadoutDraft('mhgu')
    const view = render(<Flow />); await openHistory(); fireEvent.click(screen.getByRole('button', { name: '复制条件新建' })); view.unmount()
    await act(async () => { finish(base()); await pending })
    expect(getAutoLoadoutDraft('mhgu')).toEqual(saved)
    expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it('requires switching to the matching game before copying foreign history', async () => {
    api.getAutoLoadoutJob.mockResolvedValue({ ...original, gameId: 'mh4g' })
    render(<Flow />); await openHistory()
    expect(screen.getByRole('button', { name: '复制条件新建' })).toHaveProperty('disabled', true)
    expect(api.reconcileLoadout).not.toHaveBeenCalled()
  })
})
