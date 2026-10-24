import { afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'
import { catalogIdentityRows } from '../api/terminology/catalogIdentity.mjs'
import { itemCatalogFiltersSchema, itemIdentitySchema, itemTermFiltersSchema } from '../api/catalog/schemas'
// @ts-expect-error ESM dictionary builder.
import { createItemDictionary } from '../tools/terminology/itemDictionary.mjs'
const handlers = vi.hoisted(() => new Map<string, (event:unknown,payload:unknown)=>any>())
vi.mock('electron', () => ({ipcMain:{handle:(key:string,fn:(event:unknown,payload:unknown)=>any)=>handlers.set(key,fn),removeHandler:(key:string)=>handlers.delete(key)}}))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanup: (()=>void)[] = []
afterEach(() => { cleanup.splice(0).reverse().forEach(fn=>fn()); handlers.clear() })
function fixture() { const db=p3ItemFixture();cleanup.push(()=>db.close());return {db,repo:new P3ItemCatalogRepository(db)} }

describe('P3 isolated item catalog', () => {
  it('keeps native IDs, hides both placeholders, and supports literal bilingual/alias/number queries without a dictionary', () => {
    const {repo}=fixture()
    expect(repo.searchItems({gameId:'mhp3'}).total).toBe(7)
    expect(repo.searchItems({gameId:'mhp3',includePlaceholders:true}).total).toBe(9)
    for(const query of ['审定旧称','テスト珠甲','825']) expect(repo.searchItems({gameId:'mhp3',query}).items.map(i=>i.itemId)).toContain(825)
    expect(repo.searchItems({gameId:'mhp3',query:'%'}).total).toBe(0)
    const jewels=repo.searchItems({gameId:'mhp3',query:'同名珠',category:'decoration'}).items
    expect(jewels.map(i=>i.itemId)).toEqual([825,826]);expect(jewels[0].p3.decoration?.skills.map(s=>s.points)).toEqual([1,-1])
    expect(jewels[1].p3.decoration?.skills.map(s=>s.points)).toEqual([2])
    expect(repo.getItem({gameId:'mhp3',itemId:825})).not.toHaveProperty('saveId')
  })
  it('keeps special quantities separate and filters only confirmed sources/usages', () => {
    const {repo}=fixture()
    expect(repo.searchItems({gameId:'mhp3',quantityKind:'infinite'}).items.map(i=>i.itemId)).toEqual([94])
    expect(repo.searchItems({gameId:'mhp3',quantityKind:'reusable-cooldown'}).items.map(i=>i.maxStack)).toEqual([null])
    expect(repo.getItemFacets().maxStacks).not.toContain(255)
    expect(repo.searchItems({gameId:'mhp3',sourceKinds:['shop']}).items.map(i=>i.itemId)).toEqual([10])
    expect(repo.searchItems({gameId:'mhp3',usageKinds:['decoration'],sourceKinds:['shop']}).items.map(i=>i.itemId)).toEqual([10])
    expect(repo.searchItems({gameId:'mhp3',page:2,pageSize:3}).items).toHaveLength(3)
  })
  it('exposes alternative recipes and bidirectional material search with reasons, including signed jewel tags', () => {
    const {repo}=fixture()
    expect(repo.getItem({gameId:'mhp3',itemId:825})?.p3.recipes.map(r=>r.materials.map(m=>[m.itemId,m.quantity]))).toEqual([[[10,2],[20,1]],[[20,3]]])
    const found=repo.searchItems({gameId:'mhp3',query:'测试材料'}).items
    expect(found.find(i=>i.itemId===30)?.matchReason).toContain('调合材料')
    expect(found.find(i=>i.itemId===825)?.matchReason).toContain('制作材料')
    const material=repo.getItem({gameId:'mhp3',itemId:10})!
    expect(material.relations.filter(r=>r.usageKind==='decoration').map(r=>r.relatedItems[0].p3Decoration?.skills[0].points)).toEqual([1,2])
    expect(material.relations.find(r=>r.sourceKind==='combination')?.metadata).toMatchObject({'基础成功率':'75%','产量':'1～3'})
    expect(material.relations.filter(r=>r.sourceKind==='shop').map(r=>r.metadata['售价'])).toEqual(['17 z','8 z'])
    expect(material.buyPrice).toBeNull();expect(material.p3.coverage.monster).toBe('not-collected')
  })
  it('retains reviewed P3 names when GU Japanese matches have a different effect-root name; rejects stale aliases', () => {
    const {db}=fixture(),dictionary=new Database(':memory:');cleanup.push(()=>dictionary.close())
    createItemDictionary(dictionary,[{id:'synthetic-gu',kind:'item',ja:'テスト珠甲',zhHans:'另一珠名【1】',chineseSource:'gu_official'}],
      [{gameId:'mhp3',rows:catalogIdentityRows(db,'mhp3'),itemAliases:new Map([[825,['审定旧称','后作对应名']]])}])
    const terminology=new ItemTermRepository(dictionary),repo=new P3ItemCatalogRepository(db,terminology)
    expect(repo.searchItems({gameId:'mhp3',query:'后作对应名'}).items.find(i=>i.itemId===825)?.nameCn).toBe('同名珠【1】')
    expect(terminology.search({gameId:'mhp3',query:'同名珠'}).items).toHaveLength(2)
    db.exec("UPDATE catalog_items SET aliases_json='[\"changed\"]' WHERE item_id=825")
    expect(()=>new P3ItemCatalogRepository(db,terminology)).toThrow(/配套资料/)
  })
  it('dispatches only item/term services, rejects foreign identities, and reports a missing P3 runtime', () => {
    const dir=mkdtempSync(join(tmpdir(),'p3-ipc-'));cleanup.push(()=>rmSync(dir,{recursive:true,force:true}))
    const stop=registerCatalogIpc(dir);cleanup.push(stop)
    const call=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(()=>call(catalogChannels.searchItems,{gameId:'mhp3'})).toThrow(/P3 道具资料库尚未安装/)
    const db=p3ItemFixture(join(dir,'mhp3.sqlite'));db.close()
    expect(call(catalogChannels.searchItems,{gameId:'mhp3'}).total).toBe(7)
    expect(call(catalogChannels.getItem,{gameId:'mhp3',itemId:10})).toMatchObject({gameId:'mhp3',itemId:10})
    expect(call(catalogChannels.searchDecorations,{gameId:'mhp3'}).total).toBe(2)
    expect(call(catalogChannels.getDecoration,{gameId:'mhp3',itemId:825})).toMatchObject({gameId:'mhp3',itemId:825})
    expect(call(catalogChannels.getDecorationFacets,'mhp3').slots).toEqual([1])
    for(const payload of [{gameId:'mhp3',saveId:10},{gameId:'mhgu',itemId:10},{gameId:'mhp3',itemId:979},{gameId:'mhp3',itemId:10,saveId:10}]) expect(itemIdentitySchema.safeParse(payload).success).toBe(false)
    for(const channel of [catalogChannels.searchWeapons,catalogChannels.searchArmors,catalogChannels.searchSkills,catalogChannels.searchQuests,catalogChannels.searchMonsters]) expect(()=>call(channel,{gameId:'mhp3'})).toThrow()
    expect(itemCatalogFiltersSchema.safeParse({gameId:'mhp3',targetSaveId:10}).success).toBe(false)
    expect(itemCatalogFiltersSchema.safeParse({gameId:'mhgu',quantityKind:'infinite'}).success).toBe(false)
    expect(itemTermFiltersSchema.safeParse({gameId:'mhp3'}).success).toBe(true)
  })
})
