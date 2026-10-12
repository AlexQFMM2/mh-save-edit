// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { QuestDetailPanel } from '../ui/components/QuestDetailPanel/QuestDetailPanel'
import { QuestDetailDrawer } from '../ui/components/QuestDetailDrawer/QuestDetailDrawer'
import { QuestCatalogPage } from '../ui/pages/QuestCatalogPage/QuestCatalogPage'
import { p2gQuest as quest } from './fixtures/p2gQuestUi'
import type { QuestDetail } from '../api/catalog/types'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
function Location(){const l=useLocation();return <output data-testid="location">{l.pathname}{l.search}</output>}
function Drawer(){const[open,setOpen]=useState(true);return <QuestDetailDrawer gameId="mhp2g" questKey={open?'mhp2g:q1':null} onClose={()=>setOpen(false)}/>}
function Shell(){const navigate=useNavigate();return <><button onClick={()=>navigate('?quest=mhp2g:q2')}>切换乙</button><button onClick={()=>navigate(-1)}>后退</button><Outlet context={{game:{id:'mhp2g'}}}/><Location/></>}
describe('P2G quest UI',()=>{
  it('renders guarantees separately from unknown weight and passes itemId for rewards and supplies',()=>{
    const item=vi.fn();render(<QuestDetailPanel quest={quest} loading={false} tab="rewards" onSelectMonster={vi.fn()} onSelectItem={item}/>)
    expect(screen.getAllByText('未收录')).toHaveLength(2);expect(screen.getByText(/首项保证/,{selector:'small'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'测试奖励'}));expect(item).toHaveBeenLastCalledWith(expect.objectContaining({gameId:'mhp2g',itemId:2}))
    fireEvent.click(screen.getByRole('button',{name:'测试支给'}));expect(item).toHaveBeenLastCalledWith(expect.objectContaining({gameId:'mhp2g',itemId:1}))
  })
  it('keeps conditional branches, sequential groups, delay and carried-item conditions visible',()=>{
    const select=vi.fn(),{rerender}=render(<QuestDetailPanel quest={quest} loading={false} tab="unlocks" onSelectMonster={vi.fn()} onSelectQuest={select}/>)
    expect(screen.getByText('满足任一分支（OR）')).toBeTruthy();expect(screen.getByText(/不要求完成/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'测试前置'}));expect(select).toHaveBeenCalledWith('mhp2g:q2')
    rerender(<QuestDetailPanel quest={quest} loading={false} onSelectMonster={vi.fn()}/>)
    expect(screen.getByText(/依次出场/)).toBeTruthy();expect(screen.getByText(/约 10 分钟/)).toBeTruthy()
    fireEvent.click(screen.getByText('小型怪物分组'));expect(screen.getByText(/当前携带/)).toBeTruthy()
  })
  it('renders Wiki gaps explicitly and never manufactures empty supplies',()=>{
    const wiki={...quest,p2g:{...quest.p2g!,source:'wiki' as const,supplies:null}}
    render(<QuestDetailPanel quest={wiki} loading={false} tab="rewards" onSelectMonster={vi.fn()}/>)
    expect(screen.getByText('支给品未收录。')).toBeTruthy();expect(screen.queryByText('无支给品配置。')).toBeNull()
  })
  it('portals one drawer and closes before navigating to the native item',async()=>{
    vi.stubGlobal('mhSaveEditor',{catalog:{getQuest:vi.fn().mockResolvedValue(quest)}})
    const {container}=render(<MemoryRouter><Drawer/><Location/></MemoryRouter>)
    await screen.findByRole('heading',{name:'测试任务甲'});expect(container.querySelector('[role=dialog]')).toBeNull()
    const dialog=screen.getByRole('dialog');fireEvent.click(within(dialog).getByRole('tab',{name:'报酬'}));fireEvent.click(within(dialog).getByRole('button',{name:'测试奖励'}))
    expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByTestId('location').textContent).toBe('/game/mhp2g/catalog/items?target=2&item=2')
  })
  it('ignores late detail responses when changing tasks and supports history navigation',async()=>{
    let resolveFirst!:(q:QuestDetail)=>void
    const first=new Promise<QuestDetail>(resolve=>{resolveFirst=resolve})
    const second={...quest,questKey:'mhp2g:q2',nameCn:'测试任务乙'}
    const getQuest=vi.fn().mockReturnValueOnce(first).mockResolvedValue(second)
    vi.stubGlobal('mhSaveEditor',{catalog:{getQuest,getQuestFacets:vi.fn().mockResolvedValue({systems:[],levels:[],ranks:[],questTypes:[],locations:[],availabilities:[]}),
      searchQuests:vi.fn().mockResolvedValue({items:[],page:1,pageSize:100,total:0,hasNext:false})}})
    render(<MemoryRouter initialEntries={['/?quest=mhp2g:q1']}><Routes><Route element={<Shell/>}><Route index element={<QuestCatalogPage/>}/></Route></Routes></MemoryRouter>)
    await waitFor(()=>expect(getQuest).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByText('切换乙'))
    await screen.findByRole('heading',{name:'测试任务乙'});await act(async()=>resolveFirst(quest))
    expect(screen.queryByRole('heading',{name:'测试任务甲'})).toBeNull()
    fireEvent.click(screen.getByText('后退'));await waitFor(()=>expect(getQuest).toHaveBeenLastCalledWith({gameId:'mhp2g',questKey:'mhp2g:q1'}))
  })
})
