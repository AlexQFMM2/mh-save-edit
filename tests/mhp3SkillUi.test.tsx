// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { p3SkillFixture } from './fixtures/p3SkillCatalog'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'
import { P3SkillCatalogRepository } from '../api/catalog/p3SkillRepository'
import { SkillCatalogPage } from '../ui/pages/SkillCatalogPage/SkillCatalogPage'
import { DecorationCatalogPage } from '../ui/pages/DecorationCatalogPage/DecorationCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
let db:ReturnType<typeof p3SkillFixture>,repo:P3SkillCatalogRepository
const api={searchSkills:vi.fn(),getSkill:vi.fn(),getP3SkillArmor:vi.fn(),searchDecorations:vi.fn(),getDecoration:vi.fn(),getDecorationFacets:vi.fn()}
beforeEach(()=>{
  db=p3SkillFixture();const decorations=new P3DecorationCatalogRepository(db,new P3ItemCatalogRepository(db));repo=new P3SkillCatalogRepository(db,decorations)
  for(const fn of Object.values(api))fn.mockReset()
  api.searchSkills.mockImplementation(async p=>repo.searchSkills(p));api.getSkill.mockImplementation(async p=>repo.getSkill(p.skillId));api.getP3SkillArmor.mockImplementation(async p=>repo.getArmor(p.armorKey))
  api.searchDecorations.mockImplementation(async p=>decorations.searchDecorations(p));api.getDecoration.mockImplementation(async p=>decorations.getDecoration(p));api.getDecorationFacets.mockImplementation(async()=>decorations.getDecorationFacets())
  window.mhSaveEditor={catalog:api} as unknown as Window['mhSaveEditor']
})
afterEach(()=>{cleanup();db.close();Reflect.deleteProperty(window,'mhSaveEditor')})
function History(){const location=useLocation(),navigate=useNavigate();return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={()=>navigate(-1)}>测试后退</button><button onClick={()=>navigate(1)}>测试前进</button></>}
function mount(url='/game/mhp3/catalog/skills?skill=2'){
  render(<MemoryRouter initialEntries={[url]}><History/><Routes><Route path="/game/mhp3" element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp3')}}/>}><Route path="catalog/skills" element={<SkillCatalogPage/>}/><Route path="catalog/decorations" element={<DecorationCatalogPage/>}/></Route></Routes></MemoryRouter>)
}
describe('P3 skills and one-level associations',()=>{
  it('renders source, distinct same-name identities, negative points, fallback names and copy rules',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('独立测试说明2')
    expect(screen.getByRole('button',{name:/合成防具/}).textContent).toContain('-2')
    expect(screen.getByRole('button',{name:/テスト防具/}).textContent).toContain('取得未确认')
    expect(screen.queryByText('无复合效果')).toBeNull()
    await user.click(screen.getByRole('option',{name:/复制测试/}));await screen.findByText('测试复制含胴部装饰品')
    expect(screen.queryByText('发动效果')).toBeNull();expect(screen.getByRole('button',{name:/テスト防具/}).textContent).toContain('胴系复制')
    expect(screen.queryByText('+1')).toBeNull()
  })
  it('labels candidates and gifts separately, and never treats an empty pool as absence of legal charms',async()=>{
    const user=userEvent.setup();mount('/game/mhp3/catalog/skills?skill=2&tab=talisman');await screen.findByText('随机候选范围')
    expect(screen.getByText('-2 ～ +4')).toBeTruthy();expect(screen.getByText('+10 · 0 孔')).toBeTruthy();expect(screen.getByText('测试触发条件未确认')).toBeTruthy()
    expect(screen.queryByText('合法点数')).toBeNull()
    await user.click(screen.getByRole('option',{name:/测试技能/}));await screen.findByText(/当前资料没有该技能的候选或赠品记录/)
  })
  it('opens an armor preview then closes before locating a skill, with Escape focus return',async()=>{
    const user=userEvent.setup();mount();const trigger=await screen.findByRole('button',{name:/合成防具/})
    await user.click(trigger);let dialog=await screen.findByRole('dialog',{name:'关联防具'});await within(dialog).findByText(/原生类型 4/)
    expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(api.getP3SkillArmor).toHaveBeenCalledWith({gameId:'mhp3',armorKey:'mhp3:armor:4:1'})
    await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger)
    await user.click(trigger);dialog=await screen.findByRole('dialog');await user.click(await within(dialog).findByRole('button',{name:/测试技能/}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await screen.findByRole('heading',{name:'测试技能'});expect(screen.getByTestId('location').textContent).toContain('target=3')
  })
  it('closes a full skill drawer before locating inline armor, without an armor catalog or nested drawer',async()=>{
    const user=userEvent.setup();mount('/game/mhp3/catalog/decorations?item=825');await screen.findByText('道具编号 #825')
    await user.click(screen.getByRole('button',{name:'负向技能'}));const dialog=await screen.findByRole('dialog',{name:'关联技能'})
    await user.click(await within(dialog).findByRole('button',{name:/合成防具/}))
    const inline=await screen.findByRole('article',{name:'防具关联预览'});await within(inline).findByRole('heading',{name:'合成防具'})
    expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByTestId('location').textContent).toContain('/catalog/skills?target=2&skill=2&equipment=mhp3%3Aarmor%3A4%3A1')
    await user.click(within(inline).getByRole('button',{name:/负向技能/}));await screen.findByRole('dialog',{name:'关联技能'});expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.keyboard('{Escape}');await user.click(screen.getByRole('button',{name:'返回技能详情'}));await screen.findByRole('heading',{name:'负向技能'})
  })
  it('closes a jewel drawer before locating the full skill page',async()=>{
    const user=userEvent.setup();mount('/game/mhp3/catalog/skills?skill=2&tab=decoration');await user.click(await screen.findByRole('button',{name:/同名珠/}))
    const dialog=await screen.findByRole('dialog',{name:'关联装饰品'});await user.click(await within(dialog).findByRole('button',{name:'测试技能'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());await screen.findByRole('heading',{name:'测试技能'});expect(screen.getByTestId('location').textContent).toBe('/game/mhp3/catalog/skills?target=3&skill=3')
  })
  it('keeps list scroll, selection and detail positions through history without restarting searches',async()=>{
    const user=userEvent.setup();mount();await screen.findByText('独立测试说明2')
    const list=screen.getByRole('listbox'),detail=document.querySelector('.skill-detail-panel__scroll')!;list.scrollTop=80;fireEvent.scroll(list);detail.scrollTop=160;fireEvent.scroll(detail)
    const calls=api.searchSkills.mock.calls.length
    await user.click(screen.getByRole('option',{name:/测试技能/}));await screen.findByRole('heading',{name:'测试技能'})
    expect(screen.getByRole('listbox')).toBe(list);expect(list.scrollTop).toBe(80);expect(api.searchSkills).toHaveBeenCalledTimes(calls)
    await user.click(screen.getByText('测试后退'));await screen.findByRole('heading',{name:'负向技能'});expect(document.querySelector('.skill-detail-panel__scroll')?.scrollTop).toBe(160)
    await user.click(screen.getByText('测试前进'));await screen.findByRole('heading',{name:'测试技能'})
  })
  it('retries list/detail/armor failures, retains query and exposes empty states',async()=>{
    const user=userEvent.setup();api.searchSkills.mockRejectedValueOnce(new Error('P3 技能资料尚未安装'));api.getSkill.mockRejectedValueOnce(new Error('详情暂不可用'))
    mount('/game/mhp3/catalog/skills?skill=2&q=Negative');await screen.findByText('P3 技能资料尚未安装');await screen.findByText('详情暂不可用')
    await user.click(screen.getByRole('button',{name:'重试列表'}));await screen.findByText('独立测试说明2');expect(screen.getByRole('textbox',{name:'搜索技能'})).toHaveProperty('value','Negative')
    api.getP3SkillArmor.mockRejectedValueOnce(new Error('防具暂不可用'));await user.click(screen.getByRole('button',{name:/合成防具/}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('防具暂不可用');await user.click(within(dialog).getByRole('button',{name:'重试'}));await within(dialog).findByRole('heading',{name:'合成防具'})
    await user.keyboard('{Escape}');fireEvent.change(screen.getByRole('textbox',{name:'搜索技能'}),{target:{value:'不存在的搜索'}});await screen.findByText('没有符合条件的技能。')
  })
  it('exposes a retry for full skill drawers and handles unknown deep-link armor identities',async()=>{
    const user=userEvent.setup();api.getSkill.mockRejectedValueOnce(new Error('技能暂不可用'));mount('/game/mhp3/catalog/decorations?item=825');await user.click(await screen.findByRole('button',{name:'负向技能'}));const dialog=await screen.findByRole('dialog');await within(dialog).findByText('技能暂不可用');await user.click(within(dialog).getByRole('button',{name:'重试详情'}));await within(dialog).findByText('独立测试说明2')
    cleanup();mount('/game/mhp3/catalog/skills?skill=2&equipment=mhp3%3Aarmor%3A4%3A255');await screen.findByText('未找到对应防具资料。');expect(screen.queryByRole('dialog')).toBeNull()
  })
})
