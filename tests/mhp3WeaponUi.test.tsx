// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { p3WeaponFixture } from './fixtures/p3WeaponCatalog'
import { P3WeaponCatalogRepository } from '../api/catalog/p3WeaponRepository'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { WeaponCatalogPage } from '../ui/pages/WeaponCatalogPage/WeaponCatalogPage'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import { weaponMatchesFilters } from '../ui/utils/weaponCatalog'
vi.mock('../ui/components/WeaponTreeCanvas/WeaponTreeCanvas',()=>({WeaponTreeCanvas:({tree,filters,onSelect}:any)=><div aria-label="合成派生画布">{tree.nodes.filter((w:any)=>weaponMatchesFilters(w,filters)).map((w:any)=><button key={w.weaponKey} onClick={()=>onSelect(w.weaponKey)}>{w.weaponKey}</button>)}</div>}))
let db:ReturnType<typeof p3WeaponFixture>, repo:P3WeaponCatalogRepository
const api={searchWeapons:vi.fn(),getWeapon:vi.fn(),getWeaponTree:vi.fn(),getWeaponFacets:vi.fn(),searchItems:vi.fn(),getItem:vi.fn(),getItemFacets:vi.fn()}
beforeEach(()=>{
  db=p3WeaponFixture();repo=new P3WeaponCatalogRepository(db);const items=new P3ItemCatalogRepository(db)
  Object.values(api).forEach(fn=>fn.mockReset())
  api.searchWeapons.mockImplementation(async f=>repo.searchWeapons(f));api.getWeapon.mockImplementation(async f=>repo.getWeapon(f));api.getWeaponTree.mockImplementation(async (_g,t)=>repo.getWeaponTree(t));api.getWeaponFacets.mockImplementation(async()=>repo.getWeaponFacets())
  api.searchItems.mockImplementation(async f=>items.searchItems(f));api.getItem.mockImplementation(async f=>items.getItem(f));api.getItemFacets.mockImplementation(async()=>items.getItemFacets())
  window.mhSaveEditor={catalog:api} as unknown as Window['mhSaveEditor']
})
afterEach(()=>{cleanup();db.close();Reflect.deleteProperty(window,'mhSaveEditor')})
function History(){const l=useLocation(),n=useNavigate();return <><output data-testid="location">{l.pathname}{l.search}</output><button onClick={()=>n(-1)}>测试后退</button><button onClick={()=>n(1)}>测试前进</button></>}
function mount(path='/game/mhp3/catalog/weapons?view=list&type=1'){
  render(<MemoryRouter initialEntries={[path]}><History/><Routes><Route path="/game/mhp3" element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp3')}}/>}><Route path="catalog/weapons" element={<WeaponCatalogPage/>}/><Route path="catalog/items" element={<ItemCatalogPage/>}/></Route></Routes></MemoryRouter>)
}
describe('P3 weapon page',()=>{
  it('keeps selection, scroll and history without reloading the list or enabling save writes',async()=>{
    const user=userEvent.setup();mount();await screen.findByRole('heading',{name:'合成武器'})
    const list=screen.getByRole('listbox');list.scrollTop=90;fireEvent.scroll(list);const count=api.searchWeapons.mock.calls.length
    await user.click(screen.getByRole('option',{name:/合成同名武器/}));await screen.findByRole('heading',{name:'合成同名武器'})
    expect(api.searchWeapons).toHaveBeenCalledTimes(count);expect(list.scrollTop).toBe(90)
    expect(screen.queryByText(/写入存档|Dex|存档顺序/)).toBeNull();expect(screen.queryByText('包含觉醒')).toBeNull()
    expect(screen.getByRole('table',{name:'基础与强化攻击对照'}).textContent).toContain('117')
    await user.click(screen.getByText('测试后退'));await screen.findByRole('heading',{name:'合成武器'})
    await user.click(screen.getByText('测试前进'));await screen.findByRole('heading',{name:'合成同名武器'})
  })
  it('opens one material drawer, restores focus, and closes it before locating a weapon',async()=>{
    const user=userEvent.setup();mount();await screen.findByRole('heading',{name:'合成武器'})
    const trigger=screen.getAllByRole('button',{name:'测试材料'})[0];await user.click(trigger)
    const dialog=await screen.findByRole('dialog');expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(trigger)
    await user.click(trigger);await screen.findByRole('dialog');await user.click(within(screen.getByRole('dialog')).getByText(/相关武器与配方/))
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button',{name:'合成武器'})[0]);await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('location').textContent).toContain('target=mhp3%3Aweapon')
    expect(dialog.isConnected).toBe(false)
  })
  it('filters scopes in the tree and selects without requerying the tree',async()=>{
    const user=userEvent.setup();mount('/game/mhp3/catalog/weapons?view=tree&type=1&scope=special')
    const tree=await screen.findByLabelText('合成派生画布');expect(within(tree).getAllByRole('button')).toHaveLength(1)
    await user.click(within(tree).getByRole('button',{name:'mhp3:weapon:5:3'}));await screen.findByRole('heading',{name:'合成武器'})
    expect(api.getWeaponTree).toHaveBeenCalledTimes(1);expect(screen.getByTestId('location').textContent).toContain('scope=special')
  })
  it('shows bowgun unavailable and skill-only ammo, separate attachments, and bow additional charges',async()=>{
    mount('/game/mhp3/catalog/weapons?view=list&type=12&weapon=mhp3:weapon:11:1')
    const table=await screen.findByRole('table',{name:'弩弹装填表'});expect(table.textContent).toContain('2（需技能）');expect(table.textContent).toContain('不可用')
    expect(screen.getByText(/长枪管与消音器互斥/)).toBeTruthy();expect(screen.getByText('3 连发 · 硬直 小')).toBeTruthy()
    cleanup();mount('/game/mhp3/catalog/weapons?view=list&type=14&weapon=mhp3:weapon:15:1')
    expect((await screen.findByRole('table',{name:'弓蓄力表'})).textContent).toContain('需装填数 UP')
    expect(screen.getByText('可用 · 强化')).toBeTruthy()
  })
  it('reports missing targets and retries transient reads while keeping the page usable',async()=>{
    api.getWeapon.mockRejectedValueOnce(new Error('合成读取失败'));mount()
    await screen.findByText('合成读取失败');fireEvent.click(screen.getByText('重新读取武器资料'));await screen.findByRole('heading',{name:'合成武器'})
    cleanup();mount('/game/mhp3/catalog/weapons?view=list&type=1&target=mhp3:weapon:5:91&weapon=mhp3:weapon:5:91')
    await screen.findByText('找不到这把武器，请检查图鉴编号。');await screen.findByText('没有符合当前条件的武器。')
  })
})
