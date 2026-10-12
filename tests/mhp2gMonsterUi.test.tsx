// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { MonsterDetail } from '../api/catalog/types'
import { MonsterDetailPanel } from '../ui/components/MonsterDetailPanel/MonsterDetailPanel'
import { MonsterDetailDrawer } from '../ui/components/MonsterDetailDrawer/MonsterDetailDrawer'
import { P2gMonsterQuestDrawer } from '../ui/components/P2gMonsterQuestDrawer/P2gMonsterQuestDrawer'
const monster: MonsterDetail = {
  gameId:'mhp2g',monsterId:1,nameCn:'测试兽',nameJp:'テスト',nameEn:'',iconSmallPath:null,iconLargePath:null,isPlaceholder:false,
  weakness:[],quests:[],p2gQuests:[{questKey:'wiki:synthetic:1',nameJp:'試験任務',fields:[{label:'体力',value:'123'}]}],
  ailments:[{id:1,statusId:1,nameCn:'异常',nameEn:'',toleranceInitial:null,toleranceIncrease:null,toleranceMax:null,duration:null,damage:null,applicable:null}],
  traps:[{id:1,trapId:1,nameCn:'陷阱',nameEn:'',isEffective:null,duration:null,durationEnraged:null,durationFatigued:null}],
  drops:[{id:1,rankId:1,rankNameCn:'上位',rankNameEn:'',methodId:1,methodNameCn:'捕获',methodNameEn:'',item:{gameId:'mhp2g',itemId:37,nameCn:'测试材料',nameEn:''},quantity:null,probability:25}],
}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}{location.search}</output>}
describe('P2G monster UI contracts',()=>{
  it('keeps unknowns distinct from immunity and passes itemId on selection',()=>{
    const select=vi.fn(),props={gameId:'mhp2g' as const,monster,loading:false,dropDirection:'desc' as const,taskAvailability:'all' as const,onTabChange:vi.fn(),onDropDirectionChange:vi.fn(),onTaskAvailabilityChange:vi.fn(),onSelectItem:select,onSelectQuest:vi.fn()}
    const {rerender}=render(<MonsterDetailPanel {...props} tab="ailments" />)
    expect(screen.queryByText('不适用')).toBeNull();expect(screen.getAllByText('未知').length).toBeGreaterThan(5)
    expect(screen.queryByText('疲劳持续')).toBeNull();expect(screen.getAllByText('持续（秒）')).toHaveLength(2)
    rerender(<MonsterDetailPanel {...props} tab="drops" />)
    expect(screen.getByText('25%')).toBeTruthy();expect(screen.getByText('未知')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'测试材料'}));expect(select).toHaveBeenCalledWith(expect.objectContaining({gameId:'mhp2g',itemId:37}))
  })
  it('closes a monster drawer before navigating to an item using the native identity',async()=>{
    const close=vi.fn();vi.stubGlobal('mhSaveEditor',{catalog:{getMonster:vi.fn().mockResolvedValue(monster)}})
    render(<MemoryRouter><MonsterDetailDrawer gameId="mhp2g" monsterId={1} onClose={close}/><Location/></MemoryRouter>)
    await screen.findByRole('heading',{name:'测试兽'})
    fireEvent.click(screen.getByRole('tab',{name:'掉落物'}));fireEvent.click(screen.getByRole('button',{name:'测试材料'}))
    expect(close).toHaveBeenCalledOnce();expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/items?target=37&item=37')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
  it('closes before locating a P2G quest in its catalog',async()=>{
    const close=vi.fn();vi.stubGlobal('mhSaveEditor',{catalog:{getMonster:vi.fn().mockResolvedValue(monster)}})
    render(<MemoryRouter><MonsterDetailDrawer gameId="mhp2g" monsterId={1} onClose={close}/><Location/></MemoryRouter>)
    await screen.findByRole('heading',{name:'测试兽'});fireEvent.click(screen.getByRole('tab',{name:'出没任务'}))
    fireEvent.click(screen.getByRole('button',{name:'試験任務'}))
    expect(close).toHaveBeenCalledOnce();expect(screen.getByTestId('location').textContent).toContain('/game/mhp2g/catalog/quests?target=wiki%3Asynthetic%3A1&quest=wiki%3Asynthetic%3A1')
  })
  it('closes a quest drawer before locating its monster',async()=>{
    const close=vi.fn()
    render(<MemoryRouter><P2gMonsterQuestDrawer questKey="wiki:synthetic:1" quest={monster.p2gQuests![0]} monster={monster} onClose={close}/><Location/></MemoryRouter>)
    fireEvent.click(screen.getByRole('button',{name:'测试兽'}))
    await waitFor(()=>expect(close).toHaveBeenCalledOnce())
    expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/monsters?monster=1&target=1')
  })
})
