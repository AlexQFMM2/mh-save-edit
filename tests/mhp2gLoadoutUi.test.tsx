// @vitest-environment jsdom
// Synthetic catalog records only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { P2gArmorDetail } from '../api/catalog/p2gArmorTypes'
import { p2gLoadoutFixture } from './fixtures/p2gLoadout'
import { LoadoutBuilderPage } from '../ui/pages/LoadoutBuilderPage/LoadoutBuilderPage'
import { getLoadoutDraft, restoreLoadoutDraft, setLoadoutDraftJob } from '../ui/stores/loadoutDraftStore'
import { saveAutoLoadoutDraft } from '../ui/stores/autoLoadoutDraftStore'
import { EquipmentPickerContent } from '../ui/components/EquipmentPickerContent/EquipmentPickerContent'
import { p2gArmorCandidate } from '../api/loadout/p2gCandidates'
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useOutletContext: () => ({ game: { id: 'mhp2g' } }) }))
vi.mock('../ui/components/SaveSessionProvider/SaveSessionProvider', () => ({ useSaveSession: () => ({ session: null, notify: vi.fn() }) }))
const armor: P2gArmorDetail = { gameId: 'mhp2g', armorKey: 'armor_head:71', nativeIndex: 71, part: 'head', nameCn: '合成新头盔', nameJp: 'テスト頭', nameEn: '', nameSource: 'reviewed', nativeRowSha256: 'test', combat: 'both', gender: 'both', rarity: 1, slots: 1, baseDefense: 2, maxDefense: 8, maxBeforeFinalUnlock: 6, fireRes: -2, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, price: 50, iconPath: null, isPlaceholder: false, acquisition: '合成取得', skills: [{ skillId: 10, nameCn: '合成甲', nameEn: '', nameJp: 'テスト甲', points: 10, activeSkillNameCn: null, activeSkillNameEn: null }], recipes: [] }
const second = { ...armor, armorKey: 'armor_head:72', nativeIndex: 72, nameCn: '合成第二头盔' }
const catalog = { getArmor: vi.fn() }
const facets = { skills: p2gLoadoutFixture().snapshot.skills, weaponTypes: [], armorRarities: [1], weaponRarities: [], charmClasses: [] }
const api = { searchArmors: vi.fn(), getBootstrap: vi.fn(), getFacets: vi.fn(), reconcileLoadout: vi.fn(), listAutoLoadoutJobs: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(), controlAutoLoadout: vi.fn() }
const page = () => <MemoryRouter><LoadoutBuilderPage /></MemoryRouter>
beforeEach(() => {
  vi.resetAllMocks()
  const { loadout, snapshot } = p2gLoadoutFixture()
  restoreLoadoutDraft('mhp2g', loadout); setLoadoutDraftJob('mhp2g', undefined); saveAutoLoadoutDraft('mhp2g', { baseLoadout: loadout, targetKeys: [], maxSeconds: 30, tab: 'conditions' })
  api.getBootstrap.mockResolvedValue(snapshot)
  api.getFacets.mockResolvedValue({ skills: snapshot.skills, weaponTypes: [], armorRarities: [1], weaponRarities: [], charmClasses: [] })
  api.listAutoLoadoutJobs.mockResolvedValue([]); api.subscribeAutoLoadoutJobs.mockReturnValue(() => {})
  api.searchArmors.mockImplementation(async filters => ({ items: [armor, second].map(p2gArmorCandidate), total: 201, page: filters.page ?? 1, pageSize: 100, hasNext: true }))
  catalog.getArmor.mockImplementation(async ({ armorKey }) => [armor, second].find(a => a.armorKey === armorKey) ?? null)
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog, loadout: api } })
})
afterEach(cleanup)
describe('P2G loadout interactions', () => {
  it('previews keyboard selection, cancels without changing the draft and commits only on Apply with focus restored', async () => {
    const user = userEvent.setup(), before = structuredClone(getLoadoutDraft('mhp2g'))
    render(page()); await screen.findByRole('region', { name: '六槽装备与属性' })
    expect(document.querySelectorAll('.loadout-equipment-row')).toHaveLength(6)
    expect(screen.queryByText('护石')).toBeNull()
    const trigger = screen.getByRole('button', { name: '更换头' })
    await user.click(trigger)
    const option = await screen.findByRole('button', { name: new RegExp(armor.nameCn) })
    option.focus(); await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: armor.nameCn })
    expect(getLoadoutDraft('mhp2g')).toEqual(before)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger)
    expect(getLoadoutDraft('mhp2g')).toEqual(before)
    await user.click(trigger); await user.click(await screen.findByRole('button', { name: new RegExp(armor.nameCn) }))
    await waitFor(() => expect(screen.getByRole('button', { name: '应用选择' })).toHaveProperty('disabled', false))
    await user.click(screen.getByRole('button', { name: '应用选择' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getLoadoutDraft('mhp2g').loadout?.armor.head).toMatchObject({ armorKey: armor.armorKey, saveId: null })
    expect(getLoadoutDraft('mhp2g').undo).toHaveLength(1)
    expect(document.activeElement).toBe(trigger)
  })
  it('keeps immediate jewel edits after Escape and route remount, with each edit undoable', async () => {
    let view = render(page()); await screen.findByRole('region', { name: '六槽装备与属性' })
    fireEvent.click(screen.getByRole('button', { name: '编辑武器装饰珠' }))
    const dialog = screen.getByRole('dialog', { name: '编辑装饰珠' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '添加' })).toHaveProperty('disabled', false))
    fireEvent.click(within(dialog).getByRole('button', { name: '添加' }))
    expect(getLoadoutDraft('mhp2g').loadout?.weapon?.decorations[0]).toMatchObject({ gameId: 'mhp2g', itemId: expect.any(Number) })
    fireEvent.keyDown(document, { key: 'Escape' })
    view.unmount(); view = render(page()); await screen.findByRole('region', { name: '六槽装备与属性' })
    expect(getLoadoutDraft('mhp2g').loadout?.weapon?.decorations).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(getLoadoutDraft('mhp2g').loadout?.weapon?.decorations).toHaveLength(0)
  })
  it('uses one drawer for auto equipment subviews, offers positive targets only and does not cancel on close', async () => {
    render(page()); await screen.findByRole('region', { name: '六槽装备与属性' })
    fireEvent.click(screen.getByRole('button', { name: '自动配装' }))
    const target = screen.getByRole('button', { name: '自动配装目标技能' })
    fireEvent.click(target)
    expect(screen.getAllByRole('option').every(o => !o.textContent?.includes('-10'))).toBe(true)
    fireEvent.keyDown(target, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: '编辑搜索护石' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '编辑搜索头' }))
    await screen.findByRole('button', { name: new RegExp(armor.nameCn) })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '自动配装' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(api.controlAutoLoadout).not.toHaveBeenCalled()
  })
  it('retains draft and undo history if an imported native identity no longer exists', async () => {
    render(page()); await screen.findByRole('region', { name: '六槽装备与属性' })
    fireEvent.change(screen.getByRole('textbox', { name: '配装名称' }), { target: { value: '保留本地配装' } })
    const before = structuredClone(getLoadoutDraft('mhp2g'))
    api.reconcileLoadout.mockRejectedValue(new Error('原生武器不存在'))
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [{ text: async () => JSON.stringify(p2gLoadoutFixture().loadout) }] } })
    await screen.findByText('原生武器不存在')
    expect(getLoadoutDraft('mhp2g')).toEqual(before)
  })
  it('ignores stale details, retries failures, searches Japanese and paginates without requery on selection', async () => {
    let resolve!: (value: P2gArmorDetail) => void
    catalog.getArmor.mockImplementation(({ armorKey }) => armorKey === armor.armorKey ? new Promise<P2gArmorDetail>(done => { resolve = done }) : Promise.resolve(second))
    const select = vi.fn(), navigate = vi.fn()
    render(<EquipmentPickerContent gameId="mhp2g" slot="head" facets={facets} relicLookups={[]} decorations={[]} onSelectionChange={select} onOpenCatalog={navigate} />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(armor.nameCn) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(second.nameCn) }))
    await screen.findByRole('heading', { name: second.nameCn })
    await act(async () => resolve(armor))
    expect(select).toHaveBeenLastCalledWith(p2gArmorCandidate(second))
    expect(api.searchArmors).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(api.searchArmors).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    const input = document.querySelector('.equipment-picker-content__search-input')!
    fireEvent.change(input, { target: { value: 'テスト頭' } })
    await waitFor(() => expect(api.searchArmors).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, query: 'テスト頭' })))
    catalog.getArmor.mockRejectedValueOnce(new Error('合成读取失败'))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(armor.nameCn) }))
    await screen.findAllByRole('alert')
    catalog.getArmor.mockResolvedValue(armor)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('heading', { name: armor.nameCn })
    fireEvent.click(screen.getByRole('button', { name: /合成甲/ }))
    expect(navigate).toHaveBeenCalledWith('/game/mhp2g/catalog/skills?target=10&skill=10')
  })
})
