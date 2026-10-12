// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { MemoryRouter,Outlet,Route,Routes,useLocation } from 'react-router-dom'
import { SkillDetailPanel } from '../ui/components/SkillDetailPanel/SkillDetailPanel'
import { SkillCatalogPage } from '../ui/pages/SkillCatalogPage/SkillCatalogPage'
import { P2gSkillEquipmentPanel } from '../ui/components/P2gSkillEquipmentPanel/P2gSkillEquipmentPanel'
import { P2gSkillEquipmentDrawer } from '../ui/components/P2gSkillEquipmentDrawer/P2gSkillEquipmentDrawer'
import { SkillDetailDrawer } from '../ui/components/SkillDetailDrawer/SkillDetailDrawer'
import { skillSummary,skillDetail,skillEquipment } from './fixtures/p2gSkillUi'
import type { SkillDetail } from '../api/catalog/types'
import { gameVersions } from '../ui/data/gameVersions'
afterEach(()=>{cleanup();Reflect.deleteProperty(window,'mhSaveEditor')})
function api(methods:Record<string,unknown>){window.mhSaveEditor={catalog:methods} as unknown as Window['mhSaveEditor']}
function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}{location.search}</output>}
describe('P2G skill catalog interface',()=>{
  it('renders source, signed points and linked composites, without talismans',()=>{
    const select=vi.fn(),equipment=vi.fn();render(<SkillDetailPanel skill={skillDetail} loading={false} tab="decoration" onSelectArmor={vi.fn()} onSelectDecoration={vi.fn()} onSelectSkill={select} onSelectP2gEquipment={equipment}/>)
    expect(screen.getByText('合成效果说明')).toBeTruthy();expect(screen.getByText('-1')).toBeTruthy();expect(screen.queryByRole('tab',{name:/护石/})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'合成子效果'}));expect(select).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button',{name:/合成珠/}));expect(equipment.mock.calls[0][0].equipmentKey).toBe('item:1')
  })
  it('shows a special rule without a fabricated threshold or no-effect message',()=>{
    const skill:SkillDetail={...skillDetail,activations:[],p2g:{...skillDetail.p2g!,specialRule:{descriptionCn:'特殊部位复制规则',descriptionJp:'テスト特殊'}}}
    render(<SkillDetailPanel skill={skill} loading={false} onSelectArmor={vi.fn()} onSelectDecoration={vi.fn()}/>)
    expect(screen.getByText('特殊部位复制规则')).toBeTruthy();expect(screen.queryByText('没有发动效果。')).toBeNull();expect(screen.queryByText('发动效果')).toBeNull()
  })
  it('uses distinct accessible tab and panel identities in multiple detail panels',()=>{
    render(<><SkillDetailPanel skill={skillDetail} loading={false} onSelectArmor={vi.fn()} onSelectDecoration={vi.fn()}/><SkillDetailPanel skill={skillDetail} loading={false} onSelectArmor={vi.fn()} onSelectDecoration={vi.fn()}/></>)
    const ids=screen.getAllByRole('tab').map(node=>node.id);expect(new Set(ids).size).toBe(ids.length)
    for(const tab of screen.getAllByRole('tab'))expect(document.getElementById(tab.getAttribute('aria-controls')!)).toBeTruthy()
  })
  it('preserves P2G item identity in equipment material callbacks',()=>{
    const select=vi.fn();render(<P2gSkillEquipmentPanel equipment={skillEquipment} loading={false} onSelectSkill={vi.fn()} onSelectItem={select}/>)
    fireEvent.click(screen.getByRole('button',{name:'合成素材'}));expect(select).toHaveBeenCalledWith(expect.objectContaining({gameId:'mhp2g',itemId:2}));expect(screen.getByText('生产费用及解锁条件未收录。')).toBeTruthy()
  })
  it('portals equipment details and closes before navigating to a skill',async()=>{
    const closed=vi.fn();api({getP2gSkillEquipment:vi.fn().mockResolvedValue(skillEquipment)})
    const {container}=render(<MemoryRouter><P2gSkillEquipmentDrawer equipmentKey="item:1" onClose={closed}/><Location/></MemoryRouter>)
    await screen.findByRole('button',{name:/合成技能甲/});expect(container.querySelector('[role="dialog"]')).toBeNull();expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:/合成技能甲/}));expect(closed).toHaveBeenCalledOnce();expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/skills?target=1&skill=1')
  })
  it('navigates from a skill drawer to a located equipment detail, without a second layer',async()=>{
    const close=vi.fn();api({getSkill:vi.fn().mockResolvedValue(skillDetail)})
    render(<MemoryRouter><SkillDetailDrawer gameId="mhp2g" skillId={1} onClose={close}/><Location/></MemoryRouter>)
    await screen.findByText('合成效果说明');fireEvent.click(screen.getByRole('tab',{name:/相关装饰品/}));fireEvent.click(screen.getByRole('button',{name:/合成珠/}))
    expect(close).toHaveBeenCalledOnce();expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(screen.getByTestId('location').textContent).toContain('equipment=item%3A1')
  })
  it('rejects stale detail responses after selecting another skill',async()=>{
    let resolveFirst:(value:SkillDetail)=>void=()=>undefined
    const second={...skillDetail,skillId:2,nameCn:'合成技能乙'}
    api({searchSkills:vi.fn().mockResolvedValue({items:[skillSummary,{...skillSummary,skillId:2,nameCn:'合成技能乙'}],page:1,pageSize:100,total:2,hasNext:false}),getSkill:vi.fn(({skillId})=>skillId===1?new Promise<SkillDetail>(resolve=>{resolveFirst=resolve}):Promise.resolve(second))})
    render(<MemoryRouter initialEntries={['/skills?skill=1']}><Routes><Route element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp2g')}}/>}><Route path="/skills" element={<SkillCatalogPage/>}/></Route></Routes></MemoryRouter>)
    await screen.findByRole('option',{name:/合成技能乙/});fireEvent.click(screen.getByRole('option',{name:/合成技能乙/}));await screen.findByRole('heading',{name:'合成技能乙'});resolveFirst(skillDetail)
    await waitFor(()=>expect(screen.queryByRole('heading',{name:'合成技能甲'})).toBeNull());expect(screen.getByRole('heading',{name:'合成技能乙'})).toBeTruthy()
  })
  it('reports missing skill data instead of a successful empty list',async()=>{
    api({searchSkills:vi.fn().mockRejectedValue(new Error('P2G 技能资料尚未安装'))})
    render(<MemoryRouter><Routes><Route element={<Outlet context={{game:gameVersions.find(g=>g.id==='mhp2g')}}/>}><Route path="/" element={<SkillCatalogPage/>}/></Route></Routes></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','P2G 技能资料尚未安装')
  })
})
