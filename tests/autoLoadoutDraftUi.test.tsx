// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { createEmptyLogicalLoadout, type AutoLoadoutJobDetail, type AutoLoadoutJobSummary, type LoadoutCalculationSnapshot } from '../api/loadout/types'
import { AutoLoadoutDrawer } from '../ui/components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { getAutoLoadoutDraft, saveAutoLoadoutDraft } from '../ui/stores/autoLoadoutDraftStore'

const snapshot: LoadoutCalculationSnapshot = { gameId: 'mhgu', dataVersion: 'v1', decorations: [], skills: [{ skillId: 10, nameCn: '合成技能', nameEn: 'Synthetic skill', nameJp: '', activations: [{ activationKey: 'synthetic:10', skillId: 10, threshold: 10, direction: 'positive', nameCn: '合成发动' }] }], charmClasses: [], charmRanges: [], relicLookups: [] }
const base = () => {
  const value = createEmptyLogicalLoadout('mhgu', 'v1')
  value.weapon = { kind: 'weapon', gameId: 'mhgu', candidateKey: 'weapon', sourceKind: 'catalog', weaponKey: 'weapon', templateKey: null, saveType: 7, saveId: 1, nameCn: '合成大剑', nameEn: '', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'equipment' }
  return value
}
const detail = (): AutoLoadoutJobDetail => {
  const time = new Date().toISOString()
  return { jobId: 'old-job', parentJobId: null, gameId: 'mhgu', dataVersion: 'v1', status: 'running', createdAt: time, startedAt: time, updatedAt: time, completedAt: null, targets: [], timeoutMs: 9000, progress: null, resultCount: 0, error: null, selectedFingerprint: null, viewedAt: time, request: { requestId: 'request', gameId: 'mhgu', dataVersion: 'v1', baseLoadout: base(), targets: [], resultLimit: 20, timeoutMs: 9000 }, results: [] }
}
let updateJob: (summary: AutoLoadoutJobSummary) => void
const api = { listAutoLoadoutJobs: vi.fn(), getAutoLoadoutJob: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(), startAutoLoadout: vi.fn(), controlAutoLoadoutJob: vi.fn(), reconcileLoadout: vi.fn(), markAutoLoadoutJobViewed: vi.fn(), getFacets: vi.fn(), searchWeapons: vi.fn(), searchArmors: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks(); saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: [], maxSeconds: 30, tab: 'conditions' })
  api.listAutoLoadoutJobs.mockResolvedValue([]); api.getAutoLoadoutJob.mockResolvedValue(detail())
  api.subscribeAutoLoadoutJobs.mockImplementation(listener => { updateJob = listener; return () => {} })
  api.reconcileLoadout.mockImplementation(async value => value)
  api.getFacets.mockResolvedValue({ skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] })
  api.searchWeapons.mockResolvedValue({ items: [{ ...base().weapon!, candidateKey: 'new-weapon', weaponKey: 'new-weapon', nameCn: '替换大剑' }], total: 1, page: 1, pageSize: 100, hasNext: false })
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: api, catalog: { getWeapon: vi.fn().mockResolvedValue(null), getArmor: vi.fn().mockResolvedValue(null) } } })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })
const drawer = (data = snapshot) => <AutoLoadoutDrawer snapshot={data} loadout={base()} calculation={calculateLoadout(data, base())} onApply={vi.fn()} onClose={vi.fn()} />

