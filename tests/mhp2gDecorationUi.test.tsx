// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DecorationCatalogPage } from '../ui/pages/DecorationCatalogPage/DecorationCatalogPage'
import { DecorationDetailPanel } from '../ui/components/DecorationDetailPanel/DecorationDetailPanel'
import { DecorationDetailDrawer } from '../ui/components/DecorationDetailDrawer/DecorationDetailDrawer'
import { P2gSkillEquipmentDrawer } from '../ui/components/P2gSkillEquipmentDrawer/P2gSkillEquipmentDrawer'
import { SkillDetailDrawer } from '../ui/components/SkillDetailDrawer/SkillDetailDrawer'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { decorationDetail,decorationItem } from './fixtures/p2gDecorationUi'
import { skillDetail,skillEquipment } from './fixtures/p2gSkillUi'
import { gameVersions } from '../ui/data/gameVersions'
import type { DecorationDetail } from '../api/catalog/types'
afterEach(()=>{cleanup();Reflect.deleteProperty(window,'mhSaveEditor')})
const facets={slots:[1,3],skills:[{skillId:1,nameCn:'合成技能甲',nameJp:'テスト技能甲',nameEn:''}]}
function api(methods:Record<string,unknown>={}) {const result={searchDecorations:vi.fn().mockResolvedValue({items:[decorationDetail],page:1,pageSize:100,total:1,hasNext:false}),getDecoration:vi.fn().mockResolvedValue(decorationDetail),getDecorationFacets:vi.fn().mockResolvedValue(facets),getSkill:vi.fn().mockResolvedValue(skillDetail),getItem:vi.fn().mockResolvedValue(decorationItem),...methods};window.mhSaveEditor={catalog:result} as unknown as Window['mhSaveEditor'];return result}
function Location(){const location=useLocation(),navigate=useNavigate();return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={()=>navigate(-1)}>后退测试</button><button onClick={()=>navigate(1)}>前进测试</button></>}
function page(entry='/decorations?item=1') {return render(<MemoryRouter initialEntries={[entry]}><Routes><Route element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp2g')}}/>}><Route path="/decorations" element={<DecorationCatalogPage/>}/></Route></Routes><Location/></MemoryRouter>)}
describe('P2G decoration interface and relation navigation',()=>{
  it('shows signed points, alternative recipes, native identities and unknown fields without write controls',()=>{
    render(<DecorationDetailPanel item={decorationDetail} loading={false}/>)
    expect(screen.getByText('+2')).toBeTruthy();expect(screen.getByText('-1')).toBeTruthy();expect(screen.getByText('配方 2')).toBeTruthy()
    expect(screen.getAllByText('未收录')).toHaveLength(3);expect(screen.queryByText('500 z')).toBeNull();expect(screen.getByText('50 z')).toBeTruthy();expect(screen.getByText('道具编号 #1')).toBeTruthy();expect(screen.queryByText(/加入道具箱/)).toBeNull()
  })
  it('uses itemId for page details and Japanese keywords in the skill selector',async()=>{
    const calls=api();page();await screen.findByRole('heading',{name:'甲合成珠'})
    expect(calls.getDecoration).toHaveBeenCalledWith({gameId:'mhp2g',itemId:1})
    fireEvent.click(screen.getByRole('button',{name:'按技能筛选装饰品'}));const input=screen.getByRole('combobox',{name:'按技能筛选装饰品关键词'});fireEvent.change(input,{target:{value:'テスト技能甲'}})
    fireEvent.click(await screen.findByRole('option',{name:'合成技能甲'}));await waitFor(()=>expect(calls.searchDecorations).toHaveBeenCalledWith(expect.objectContaining({gameId:'mhp2g',skillId:1,sort:'skillPoints'})))
  })
  it('opens a material portal and replaces it with a skill drawer, with only one layer',async()=>{
    api();const {container}=page();await screen.findByRole('heading',{name:'甲合成珠'})
    fireEvent.click(screen.getByRole('button',{name:/^合成素材/}));await screen.findByRole('dialog',{name:'关联道具'});expect(container.querySelector('[role=dialog]')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'合成技能甲'}));await screen.findByRole('dialog',{name:'关联技能'});expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
  it('closes a decoration drawer before material navigation using itemId',async()=>{
    api();const closed=vi.fn();const {container}=render(<MemoryRouter><DecorationDetailDrawer identity={{gameId:'mhp2g',itemId:1}} onClose={closed}/><Location/></MemoryRouter>)
    await screen.findByRole('heading',{name:'甲合成珠'});expect(container.querySelector('[role=dialog]')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:/^合成素材/}));expect(closed).toHaveBeenCalledOnce();expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/items?target=2&item=2');expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
  it('restores old equipment links as full decoration details when the catalog is installed',async()=>{
    api({getP2gSkillEquipment:vi.fn().mockResolvedValue({...skillEquipment,decorationItemId:1})})
    render(<MemoryRouter><P2gSkillEquipmentDrawer equipmentKey="item:1" onClose={vi.fn()}/></MemoryRouter>)
    await screen.findByRole('dialog',{name:'关联装饰品'});await screen.findByRole('heading',{name:'甲合成珠'});expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
  it('navigates from a skill drawer to the located decoration page',async()=>{
    api({getSkill:vi.fn().mockResolvedValue({...skillDetail,p2g:{...skillDetail.p2g,equipment:skillDetail.p2g!.equipment.map(e=>({...e,decorationItemId:1}))}})})
    const closed=vi.fn();render(<MemoryRouter><SkillDetailDrawer gameId="mhp2g" skillId={1} onClose={closed}/><Location/></MemoryRouter>)
    await screen.findByText('合成效果说明');fireEvent.click(screen.getByRole('tab',{name:/相关装饰品/}));fireEvent.click(screen.getByRole('button',{name:/合成珠/}));expect(closed).toHaveBeenCalledOnce();expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/decorations?target=1&item=1')
  })
  it('opens full decoration details from the item body',async()=>{
    api({searchItems:vi.fn().mockResolvedValue({items:[decorationItem],page:1,pageSize:100,total:1,hasNext:false}),getItemFacets:vi.fn().mockResolvedValue({rarities:[],maxStacks:[],relations:[]})})
    render(<MemoryRouter initialEntries={['/items?item=1']}><Routes><Route element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp2g')}}/>}><Route path="/items" element={<ItemCatalogPage/>}/></Route></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button',{name:'查看装饰品详情与技能'}));await screen.findByRole('dialog',{name:'关联装饰品'});expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
  it('ignores late details after selection and restores selection through history',async()=>{
    let resolve:(value:DecorationDetail)=>void=()=>undefined
    const second={...decorationDetail,itemId:3,nameCn:'乙合成珠'} as DecorationDetail
    const calls=api({searchDecorations:vi.fn().mockResolvedValue({items:[decorationDetail,second],page:1,pageSize:100,total:2,hasNext:false}),getDecoration:vi.fn(({itemId})=>itemId===1?new Promise<DecorationDetail>(r=>{resolve=r}):Promise.resolve(second))})
    page();const list=await screen.findByRole('list',{name:'装饰品搜索结果'});fireEvent.click(within(list).getByRole('button',{name:/乙合成珠/}));await screen.findByRole('heading',{name:'乙合成珠'})
    await act(async()=>resolve(decorationDetail));expect(screen.queryByRole('heading',{name:'甲合成珠'})).toBeNull()
    calls.getDecoration.mockImplementation(async({itemId}: {itemId:number})=>itemId===1?decorationDetail:second)
    fireEvent.click(screen.getByRole('button',{name:'后退测试'}));await screen.findByRole('heading',{name:'甲合成珠'});fireEvent.click(screen.getByRole('button',{name:'前进测试'}));await screen.findByRole('heading',{name:'乙合成珠'})
  })
  it('shows missing-data errors without reporting an empty successful catalog',async()=>{
    api({searchDecorations:vi.fn().mockRejectedValue(new Error('P2G 装饰品资料尚未安装')),getDecorationFacets:vi.fn().mockRejectedValue(new Error('missing'))});page('/decorations')
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','P2G 装饰品资料尚未安装');expect(screen.queryByText('没有符合条件的装饰品。')).toBeNull()
  })
})
