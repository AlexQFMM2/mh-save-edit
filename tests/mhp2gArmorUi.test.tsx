// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import type { P2gArmorDetail, P2gArmorSetSummary } from '../api/catalog/p2gArmorTypes'
import { ArmorDetailPanel } from '../ui/components/ArmorDetailPanel/ArmorDetailPanel'
import { ArmorCatalogPage } from '../ui/pages/ArmorCatalogPage/ArmorCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
afterEach(cleanup)
const armor:P2gArmorDetail={gameId:'mhp2g',armorKey:'armor_head:1',nativeIndex:1,part:'head',nameCn:'测试头饰',nameJp:'テスト',nameEn:'',nameSource:'reviewed',nativeRowSha256:'test',combat:'both',gender:'both',rarity:1,slots:1,baseDefense:2,maxDefense:8,maxBeforeFinalUnlock:6,fireRes:0,waterRes:0,thunderRes:0,iceRes:0,dragonRes:0,price:50,iconPath:null,isPlaceholder:false,acquisition:'测试取得条件',skills:[{skillId:1,nameCn:'测试负技能',nameEn:'Test',nameJp:'テスト',points:-2,activeSkillNameCn:null,activeSkillNameEn:null}],recipes:[]}
const second={...armor,armorKey:'armor_head:2',nativeIndex:2,nameCn:'第二头饰'}
const set:P2gArmorSetSummary={gameId:'mhp2g',setKey:'test',nameJp:'テスト',sortOrder:0,rarity:1,totalSlots:1,totalBaseDefense:2,totalMaxDefense:8,rows:[{combat:'blademaster',nameCn:'测试套装',members:{head:armor}},{combat:'gunner',nameCn:'测试套装',members:{head:second}}]}
function page(catalog:Record<string,unknown>,url='/game/mhp2g/catalog/armor') {
  Object.defineProperty(window,'mhSaveEditor',{configurable:true,value:{catalog}})
  const game=gameVersions.find(g=>g.id==='mhp2g')!
  render(<MemoryRouter initialEntries={[url]}><Routes><Route element={<Outlet context={{game}}/>}><Route path="/game/:gameId/catalog/armor" element={<ArmorCatalogPage/>}/></Route></Routes></MemoryRouter>)
}
it('shows native identities, separate alternative recipes and clickable negative skills without a write control',()=>{
  const select=vi.fn(),item=vi.fn(),link={gameId:'mhp2g' as const,armorKey:armor.armorKey,part:armor.part,nameCn:armor.nameCn,nameJp:armor.nameJp,nameEn:''}
  const material={gameId:'mhp2g' as const,itemId:1,position:0,quantity:2,nameCn:'测试矿石',nameJp:'テスト',nameEn:''}
  render(<ArmorDetailPanel armor={{...armor,recipes:[{recipeKey:'first',cost:50,armor:link,materials:[material]},{recipeKey:'second',cost:50,armor:link,materials:[{...material,itemId:2,nameCn:'另一材料'}]}]}} loading={false} onSelectSkill={select} onSelectItem={item}/>)
  expect(screen.getAllByText('任选一组材料')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button',{name:'测试负技能'}));expect(select).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole('button',{name:'另一材料'}));expect(item).toHaveBeenCalledWith(2)
  expect(screen.queryByText(/Dex #|存档映射/)).toBeNull()
})
it('selects native set members using detail requests only and ignores late detail responses',async()=>{
  let resolveFirst!:(value:P2gArmorDetail)=>void
  const getArmor=vi.fn().mockImplementation(({armorKey}:{armorKey:string})=>armorKey===armor.armorKey?new Promise<P2gArmorDetail>(resolve=>{resolveFirst=resolve}):Promise.resolve(second))
  const searchArmorSets=vi.fn().mockResolvedValue({items:[set],total:1,page:1,pageSize:100,hasNext:false})
  page({searchArmorSets,getArmor,getArmorFacets:vi.fn().mockResolvedValue({rarities:[],slots:[],skills:[]})})
  await waitFor(()=>expect(getArmor).toHaveBeenCalledWith({gameId:'mhp2g',armorKey:armor.armorKey}))
  fireEvent.click(screen.getByRole('button',{name:/第二头饰/}))
  await screen.findByRole('heading',{name:'第二头饰'})
  await act(async()=>resolveFirst(armor))
  expect(screen.getByRole('heading',{name:'第二头饰'})).toBeTruthy();expect(searchArmorSets).toHaveBeenCalledTimes(1)
})
it('restores existing equipment-key URLs without inventing numeric IDs',async()=>{
  const getArmor=vi.fn().mockResolvedValue(armor),searchArmorSets=vi.fn().mockResolvedValue({items:[set],total:1,page:1,pageSize:100,hasNext:false})
  page({searchArmorSets,getArmor,getArmorFacets:vi.fn().mockResolvedValue({rarities:[],slots:[],skills:[]})},'/game/mhp2g/catalog/armor?equipment=armor_head%3A1')
  await waitFor(()=>expect(getArmor).toHaveBeenCalledWith({gameId:'mhp2g',armorKey:'armor_head:1'}))
  expect(searchArmorSets.mock.calls[0][0]).toMatchObject({targetArmorKey:'armor_head:1'})
  expect(searchArmorSets.mock.calls[0][0]).not.toHaveProperty('targetDexId')
})
