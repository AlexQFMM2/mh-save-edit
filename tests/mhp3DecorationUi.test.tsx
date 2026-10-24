// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DecorationCatalogPage } from '../ui/pages/DecorationCatalogPage/DecorationCatalogPage'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'

let db: ReturnType<typeof p3ItemFixture>
const api = { searchDecorations: vi.fn(), getDecoration: vi.fn(), getDecorationFacets: vi.fn(), searchItems: vi.fn(), getItem: vi.fn(), getItemFacets: vi.fn(), getSkill: vi.fn() }
beforeEach(() => {
  db = p3ItemFixture()
  const items = new P3ItemCatalogRepository(db), decorations = new P3DecorationCatalogRepository(db, items)
  for (const fn of Object.values(api)) fn.mockReset()
  api.searchDecorations.mockImplementation(async p => decorations.searchDecorations(p))
  api.getDecoration.mockImplementation(async p => decorations.getDecoration(p))
  api.getDecorationFacets.mockImplementation(async () => decorations.getDecorationFacets())
  api.searchItems.mockImplementation(async p => items.searchItems(p))
  api.getItem.mockImplementation(async p => items.getItem(p))
  api.getItemFacets.mockImplementation(async () => items.getItemFacets())
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: api } })
})
afterEach(() => { cleanup(); db.close(); Reflect.deleteProperty(window, 'mhSaveEditor') })
function mount(url = '/game/mhp3/catalog/decorations?item=825') {
  function Root() { return <Outlet context={{ game: gameVersions.find(game => game.id === 'mhp3')! }} /> }
  function History() { const location = useLocation(), navigate = useNavigate(); return <><output data-testid="location">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>测试后退</button><button onClick={() => navigate(1)}>测试前进</button></> }
  render(<MemoryRouter initialEntries={[url]}><History /><Routes><Route path="/game/mhp3" element={<Root />}><Route path="catalog/decorations" element={<DecorationCatalogPage />} /><Route path="catalog/items" element={<ItemCatalogPage />} /></Route></Routes></MemoryRouter>)
}

describe('P3 independent decoration UI', () => {
  it('keeps same-name jewel labels, signed points and alternatives; selection preserves list and history', async () => {
    const user = userEvent.setup(); mount(); await screen.findByText('道具编号 #825')
    const list = screen.getByRole('list', { name: '装饰品搜索结果' }), rows = within(list).getAllByRole('button')
    expect(rows).toHaveLength(2); expect(rows[0].textContent).toContain('负技能：负向技能 -1'); expect(rows[1].textContent).toContain('测试技能 +2')
    expect(screen.getByText('配方 2')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/写入存档|存档 ID|待审校|＋1型/)
    list.scrollTop = 120; const searches = api.searchDecorations.mock.calls.length
    await user.click(rows[1]); await screen.findByText('道具编号 #826')
    expect(screen.getByRole('list', { name: '装饰品搜索结果' })).toBe(list); expect(list.scrollTop).toBe(120)
    expect(api.searchDecorations).toHaveBeenCalledTimes(searches)
    await user.click(screen.getByText('测试后退')); await screen.findByText('道具编号 #825')
    await user.click(screen.getByText('测试前进')); await screen.findByText('道具编号 #826')
  })

  it('opens a material drawer and follows a jewel back to the independent catalog without nesting', async () => {
    const user = userEvent.setup(); mount(); await screen.findByText('配方 2')
    await user.click(screen.getByRole('button', { name: /测试材料.*×2/ }))
    const dialog = await screen.findByRole('dialog', { name: '关联道具' })
    await within(dialog).findByText('道具编号 10')
    await user.click(within(dialog).getByRole('button', { name: /装饰珠用途/ }))
    await user.click(within(dialog).getByRole('button', { name: /同名珠.*测试技能 \+2/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText('道具编号 #826')
    expect(screen.getByTestId('location').textContent).toContain('/catalog/decorations?target=826')
  })

  it('opens a limited skill relationship drawer and closes it before applying the skill filter', async () => {
    const user = userEvent.setup(); mount(); await screen.findByText('道具编号 #825')
    await user.click(screen.getByRole('button', { name: '负向技能' }))
    const dialog = await screen.findByRole('dialog', { name: '关联技能' })
    await within(dialog).findByText(/发动阈值与完整效果尚未收录/)
    await within(dialog).findByRole('button', { name: /同名珠.*负技能：负向技能 -1/ })
    expect(screen.getAllByRole('dialog')).toHaveLength(1); expect(api.getSkill).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: '在装饰品图鉴筛选此技能' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(api.searchDecorations).toHaveBeenLastCalledWith(expect.objectContaining({ gameId: 'mhp3', skillId: 2, sort: 'skillPoints' })))
    expect(screen.getByTestId('location').textContent).toContain('skill=2')
  })

  it('opens decoration details from the item page, then closes before locating a material', async () => {
    const user = userEvent.setup(); mount('/game/mhp3/catalog/items?item=825'); await screen.findByText('道具编号 825')
    await user.click(screen.getByRole('button', { name: '查看装饰品详情与技能' }))
    const dialog = await screen.findByRole('dialog', { name: '关联装饰品' })
    await within(dialog).findByText('道具编号 #825')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.click(within(dialog).getByRole('button', { name: /测试材料.*×2/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText('道具编号 10')
    expect(screen.getByTestId('location').textContent).toContain('/catalog/items?target=10')
  })

  it('searches aliases, searches bilingual skill options, and retries failed facets without losing the query', async () => {
    const user = userEvent.setup(); mount(); await screen.findByText('道具编号 #825')
    fireEvent.change(screen.getByRole('textbox', { name: '搜索装饰品' }), { target: { value: '审定旧称' } })
    await waitFor(() => expect(api.searchDecorations).toHaveBeenLastCalledWith(expect.objectContaining({ query: '审定旧称' })))
    await user.click(screen.getByRole('button', { name: '按技能筛选装饰品' }))
    await user.type(screen.getByRole('combobox', { name: '按技能筛选装饰品关键词' }), 'Negative')
    await user.click(screen.getByRole('option', { name: '负向技能' }))
    await waitFor(() => expect(api.searchDecorations).toHaveBeenLastCalledWith(expect.objectContaining({ skillId: 2, query: '审定旧称' })))
    expect(api.getSkill).not.toHaveBeenCalled()
    cleanup(); api.getDecorationFacets.mockRejectedValueOnce(new Error('筛选资料暂不可用'))
    mount('/game/mhp3/catalog/decorations?q=审定旧称')
    await screen.findByText('筛选资料暂不可用')
    await user.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByRole('list', { name: '装饰品搜索结果' })
    expect(screen.getByRole('textbox', { name: '搜索装饰品' })).toHaveProperty('value', '审定旧称')
  })
})
