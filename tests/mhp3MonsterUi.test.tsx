// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { syntheticMonster } from './fixtures/p3MonsterCatalog'
import { MonsterDetailPanel } from '../ui/components/MonsterDetailPanel/MonsterDetailPanel'
import { MonsterDetailDrawer } from '../ui/components/MonsterDetailDrawer/MonsterDetailDrawer'
import { MonsterDropTable } from '../ui/components/MonsterDropTable/MonsterDropTable'
import { ItemRelationSection } from '../ui/components/ItemRelationSection/ItemRelationSection'
import { MonsterCatalogPage } from '../ui/pages/MonsterCatalogPage/MonsterCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import type { MonsterDrop } from '../api/catalog/types'
const monster = syntheticMonster()
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function Location() { const l = useLocation(), n = useNavigate(); return <><output data-testid="location">{l.pathname}{l.search}</output><button onClick={() => n(-1)}>后退</button><button onClick={() => n(1)}>前进</button></> }
const props = { gameId: 'mhp3' as const, monster, loading: false, dropDirection: 'desc' as const, taskAvailability: 'all' as const, onTabChange: vi.fn(), onDropDirectionChange: vi.fn(), onTaskAvailabilityChange: vi.fn(), onSelectItem: vi.fn(), onSelectQuest: vi.fn() }
function page(url = '/game/mhp3/catalog/monsters?monster=40') {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route element={<><Outlet context={{ game: gameVersions.find(g => g.id === 'mhp3') }} /><Location /></>}><Route path="/game/mhp3/catalog/monsters" element={<MonsterCatalogPage />} /></Route></Routes></MemoryRouter>)
}
describe('P3 monster UI', () => {
  it('shows conditions and unknown values in the reverse item source', () => {
    render(<ItemRelationSection title="怪物获取" onSelectItem={vi.fn()} relations={[{
      id: 1, sourceKind: 'monster', usageKind: null, targetId: 40, targetName: '状态测试', quantity: null, probability: null, rank: 3, relatedItems: [],
      relatedMonster: { gameId: 'mhp3', monsterId: 40, nameCn: '状态测试', nameEn: '', iconPath: null },
      metadata: { '位阶／任务条件': '村★2特例', '取得方式': '背部采集', '每次数量': '未知', '尝试次数': '2 次', '条件（日文）': 'テスト条件', '来源': '合成资料' },
    }]} />)
    fireEvent.click(screen.getByRole('button', { name: /怪物获取/ }))
    expect(screen.getByText('村★2特例 · 状态测试 · 背部采集')).toBeTruthy()
    expect(screen.getByText('每次数量：未知')).toBeTruthy()
    expect(screen.getByText('尝试次数：2 次')).toBeTruthy()
    expect(screen.getByText(/概率未知/)).toBeTruthy()
  })
  it('replaces automatic selection history when scope changes', async () => {
    const search = vi.fn(({ scope }) => Promise.resolve([syntheticMonster(scope === 'extended' ? 37 : 40)]))
    vi.stubGlobal('mhSaveEditor', { catalog: { searchMonsters: search, getMonster: vi.fn(({ monsterId }) => Promise.resolve(syntheticMonster(monsterId))) } })
    page(); await screen.findByRole('heading', { name: '状态测试' })
    fireEvent.click(screen.getByRole('button', { name: '怪物目录范围' }))
    fireEvent.click(within(screen.getByRole('listbox', { name: '怪物目录范围' })).getByRole('option', { name: '扩展记录' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('monster=37'))
    fireEvent.click(screen.getByRole('button', { name: '后退' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/game/mhp3/catalog/monsters?monster=40'))
    fireEvent.click(screen.getByRole('button', { name: '前进' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('monster=37'))
  })
  it('renders unknown state values, native description, provenance, units and conditional repeated controls', () => {
    const { rerender } = render(<MonsterDetailPanel {...props} tab="weakness" />)
    expect(screen.getByText('未知')).toBeTruthy(); expect(screen.getByText('超带电状态')).toBeTruthy()
    expect(screen.getByText('合成说明')).toBeTruthy(); expect(screen.getByText('テスト説明')).toBeTruthy()
    rerender(<MonsterDetailPanel {...props} tab="ailments" />)
    expect(screen.queryByText('不适用')).toBeNull(); expect(screen.getByText('3 / 2 秒')).toBeTruthy()
    expect(screen.getByText('有条件')).toBeTruthy(); expect(screen.getByText('超带电状态无效')).toBeTruthy()
    expect(screen.getByText(/第 2 次及以后/)).toBeTruthy()
  })
  it('sorts unknown probabilities last in either direction without converting weight/count into probability/quantity', () => {
    const rows: MonsterDrop[] = [null, 27, 3].map((probability, id) => ({ id, rankId: 1, rankNameCn: '测试下位', rankNameEn: '', methodId: 1, methodNameCn: '合成剥取', methodNameEn: '', item: { gameId: 'mhp3', itemId: id+1, nameCn: `材料${id}`, nameEn: '' }, probability, quantity: null }))
    const { rerender } = render(<MonsterDropTable rows={rows} direction="desc" onDirectionChange={vi.fn()} onSelectItem={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /材料/ }).map(n => n.textContent)).toEqual(['材料1', '材料2', '材料0'])
    rerender(<MonsterDropTable rows={rows} direction="asc" onDirectionChange={vi.fn()} onSelectItem={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /材料/ }).map(n => n.textContent)).toEqual(['材料2', '材料1', '材料0'])
  })
  it('closes a monster drawer and locates the appearance without invoking a P3 task service', async () => {
    const close = vi.fn(), getQuest = vi.fn()
    vi.stubGlobal('mhSaveEditor', { catalog: { getMonster: vi.fn().mockResolvedValue(monster), getQuest } })
    render(<MemoryRouter><MonsterDetailDrawer gameId="mhp3" monsterId={40} onClose={close} /><Location /></MemoryRouter>)
    await screen.findByRole('heading', { name: '状态测试' }); fireEvent.click(screen.getByRole('tab', { name: '出没任务' }))
    fireEvent.click(screen.getByRole('button', { name: '测试出没' }))
    expect(close).toHaveBeenCalledOnce(); expect(getQuest).not.toHaveBeenCalled()
    expect(screen.getByTestId('location').textContent).toContain('/game/mhp3/catalog/monsters?target=40&monster=40&tab=quests&appearance=')
  })
  it('keeps selection independent of list fetches; previews only one drawer, restores focus, and follows history', async () => {
    const search = vi.fn().mockResolvedValue([syntheticMonster(40), syntheticMonster(8)]), getQuest = vi.fn()
    vi.stubGlobal('mhSaveEditor', { catalog: { searchMonsters: search, getMonster: vi.fn(({ monsterId }) => Promise.resolve(syntheticMonster(monsterId))), getQuest } })
    page(); await screen.findByRole('heading', { name: '状态测试' }); await screen.findByRole('button', { name: /泥层测试/ })
    const count = search.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /泥层测试/ })); await screen.findByRole('heading', { name: '泥层测试' })
    expect(search).toHaveBeenCalledTimes(count)
    fireEvent.click(screen.getByRole('button', { name: '后退' })); await screen.findByRole('heading', { name: '状态测试' })
    expect(search).toHaveBeenCalledTimes(count)
    fireEvent.click(screen.getByRole('tab', { name: '出没任务' })); const trigger = await screen.findByRole('button', { name: '测试出没' })
    trigger.focus(); fireEvent.click(trigger)
    await screen.findByRole('dialog', { name: 'P3 出没资料' }); expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger); expect(getQuest).not.toHaveBeenCalled()
    expect(search).toHaveBeenCalledTimes(count)
  })
  it('uses the shared searchable scope control and exposes retries and missing targets', async () => {
    const search = vi.fn().mockRejectedValueOnce(new Error('列表失败')).mockResolvedValue([])
    const getMonster = vi.fn().mockRejectedValueOnce(new Error('详情失败')).mockResolvedValue(null)
    vi.stubGlobal('mhSaveEditor', { catalog: { searchMonsters: search, getMonster } })
    page('/game/mhp3/catalog/monsters?monster=74&target=74')
    fireEvent.click(await screen.findByRole('button', { name: '重试列表' }))
    fireEvent.click(await screen.findByRole('button', { name: '重试详情' }))
    await screen.findByText('未找到此怪物。')
    fireEvent.click(screen.getByRole('button', { name: '怪物目录范围' }))
    const menu = screen.getByRole('listbox', { name: '怪物目录范围' })
    fireEvent.click(within(menu).getByRole('option', { name: '扩展记录' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'extended', targetMonsterId: undefined })))
  })
})
