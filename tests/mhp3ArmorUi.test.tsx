// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { p3ArmorFixture } from './fixtures/p3ArmorCatalog'
import { P3ArmorCatalogRepository } from '../api/catalog/p3ArmorRepository'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'
import { P3SkillCatalogRepository } from '../api/catalog/p3SkillRepository'
import { ArmorCatalogPage } from '../ui/pages/ArmorCatalogPage/ArmorCatalogPage'
import { SkillCatalogPage } from '../ui/pages/SkillCatalogPage/SkillCatalogPage'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
let db: ReturnType<typeof p3ArmorFixture>, armors: P3ArmorCatalogRepository
const api = { searchArmors: vi.fn(), searchArmorSets: vi.fn(), getArmor: vi.fn(), getArmorFacets: vi.fn(), searchSkills: vi.fn(), getSkill: vi.fn(), getP3SkillArmor: vi.fn(), searchItems: vi.fn(), getItem: vi.fn(), getItemFacets: vi.fn() }
beforeEach(() => {
  db = p3ArmorFixture(); armors = new P3ArmorCatalogRepository(db)
  const items = new P3ItemCatalogRepository(db), skills = new P3SkillCatalogRepository(db, new P3DecorationCatalogRepository(db, items))
  for (const fn of Object.values(api)) fn.mockReset()
  api.searchArmors.mockImplementation(async p => armors.searchArmors(p)); api.searchArmorSets.mockImplementation(async p => armors.searchArmorSets(p))
  api.getArmor.mockImplementation(async p => armors.getArmor(p)); api.getArmorFacets.mockImplementation(async () => armors.getArmorFacets())
  api.searchSkills.mockImplementation(async p => skills.searchSkills(p)); api.getSkill.mockImplementation(async p => skills.getSkill(p.skillId))
  api.searchItems.mockImplementation(async p => items.searchItems(p)); api.getItem.mockImplementation(async p => items.getItem(p)); api.getItemFacets.mockImplementation(async () => items.getItemFacets())
  window.mhSaveEditor = { catalog: api } as unknown as Window['mhSaveEditor']
})
afterEach(() => { cleanup(); db.close(); Reflect.deleteProperty(window, 'mhSaveEditor') })
function History() { const l = useLocation(), navigate = useNavigate(); return <><output data-testid="location">{l.pathname}{l.search}</output><button onClick={() => navigate(-1)}>测试后退</button><button onClick={() => navigate(1)}>测试前进</button></> }
function mount(url = '/game/mhp3/catalog/armor') {
  render(<MemoryRouter initialEntries={[url]}><History/><Routes><Route path="/game/mhp3" element={<Outlet context={{ game: gameVersions.find(g => g.id === 'mhp3') }}/> }><Route path="catalog/armor" element={<ArmorCatalogPage/>}/><Route path="catalog/skills" element={<SkillCatalogPage/>}/><Route path="catalog/items" element={<ItemCatalogPage/>}/></Route></Routes></MemoryRouter>)
}
describe('P3 full armor catalog UI', () => {
  it('defaults to sets, keeps same-name gender variants, and selects without refetching the list', async () => {
    const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: '合成防具' })
    const buttons = screen.getAllByRole('button', { name: /合成防具/ }), list = document.querySelector('.armor-set-matrix')!
    list.scrollTop = 120; fireEvent.scroll(list); const count = api.searchArmorSets.mock.calls.length
    await user.click(buttons[1]); await waitFor(() => expect(api.getArmor).toHaveBeenLastCalledWith({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:2' }))
    await screen.findByText('胴系复制'); expect(api.searchArmorSets).toHaveBeenCalledTimes(count); expect(list.scrollTop).toBe(120)
    expect(screen.queryByText('写入存档')).toBeNull(); expect(screen.getByText('胴系复制').closest('li')?.textContent).not.toContain('+1')
    await user.click(screen.getByText('测试后退')); await waitFor(() => expect(api.getArmor).toHaveBeenLastCalledWith({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:1' }))
    await user.click(screen.getByText('测试前进')); await screen.findByText('胴系复制')
  })
  it('exposes unknown acquisition, supports direct targets outside the default scope, and keeps URL filtering', async () => {
    const user = userEvent.setup(); mount('/game/mhp3/catalog/armor?armor=mhp3:armor:4:5&target=mhp3:armor:4:5')
    await screen.findByText('取得尚未确认'); expect(screen.queryByText('0 z')).toBeNull()
    await user.click(screen.getByRole('button', { name: '筛选防具收录范围' })); await user.click(screen.getByRole('option', { name: '特殊用途' }))
    await screen.findByText('合成专用品'); expect(screen.getByTestId('location').textContent).toContain('scope=special')
    expect(screen.getByTestId('location').textContent).not.toContain('target=')
  })
  it('opens full armor from skills and closes it before locating a skill, with Escape focus restoration', async () => {
    const user = userEvent.setup(); mount('/game/mhp3/catalog/skills?skill=2')
    const trigger = (await screen.findAllByRole('button', { name: /合成防具/ }))[0]
    await user.click(trigger); let dialog = await screen.findByRole('dialog', { name: '关联防具' }); await within(dialog).findByText('基础防御')
    expect(screen.getAllByRole('dialog')).toHaveLength(1); expect(api.getP3SkillArmor).not.toHaveBeenCalled()
    await user.keyboard('{Escape}'); expect(document.activeElement).toBe(trigger)
    await user.click(trigger); dialog = await screen.findByRole('dialog'); await user.click(await within(dialog).findByRole('button', { name: '负向技能' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByTestId('location').textContent).toContain('target=2')
  })
  it('opens armor from a material and closes before locating the material again', async () => {
    const user = userEvent.setup(), m = armors.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:1' })!.recipes[0].materials[0]
    mount(`/game/mhp3/catalog/items?item=${m.itemId}`)
    await user.click(await screen.findByText(/防具用途与配方/)); await user.click(screen.getByRole('button', { name: '合成防具' }))
    const dialog = await screen.findByRole('dialog'); await user.click(await within(dialog).findByRole('button', { name: m.nameCn }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(screen.getByTestId('location').textContent).toContain(`target=${m.itemId}`)
  })
  it('upgrades old skill equipment links to the full catalog and offers the return path', async () => {
    const user = userEvent.setup(); mount('/game/mhp3/catalog/skills?skill=2&equipment=mhp3:armor:4:1')
    await screen.findByText('基础防御'); expect(screen.getByTestId('location').textContent).toContain('/catalog/armor?target=')
    await user.click(screen.getByRole('link', { name: '返回技能详情' })); await screen.findByRole('heading', { name: '负向技能' })
  })
  it('retries list and details, reports absent targets and ignores a stale detail response', async () => {
    const user = userEvent.setup(); api.searchArmorSets.mockRejectedValueOnce(new Error('防具资料尚未安装'))
    mount(); await user.click(await screen.findByRole('button', { name: '重试列表' })); await screen.findByRole('heading', { name: '合成防具' })
    let finish!: (value: unknown) => void
    api.getArmor.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const buttons = screen.getAllByRole('button', { name: /合成防具/ }); await user.click(buttons[1]); await user.click(buttons[2])
    await waitFor(() => expect(api.getArmor).toHaveBeenLastCalledWith({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:3' }))
    await act(async () => finish(armors.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:2' })))
    expect(screen.queryByText('胴系复制')).toBeNull()
    cleanup(); api.getArmor.mockRejectedValueOnce(new Error('详情暂不可用')); mount('/game/mhp3/catalog/armor?armor=mhp3:armor:4:255')
    await user.click(await screen.findByRole('button', { name: '重试详情' })); await screen.findByText('未找到对应防具资料。')
  })
})
