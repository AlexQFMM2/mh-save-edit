// @vitest-environment jsdom
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyLogicalLoadout, type LoadoutCalculationSnapshot, type LoadoutGame, type LogicalLoadout } from '../api/loadout/types'
import { LoadoutBuilderPage } from '../ui/pages/LoadoutBuilderPage/LoadoutBuilderPage'
import { commitLoadoutDraft, getLoadoutDraft, restoreLoadoutDraft, setLoadoutDraftJob } from '../ui/stores/loadoutDraftStore'

const context = vi.hoisted(() => ({ game: { id: 'mhgu' as LoadoutGame } }))
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useOutletContext: () => context }))
vi.mock('../ui/components/SaveSessionProvider/SaveSessionProvider', () => ({ useSaveSession: () => ({ session: null, notify: vi.fn() }) }))
let version = 'v1'
const snapshot = (gameId: LoadoutGame): LoadoutCalculationSnapshot => ({ gameId, dataVersion: version, decorations: [{ saveId: 1, nameCn: '合成测试珠', slots: 1, skills: [{ skillId: 1, nameCn: '合成技能', points: 1 }] }], skills: [{ skillId: 1, nameCn: '合成技能', nameEn: 'Synthetic skill', nameJp: '', activations: [{ activationKey: 'synthetic:1', skillId: 1, nameCn: '合成发动', direction: 'positive', threshold: 1 }] }], charmClasses: [{ classId: 1, nameCn: '合成护石', nameEn: '', maxSlots: 3 }], charmRanges: [], relicLookups: [] })
const api = {
  getBootstrap: vi.fn(), getFacets: vi.fn(), reconcileLoadout: vi.fn(), listAutoLoadoutJobs: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(),
}
const page = () => <StrictMode><MemoryRouter><LoadoutBuilderPage /></MemoryRouter></StrictMode>
const nameInput = () => screen.findByRole('textbox', { name: '配装名称' }) as Promise<HTMLInputElement>
beforeEach(() => {
  version = 'v1'; context.game.id = 'mhgu'; vi.clearAllMocks()
  for (const game of ['mh3g', 'mh4g', 'mhgu'] as const) { restoreLoadoutDraft(game, createEmptyLogicalLoadout(game, version)); setLoadoutDraftJob(game, undefined) }
  api.getBootstrap.mockImplementation(async (gameId: LoadoutGame) => snapshot(gameId))
  api.getFacets.mockResolvedValue({ skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] })
  api.reconcileLoadout.mockImplementation(async (value: LogicalLoadout) => ({ ...value, dataVersion: version }))
  api.listAutoLoadoutJobs.mockResolvedValue([]); api.subscribeAutoLoadoutJobs.mockReturnValue(() => {})
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: api } })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })

