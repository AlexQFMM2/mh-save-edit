// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { WorkspaceFeaturePage } from '../ui/pages/WorkspaceFeaturePage/WorkspaceFeaturePage'
import { gameVersions } from '../ui/data/gameVersions'
import type { CatalogItemDetail } from '../api/catalog/types'
import { itemIdentitySchema } from '../api/catalog/schemas'
const relation = { id:1, sourceKind:'combination' as const,usageKind:null,targetId:null,targetName:'测试材料',quantity:null,probability:75,rank:null,metadata:{evidence:'Wiki',details:'产量 1–3'},relatedItems:[{gameId:'mhp2g' as const,itemId:2,nameCn:'材料',nameEn:''}] }
const detail:CatalogItemDetail={gameId:'mhp2g',itemId:1,dexId:null,nameCn:'测试成品',nameEn:'',nameJp:'テスト品',rarity:null,maxStack:10,iconPath:null,isPlaceholder:false,description:'原生说明',buyPrice:100,sellPrice:10,hexId:null,mappingStatus:'native',relations:[relation,{...relation,id:2,sourceKind:'weapon',usageKind:'weapon',targetName:'测试武器',relatedItems:[],probability:null,pendingTarget:{kind:'weapon',name:'测试武器'}}]}
const api={searchItems:vi.fn(),getItem:vi.fn(),getItemFacets:vi.fn()}
beforeEach(()=>{
  api.searchItems.mockReset().mockResolvedValue({items:[detail],total:201,pageSize:100,page:1,hasNext:true})
  api.getItem.mockReset().mockImplementation(async(identity)=>{
    itemIdentitySchema.parse(identity)
    return {...detail,itemId:identity.itemId,nameCn:identity.itemId===2?'材料':'测试成品'}
  })
  api.getItemFacets.mockReset().mockResolvedValue({rarities:[],maxStacks:[10],relations:[{sourceKind:'combination',usageKind:null}]})
  Object.defineProperty(window,'mhSaveEditor',{configurable:true,value:{catalog:api}})
})
afterEach(()=>{cleanup();Reflect.deleteProperty(window,'mhSaveEditor')})
function mount(){function Root(){return <Outlet context={{game:gameVersions.find(g=>g.id==='mhp2g')!}}/>}function Location(){return <output data-testid="location">{useLocation().search}</output>}
  render(<MemoryRouter initialEntries={['/game/mhp2g/catalog/items?item=1']}><Location/><Routes><Route path="/game/mhp2g" element={<Root/>}><Route path="catalog/items" element={<ItemCatalogPage/>}/><Route path="catalog/weapons" element={<WorkspaceFeaturePage pageId="weapons"/>}/></Route></Routes></MemoryRouter>)}
describe('P2G shared item page',()=>{
  it('renders native identity, unknown English, description and no save controls',async()=>{
    mount();expect(await screen.findByText('原生说明')).toBeTruthy();expect(screen.getByText('道具编号 1')).toBeTruthy();expect(screen.getByText('英文名：未知')).toBeTruthy()
    expect(screen.queryByText(/写入/)).toBeNull();expect(screen.queryByText(/存档 ID/)).toBeNull()
    expect(api.getItem).toHaveBeenCalledWith({gameId:'mhp2g',itemId:1})
  })
  it('allows comparing a translated description with Japanese without exposing color commands',async()=>{
    const user=userEvent.setup()
    const localized={...detail,description:'测试中文说明\n~C05（测试类别）',localization:{nameSource:'项目译名（待验收）',namePending:false,descriptionSource:'项目译文（待验收）',descriptionPending:false,descriptionJp:'テスト説明\n~C05（テスト分類）'}}
    api.getItem.mockResolvedValue(localized)
    mount()
    expect(await screen.findByText(/测试中文说明/)).toBeTruthy()
    expect(screen.queryByText(/待验收|待审校/)).toBeNull()
    await user.click(screen.getByText('查看日文说明'))
    const original=screen.getByText(/テスト説明/)
    expect(original.closest('details')?.open).toBe(true)
    expect(original.getAttribute('lang')).toBe('ja')
    expect(document.body.textContent).not.toContain('~C05')
    expect(localized.description).toContain('~C05')
  })
  it('opens one real item drawer and closes it before locating the next item',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('原生说明');await user.click(screen.getByRole('button',{name:/调合/}));await user.click(screen.getByRole('button',{name:'材料'}))
    const dialog=await screen.findByRole('dialog',{name:'关联道具'});await within(dialog).findByText('道具编号 2');expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.click(within(dialog).getByRole('button',{name:/调合/}));await user.click(within(dialog).getByRole('button',{name:'材料'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByTestId('location').textContent).toContain('target=2')
    await waitFor(()=>expect(api.searchItems).toHaveBeenLastCalledWith(expect.objectContaining({gameId:'mhp2g',targetItemId:2})))
  })
  it('closes an item drawer before navigating to a pending related catalog', async () => {
    const user = userEvent.setup(); mount(); await screen.findByText('原生说明')
    await user.click(screen.getByRole('button', { name: /调合/ }))
    await user.click(screen.getByRole('button', { name: '材料' }))
    const dialog = await screen.findByRole('dialog', { name: '关联道具' })
    await within(dialog).findByText('道具编号 2')
    await user.click(within(dialog).getByRole('button', { name: /武器用途/ }))
    await user.click(within(dialog).getByRole('button', { name: '测试武器' }))
    await screen.findByRole('heading', { name: '武器图鉴' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/关联对象：测试武器/)).toBeTruthy()
  })
  it('shows pending target details and Escape returns focus without nesting',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('原生说明');await user.click(screen.getByRole('button',{name:/武器用途/}));const trigger=screen.getByRole('button',{name:'测试武器'});await user.click(trigger)
    expect(await screen.findByText('资料完善中')).toBeTruthy();expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger)
  })
  it('debounces search and displays empty and error results',async()=>{
    mount();await screen.findByText('原生说明');api.searchItems.mockResolvedValueOnce({items:[],total:0,page:1,pageSize:100,hasNext:false})
    fireEvent.change(screen.getByRole('textbox',{name:'搜索道具'}),{target:{value:'没有结果'}})
    expect(await screen.findByText('没有符合当前条件的道具。')).toBeTruthy()
    api.searchItems.mockRejectedValueOnce(new Error('资料库缺失'));fireEvent.change(screen.getByRole('textbox',{name:'搜索道具'}),{target:{value:'错误'}})
    expect(await screen.findByText('资料库缺失')).toBeTruthy()
  })
})