describe('session-only search condition draft', () => {
  it('retains time, targets and fixed equipment across closing and remounting without enqueueing', async () => {
    let view = render(drawer())
    fireEvent.click(screen.getByRole('button', { name: '自动配装目标技能' }))
    fireEvent.click(screen.getByRole('option', { name: /合成发动/ }))
    fireEvent.click(screen.getByRole('button', { name: /完成/ }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '47' } })
    fireEvent.click(screen.getByRole('button', { name: '武器固定状态' }))
    fireEvent.click(screen.getByRole('option', { name: '固定装备和珠子' }))
    view.unmount(); view = render(drawer())
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '47')
    expect(screen.getByRole('button', { name: '武器固定状态' }).textContent).toContain('固定装备和珠子')
    expect(getAutoLoadoutDraft('mhgu')?.targetKeys).toEqual(['synthetic:10'])
    expect(api.startAutoLoadout).not.toHaveBeenCalled(); expect(api.controlAutoLoadoutJob).not.toHaveBeenCalled()
  })
  it('updates an old job without overwriting the edited form or changing its active tab', async () => {
    saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: ['synthetic:10'], maxSeconds: 47, tab: 'conditions', jobId: 'old-job' })
    render(drawer()); await waitFor(() => expect(api.getAutoLoadoutJob).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '51' } })
    await act(async () => { updateJob(detail()) })
    await waitFor(() => expect(api.getAutoLoadoutJob).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '51')
    expect(screen.getByRole('tab', { name: '条件' }).getAttribute('aria-selected')).toBe('true')
    expect(getAutoLoadoutDraft('mhgu')?.targetKeys).toEqual(['synthetic:10'])
    expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it('keeps a task accepted after the drawer closed without cancelling or duplicating it', async () => {
    saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: ['synthetic:10'], maxSeconds: 47, tab: 'conditions' })
    let accept!: (value: AutoLoadoutJobSummary) => void
    api.startAutoLoadout.mockImplementation(() => new Promise<AutoLoadoutJobSummary>(resolve => { accept = resolve }))
    const view = render(drawer())
    fireEvent.click(screen.getByRole('button', { name: '开始搜索' }))
    expect(api.startAutoLoadout).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => { accept(detail()) })
    await waitFor(() => expect(getAutoLoadoutDraft('mhgu')?.jobId).toBe('old-job'))
    render(drawer()); await waitFor(() => expect(api.getAutoLoadoutJob).toHaveBeenCalledWith('old-job'))
    expect(getAutoLoadoutDraft('mhgu')?.maxSeconds).toBe(47)
    expect(api.controlAutoLoadoutJob).not.toHaveBeenCalled()
    expect(api.startAutoLoadout).toHaveBeenCalledTimes(1)
  })
  it('retains stale conditions and blocks Start when rehydration fails', async () => {
    saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: ['synthetic:10'], maxSeconds: 47, tab: 'conditions' })
    api.reconcileLoadout.mockRejectedValue(new Error('无法复核合成装备'))
    render(drawer({ ...snapshot, dataVersion: 'v2' }))
    expect((await screen.findByRole('alert')).textContent).toContain('无法复核合成装备')
    expect(screen.getByRole('button', { name: '开始搜索' })).toHaveProperty('disabled', true)
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.dataVersion).toBe('v1')
    expect(getAutoLoadoutDraft('mhgu')?.maxSeconds).toBe(47)
  })
  it('edits a weapon in the sole drawer, discards Escape previews and only applies to search conditions', async () => {
    const apply = vi.fn(); const original = base()
    render(<AutoLoadoutDrawer snapshot={snapshot} loadout={original} calculation={calculateLoadout(snapshot, original)} onApply={apply} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '编辑搜索武器' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(await screen.findByRole('button', { name: /替换大剑/ }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '自动配装' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '编辑搜索武器' }))
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.weapon?.nameCn).toBe('合成大剑')
    fireEvent.click(screen.getByRole('button', { name: '编辑搜索武器' }))
    fireEvent.click(await screen.findByRole('button', { name: /替换大剑/ }))
    fireEvent.click(screen.getByRole('button', { name: '应用到搜索条件' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.weapon?.nameCn).toBe('替换大剑')
    expect(original.weapon?.nameCn).toBe('合成大剑')
    expect(apply).not.toHaveBeenCalled(); expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it('shows recoverable picker errors and can clear a slot without starting a task', async () => {
    api.getFacets.mockRejectedValueOnce(new Error('合成筛选读取失败'))
    render(drawer()); fireEvent.click(screen.getByRole('button', { name: '编辑搜索武器' }))
    expect((await screen.findByRole('alert')).textContent).toContain('合成筛选读取失败')
    expect(screen.getByRole('button', { name: '应用到搜索条件' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('button', { name: /替换大剑/ })
    fireEvent.click(screen.getByRole('button', { name: '清空此槽' }))
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.weapon).toBeNull()
    expect(screen.getByRole('button', { name: '开始搜索' })).toHaveProperty('disabled', true)
    expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it.each([['head', '头', 1], ['chest', '胸', 2], ['arms', '腕', 3], ['waist', '腰', 4], ['legs', '腿', 5]] as const)('selects %s inside the same drawer without silently fixing it', async (part, label, saveType) => {
    api.searchArmors.mockResolvedValue({ items: [{ kind: 'armor', gameId: 'mhgu', candidateKey: `armor:${part}`, sourceKind: 'catalog', dexId: 1, templateKey: null, saveType, saveId: 1, nameCn: '合成防具', nameEn: '', part, combat: 'both', gender: 'both', rarity: 1, slots: 0, baseDefense: 10, maxDefense: 20, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, iconPath: null, skills: [] }], total: 1, page: 1, pageSize: 100, hasNext: false })
    render(drawer()); fireEvent.click(screen.getByRole('button', { name: `编辑搜索${label}` }))
    fireEvent.click(await screen.findByRole('button', { name: /合成防具/ }))
    fireEvent.click(screen.getByRole('button', { name: '应用到搜索条件' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.armor[part]).toMatchObject({ part, lock: 'unlocked' })
    expect(api.searchArmors).toHaveBeenCalledWith(expect.objectContaining({ part }))
    expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it('edits a charm without another portal and distinguishes field blocking from natural uncertainty', async () => {
    const data = { ...snapshot, charmClasses: [{ classId: 1, nameCn: '合成护石', nameEn: 'Synthetic charm', maxSlots: 3 }] }
    render(drawer(data)); fireEvent.click(screen.getByRole('button', { name: '编辑搜索护石' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.change(screen.getByRole('spinbutton', { name: /孔位/ }), { target: { value: '8' } })
    expect(screen.getByRole('button', { name: '应用到搜索条件' })).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByRole('spinbutton', { name: /孔位/ }), { target: { value: '1' } })
    expect(screen.getByRole('button', { name: '应用到搜索条件' })).toHaveProperty('disabled', false)
    fireEvent.click(screen.getByRole('button', { name: '应用到搜索条件' }))
    expect(getAutoLoadoutDraft('mhgu')?.baseLoadout.charm).toMatchObject({ classId: 1, slots: 1, lock: 'unlocked', encoding: 'encodable' })
    expect(api.getFacets).not.toHaveBeenCalled(); expect(api.startAutoLoadout).not.toHaveBeenCalled()
  })
  it('does not silently discard a target removed from the current catalog', () => {
    saveAutoLoadoutDraft('mhgu', { baseLoadout: base(), targetKeys: ['removed'], maxSeconds: 47, tab: 'conditions' })
    render(drawer())
    expect(screen.getByRole('alert').textContent).toContain('部分目标技能')
    expect(screen.getByRole('button', { name: '开始搜索' })).toHaveProperty('disabled', true)
    expect(getAutoLoadoutDraft('mhgu')?.targetKeys).toEqual(['removed'])
  })
})