describe('loadout navigation and immediate decorations', () => {
  it('keeps the draft and a single undo step across StrictMode unmount/remount', async () => {
    let view = render(page()); fireEvent.change(await nameInput(), { target: { value: '保留的配装' } })
    expect(getLoadoutDraft('mhgu').undo).toHaveLength(1)
    view.unmount(); view = render(page())
    expect((await nameInput()).value).toBe('保留的配装')
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect((await nameInput()).value).toBe('未命名配装')
    expect(getLoadoutDraft('mhgu').undo).toHaveLength(0)
  })
  it('restores independent drafts after switching games without applying an old bootstrap', async () => {
    const view = render(page()); fireEvent.change(await nameInput(), { target: { value: 'GU 配装' } })
    context.game.id = 'mh4g'; view.rerender(page())
    await waitFor(() => expect(screen.getByRole('textbox', { name: '配装名称' })).toHaveProperty('value', '未命名配装'))
    fireEvent.change(await nameInput(), { target: { value: '4G 配装' } })
    context.game.id = 'mhgu'; view.rerender(page())
    await waitFor(() => expect(screen.getByRole('textbox', { name: '配装名称' })).toHaveProperty('value', 'GU 配装'))
    expect(getLoadoutDraft('mh4g').loadout?.name).toBe('4G 配装')
  })
  it('rehydrates current and undo snapshots on data changes and retains them on failure', async () => {
    commitLoadoutDraft('mhgu', value => ({ ...value, name: '待迁移' }))
    version = 'v2'; let view = render(page()); expect((await nameInput()).value).toBe('待迁移')
    expect(getLoadoutDraft('mhgu').loadout?.dataVersion).toBe('v2')
    expect(getLoadoutDraft('mhgu').undo.every(value => value.dataVersion === 'v2')).toBe(true)
    view.unmount(); version = 'v3'; api.reconcileLoadout.mockRejectedValue(new Error('合成迁移失败'))
    view = render(page()); expect((await screen.findByRole('alert')).textContent).toContain('合成迁移失败')
    expect(getLoadoutDraft('mhgu').loadout).toMatchObject({ dataVersion: 'v2', name: '待迁移' })
    expect(getLoadoutDraft('mhgu').undo).toHaveLength(1)
    view.unmount(); api.reconcileLoadout.mockImplementation(async value => ({ ...value, dataVersion: 'unexpected-version' }))
    view = render(page()); expect((await screen.findByRole('alert')).textContent).toContain('资料版本再次变化')
    expect(getLoadoutDraft('mhgu').loadout?.dataVersion).toBe('v2')
  })
  it('ignores a late bootstrap after the active game changed', async () => {
    let finish!: (value: LoadoutCalculationSnapshot) => void
    const pending = new Promise<LoadoutCalculationSnapshot>(resolve => { finish = resolve })
    api.getBootstrap.mockImplementation((gameId: LoadoutGame) => gameId === 'mhgu' ? pending : Promise.resolve(snapshot(gameId)))
    const view = render(page()); context.game.id = 'mh4g'; view.rerender(page()); await nameInput()
    fireEvent.change(await nameInput(), { target: { value: '当前4G' } })
    await act(async () => { finish(snapshot('mhgu')); await pending })
    expect((await nameInput()).value).toBe('当前4G')
    expect(getLoadoutDraft('mhgu').loadout?.name).toBe('未命名配装')
  })
  it('adds/removes immediately, keeps risky slots, undoes each change and retains edits on Escape', async () => {
    const loadout = createEmptyLogicalLoadout('mhgu', version)
    loadout.charm = { kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '合成护石', slots: 1, skill1: null, skill2: null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked' }
    restoreLoadoutDraft('mhgu', loadout)
    let view = render(page()); await nameInput()
    fireEvent.click(screen.getByRole('button', { name: '编辑护石装饰珠' }))
    const dialog = screen.getByRole('dialog', { name: '编辑装饰珠' })
    expect(within(dialog).queryByRole('button', { name: /应用|取消/ })).toBeNull()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '添加' })).toHaveProperty('disabled', false))
    fireEvent.click(within(dialog).getByRole('button', { name: '添加' }))
    expect(getLoadoutDraft('mhgu').loadout?.charm?.decorations).toHaveLength(1)
    expect(screen.getByText('1 · 合成发动')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '添加' }))
    expect(within(dialog).getByText(/超出 1 孔/)).toBeTruthy()
    fireEvent.click(within(dialog).getAllByRole('button', { name: '移除' })[0])
    expect(getLoadoutDraft('mhgu').loadout?.charm?.decorations).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('button', { name: '撤销上一步' }))
    expect(getLoadoutDraft('mhgu').loadout?.charm?.decorations).toHaveLength(2)
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull()
    view.unmount(); view = render(page()); await nameInput()
    expect(getLoadoutDraft('mhgu').loadout?.charm?.decorations).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(getLoadoutDraft('mhgu').loadout?.charm?.decorations).toHaveLength(1)
  })
})
