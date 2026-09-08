// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MonsterDetail } from '../api/catalog/types'
import { MonsterDetailPanel } from '../ui/components/MonsterDetailPanel/MonsterDetailPanel'
import { MonsterSearchList } from '../ui/components/MonsterSearchList/MonsterSearchList'

afterEach(cleanup)
const monster: MonsterDetail = {
  gameId:'mhgu',monsterId:42,nameCn:'雌火龙',nameEn:'Rathian',nameJp:'リオレイア',iconSmallPath:null,iconLargePath:null,isPlaceholder:false,
  weakness:[{id:1,partId:1,partOrder:1,partNameCn:'头部',partNameEn:'Head',conditionCn:'',conditionEn:'',cut:70,impact:75,shot:65,fire:0,water:15,thunder:20,ice:15,dragon:35,stun:100}],
  ailments:[{id:1,statusId:6,nameCn:'毒',nameEn:'Poison',toleranceInitial:200,toleranceIncrease:100,toleranceMax:600,duration:30,damage:120}],
  traps:[{id:1,trapId:1,nameCn:'闪光',nameEn:'Flash',isEffective:true,duration:20,durationEnraged:15,durationFatigued:25}],
  drops:[{id:1,rankId:1,rankNameCn:'下位',rankNameEn:'Low',methodId:1,methodNameCn:'本体剥取',methodNameEn:'Body Carve',item:{gameId:'mhgu',saveId:10,nameCn:'雌火龙的鳞',nameEn:'Rathian Scale'},quantity:1,probability:38}],
  quests:[{gameId:'mhgu',questKey:'dex:1',dexId:1,nativeId:null,availability:'common',nameCn:'陆之女王',nameEn:'The Land Queen',nameJp:'',goalCn:'狩猎1头雌火龙',goalEn:'',subGoalCn:'',subGoalEn:'',levelId:1,levelNameCn:'村 2★',levelNameEn:'Village',questTypeId:3,questTypeNameCn:'狩猎',questTypeNameEn:'Hunt',locationId:1,locationNameCn:'古代森林',locationNameEn:'Jurassic Frontier',timeMinutes:50,fee:100,reward:1800,reward2:300,hrp:120,hrp2:20,monsters:[],modifiers:[]}],
}

describe('monster catalog UI',()=>{
  it('renders detail tabs and switches them with keyboard navigation',()=>{const onTabChange=vi.fn();render(<MonsterDetailPanel gameId="mhgu" monster={monster} loading={false} tab="weakness" dropDirection="desc" taskAvailability="all" onTabChange={onTabChange} onDropDirectionChange={()=>undefined} onTaskAvailabilityChange={()=>undefined} onSelectItem={()=>undefined} onSelectQuest={()=>undefined}/>);expect(screen.getByText('头部')).toBeTruthy();fireEvent.keyDown(screen.getByRole('tab',{name:'肉质'}),{key:'ArrowRight'});expect(onTabChange).toHaveBeenCalledWith('ailments')})
  it('exposes drop items and quest rows as buttons',()=>{const onItem=vi.fn();const onQuest=vi.fn();const{rerender}=render(<MonsterDetailPanel gameId="mhgu" monster={monster} loading={false} tab="drops" dropDirection="desc" taskAvailability="all" onTabChange={()=>undefined} onDropDirectionChange={()=>undefined} onTaskAvailabilityChange={()=>undefined} onSelectItem={onItem} onSelectQuest={onQuest}/>);fireEvent.click(screen.getByRole('button',{name:'雌火龙的鳞'}));expect(onItem).toHaveBeenCalledWith(10);rerender(<MonsterDetailPanel gameId="mhgu" monster={monster} loading={false} tab="quests" dropDirection="desc" taskAvailability="all" onTabChange={()=>undefined} onDropDirectionChange={()=>undefined} onTaskAvailabilityChange={()=>undefined} onSelectItem={onItem} onSelectQuest={onQuest}/>);fireEvent.click(screen.getByRole('button',{name:'陆之女王'}));expect(onQuest).toHaveBeenCalledWith('dex:1')})
  it('keeps old details visible while the replacement is loading',()=>{render(<MonsterDetailPanel gameId="mhgu" monster={monster} loading tab="weakness" dropDirection="desc" taskAvailability="all" onTabChange={()=>undefined} onDropDirectionChange={()=>undefined} onTaskAvailabilityChange={()=>undefined} onSelectItem={()=>undefined} onSelectQuest={()=>undefined}/>);expect(screen.getByRole('heading',{name:'雌火龙'})).toBeTruthy();expect(screen.getByText('正在更新资料…')).toBeTruthy()})
  it('supports roving arrow-key selection in the monster list',()=>{const onSelect=vi.fn();render(<MonsterSearchList monsters={[monster,{...monster,monsterId:43,nameCn:'雄火龙'}]} selectedId={42} query="" loading={false} includePlaceholders={false} onQueryChange={()=>undefined} onPlaceholderChange={()=>undefined} onReset={()=>undefined} onSelect={onSelect}/>);fireEvent.keyDown(screen.getByRole('button',{name:/雌火龙/}),{key:'ArrowDown'});expect(onSelect).toHaveBeenCalledWith(43)})
})
