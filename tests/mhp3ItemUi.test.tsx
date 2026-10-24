// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
let db: ReturnType<typeof p3ItemFixture>
const api={searchItems:vi.fn(),getItem:vi.fn(),getItemFacets:vi.fn()}
beforeEach(()=>{
  db=p3ItemFixture();const repo=new P3ItemCatalogRepository(db)
  api.searchItems.mockReset().mockImplementation(async p=>repo.searchItems(p))
  api.getItem.mockReset().mockImplementation(async p=>repo.getItem(p))
  api.getItemFacets.mockReset().mockImplementation(async()=>repo.getItemFacets())
  Object.defineProperty(window,'mhSaveEditor',{configurable:true,value:{catalog:api}})
})
afterEach(()=>{cleanup();db?.close();Reflect.deleteProperty(window,'mhSaveEditor')})
function mount(url='/game/mhp3/catalog/items?item=825') {
  function Root(){return <Outlet context={{game:gameVersions.find(g=>g.id==='mhp3')!}}/>}
  function Navigation(){const navigate=useNavigate();return <><output data-testid="location">{useLocation().pathname+useLocation().search}</output><button onClick={()=>navigate(-1)}>测试后退</button><button onClick={()=>navigate(1)}>测试前进</button></>}
  render(<MemoryRouter initialEntries={[url]}><Navigation/><Routes><Route path="/game/mhp3" element={<Root/>}><Route path="catalog/items" element={<ItemCatalogPage/>}/><Route path="catalog/decorations" element={<p>装饰品图鉴目标</p>}/></Route></Routes></MemoryRouter>)
}
describe('P3 shared item UI',()=>{
  it('renders distinct signed skill labels for duplicate names, translated text, native IDs and no save action',async()=>{
    mount();await screen.findByText('道具编号 825')
    const list=screen.getByRole('list',{name:'道具列表'})
    const rows=within(list).getAllByRole('button',{name:/同名珠/})
    expect(rows).toHaveLength(2);expect(rows[0].textContent).toContain('测试技能 +1');expect(rows[0].textContent).toContain('负技能：负向技能 -1');expect(rows[1].textContent).toContain('测试技能 +2')
    expect(screen.getByText('测试原文的译文')).toBeTruthy();expect(screen.getByText('查看日文说明')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/待审校|待验收|写入存档|存档 ID|＋1型/)
    expect(screen.getByText('路线 2')).toBeTruthy()
    expect(api.getItem).toHaveBeenCalledWith({gameId:'mhp3',itemId:825})
  })
  it('opens only one item drawer and closes it before locating a linked jewel',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('路线 2')
    await user.click(screen.getByRole('button',{name:/测试材料\s*× 2/}))
    const dialog=await screen.findByRole('dialog',{name:'关联道具'});await within(dialog).findByText('道具编号 10')
    await user.click(within(dialog).getByRole('button',{name:/装饰珠用途/}))
    const link=within(dialog).getByRole('button',{name:/同名珠.*测试技能 \+2/})
    await user.click(link)
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText('装饰品图鉴目标');expect(screen.getByTestId('location').textContent).toContain('/catalog/decorations?target=826')
  })
  it('selecting another item preserves the list DOM and does not query again; history restores the selection',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('道具编号 825')
    const list=screen.getByRole('list',{name:'道具列表'});list.scrollTop=123
    const before=api.searchItems.mock.calls.length
    await user.click(within(list).getAllByRole('button',{name:/同名珠/})[1]);await screen.findByText('道具编号 826')
    expect(screen.getByRole('list',{name:'道具列表'})).toBe(list);expect(list.scrollTop).toBe(123);expect(api.searchItems).toHaveBeenCalledTimes(before)
    await user.click(screen.getByText('测试后退'));await screen.findByText('道具编号 825')
    await user.click(screen.getByText('测试前进'));await screen.findByText('道具编号 826')
  })
  it('supports bilingual search, compact dropdowns, unknown coverage and retry after failure',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('道具编号 825')
    expect(screen.getByRole('button',{name:'筛选道具大类'})).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox',{name:'搜索道具'}),{target:{value:'テスト無限'}})
    await waitFor(()=>expect(api.searchItems).toHaveBeenLastCalledWith(expect.objectContaining({query:'テスト無限'})))
    await screen.findByText('道具编号 94');expect(screen.getAllByText('无限弹量').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('255')
    api.searchItems.mockRejectedValueOnce(new Error('测试资料失败'))
    fireEvent.change(screen.getByRole('textbox',{name:'搜索道具'}),{target:{value:'无结果'}})
    await screen.findByText('测试资料失败');await user.click(screen.getByRole('button',{name:'重试'}))
    await screen.findByText('没有符合当前条件的道具。')
  })
})
