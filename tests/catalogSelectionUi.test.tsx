// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { CatalogGameId, DecorationDetail, SkillDetail } from '../api/catalog/types'
import { decorationIdentity, decorationNumber } from '../api/catalog/decorationIdentity'
import { DecorationCatalogPage } from '../ui/pages/DecorationCatalogPage/DecorationCatalogPage'
import { SkillCatalogPage } from '../ui/pages/SkillCatalogPage/SkillCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import { decorationDetail } from './fixtures/p2gDecorationUi'
import { skillDetail } from './fixtures/p2gSkillUi'

afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })
const games: CatalogGameId[] = ['mhp2g', 'mh3g', 'mh4g', 'mhgu']
function Navigation() {
  const location = useLocation(), navigate = useNavigate()
  return <>
    <output data-testid="location">{location.search}</output>
    <button onClick={() => navigate(-1)}>测试后退</button>
    <button onClick={() => navigate(1)}>测试前进</button>
    <button onClick={() => navigate(location.pathname === '/decorations' ? '?item=2&tab=decoration' : '?skill=2&tab=decoration')}>测试定位第二条</button>
    <button onClick={() => navigate('?tab=decoration')}>测试仅切换页签</button>
  </>
}
function page(kind: 'decorations' | 'skills', gameId: CatalogGameId = 'mhp2g', search = '') {
  render(<MemoryRouter initialEntries={[`/${kind}${search}`]}><Routes>
    <Route element={<Outlet context={{ game: gameVersions.find(game => game.id === gameId) }} />}>
      <Route path="/decorations" element={<DecorationCatalogPage />} />
      <Route path="/skills" element={<SkillCatalogPage />} />
    </Route>
  </Routes><Navigation /></MemoryRouter>)
}
function fixtures(gameId: CatalogGameId = 'mhp2g') {
  const { gameId: _gameId, itemId: _itemId, saveId: _saveId, ...decorationFields } = decorationDetail
  const decorations: DecorationDetail[] = [1, 2].map(id => ({
    ...decorationFields, ...decorationIdentity(gameId, id), nameCn: `测试珠${id}`,
    materials: [], skills: [], p2g: gameId === 'mhp2g' ? decorationDetail.p2g : undefined,
  }))
  const skills: SkillDetail[] = [1, 2].map(id => ({
    ...skillDetail, gameId, skillId: id, nameCn: `测试技能${id}`,
    p2g: gameId === 'mhp2g' ? skillDetail.p2g : undefined,
  }))
  const api = {
    searchDecorations: vi.fn().mockResolvedValue({ items: decorations, page: 1, pageSize: 100, total: 2, hasNext: false }),
    getDecoration: vi.fn(async identity => decorations.find(item => decorationNumber(item) === decorationNumber(identity))),
    getDecorationFacets: vi.fn().mockResolvedValue({ skills: [], slots: [1, 3] }),
    searchSkills: vi.fn().mockResolvedValue({ items: skills, page: 1, pageSize: 100, total: 2, hasNext: false }),
    getSkill: vi.fn(async ({ skillId }) => skills.find(skill => skill.skillId === skillId)),
  }
  window.mhSaveEditor = { catalog: api } as unknown as Window['mhSaveEditor']
  return { api, decorations, skills }
}

describe('catalog selection does not reload search results', () => {
  it.each(games)('%s preserves the decoration scroll container during selection and history navigation', async gameId => {
    const { api } = fixtures(gameId)
    page('decorations', gameId, '?item=1')
    await screen.findByRole('heading', { name: '测试珠1' })
    expect(api.searchDecorations).toHaveBeenCalledOnce()
    const rows = screen.getByRole('list', { name: '装饰品搜索结果' })
    rows.scrollTop = 600
    fireEvent.scroll(rows)
    fireEvent.click(within(rows).getByRole('button', { name: /测试珠2/ }))
    await screen.findByRole('heading', { name: '测试珠2' })
    expect(screen.getByRole('list', { name: '装饰品搜索结果' })).toBe(rows)
    expect(rows.scrollTop).toBe(600)
    fireEvent.click(screen.getByRole('button', { name: '测试后退' }))
    await screen.findByRole('heading', { name: '测试珠1' })
    fireEvent.click(screen.getByRole('button', { name: '测试前进' }))
    await screen.findByRole('heading', { name: '测试珠2' })
    expect(screen.getByRole('list', { name: '装饰品搜索结果' })).toBe(rows)
    expect(rows.scrollTop).toBe(600)
    expect(api.searchDecorations).toHaveBeenCalledOnce()
    expect(api.getDecoration).toHaveBeenLastCalledWith(decorationIdentity(gameId, 2))
  })

  it.each(games)('%s does not query skills again when selecting a row or changing the detail tab', async gameId => {
    const { api } = fixtures(gameId)
    page('skills', gameId)
    await screen.findByRole('heading', { name: '测试技能1' })
    const rows = screen.getByRole('listbox')
    rows.scrollTop = 600
    fireEvent.click(within(rows).getByRole('option', { name: /测试技能2/ }))
    await screen.findByRole('heading', { name: '测试技能2' })
    fireEvent.click(screen.getByRole('tab', { name: /相关装饰品/ }))
    expect(screen.getByRole('tab', { name: /相关装饰品/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('listbox')).toBe(rows)
    expect(rows.scrollTop).toBe(600)
    expect(api.searchSkills).toHaveBeenCalledOnce()
    expect(api.getSkill).toHaveBeenLastCalledWith({ gameId, skillId: 2 })
  })

  it.each(['decorations', 'skills'] as const)('%s queries only once when automatically selecting the first result', async kind => {
    const { api } = fixtures()
    page(kind)
    await screen.findByRole('heading', { name: kind === 'decorations' ? '测试珠1' : '测试技能1' })
    expect(kind === 'decorations' ? api.searchDecorations : api.searchSkills).toHaveBeenCalledOnce()
  })

  it('still reloads and selects the first result after a filter or page change', async () => {
    const { api, decorations } = fixtures()
    page('decorations', 'mhp2g', '?item=2')
    await screen.findByRole('heading', { name: '测试珠2' })
    api.searchDecorations.mockResolvedValueOnce({ items: [decorations[0]], page: 1, pageSize: 1, total: 2, hasNext: true })
    fireEvent.click(screen.getByRole('button', { name: '筛选装饰品孔位' }))
    fireEvent.click(screen.getByRole('option', { name: '1 孔' }))
    await screen.findByRole('heading', { name: '测试珠1' })
    expect(api.searchDecorations).toHaveBeenCalledTimes(2)
    expect(api.searchDecorations).toHaveBeenLastCalledWith(expect.objectContaining({ slots: 1, page: 1 }))
    api.searchDecorations.mockResolvedValueOnce({ items: [decorations[1]], page: 2, pageSize: 1, total: 2, hasNext: false })
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await screen.findByRole('heading', { name: '测试珠2' })
    expect(api.searchDecorations).toHaveBeenCalledTimes(3)
    expect(api.searchDecorations).toHaveBeenLastCalledWith(expect.objectContaining({ slots: 1, page: 2 }))
  })

  it.each(['decorations', 'skills'] as const)('%s does not let a pending search override newer selection', async kind => {
    const { api, decorations, skills } = fixtures()
    let resolve!: (value: unknown) => void
    const search = kind === 'decorations' ? api.searchDecorations : api.searchSkills
    search.mockImplementation(() => new Promise(r => { resolve = r }))
    page(kind)
    fireEvent.click(screen.getByRole('button', { name: '测试定位第二条' }))
    const name = kind === 'decorations' ? '测试珠2' : '测试技能2'
    await screen.findByRole('heading', { name })
    await act(async () => resolve({ items: kind === 'decorations' ? decorations : skills, page: 1, pageSize: 100, total: 2, hasNext: false }))
    expect(screen.getByRole('heading', { name })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe(kind === 'decorations' ? '?item=2&tab=decoration' : '?skill=2&tab=decoration')
    expect(search).toHaveBeenCalledOnce()
  })

  it('auto-selects with the latest URL after changing tabs during a pending skill search', async () => {
    const { api, skills } = fixtures()
    let resolve!: (value: unknown) => void
    api.searchSkills.mockImplementation(() => new Promise(r => { resolve = r }))
    page('skills')
    fireEvent.click(screen.getByRole('button', { name: '测试仅切换页签' }))
    await act(async () => resolve({ items: skills, page: 1, pageSize: 100, total: 2, hasNext: false }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('?tab=decoration&skill=1'))
    expect(api.searchSkills).toHaveBeenCalledOnce()
  })
})
