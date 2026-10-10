import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { itemIdentitySchema, itemCatalogFiltersSchema, gameIdSchema, decorationIdentitySchema, catalogGameIdSchema } from '../api/catalog/schemas'
// @ts-expect-error Synthetic fixture helper is shared with Node builder tests.
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
// @ts-expect-error Build tooling runs as native ESM JavaScript.
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
// @ts-expect-error Build tooling runs as native ESM JavaScript.
import { sha256 } from '../tools/mhp2g/sources.mjs'
const cleanup: (()=>void)[]=[]
afterEach(()=>cleanup.splice(0).reverse().forEach(fn=>fn()))
function repository(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-repo-'));cleanup.push(()=>fs.rmSync(dir,{recursive:true,force:true}));const source=path.join(dir,'input.sqlite'),output=path.join(dir,'output');createP2gSource(source);buildCatalog({source,output,expectedSha256:sha256(source)});const db=new Database(path.join(output,'mhp2g.sqlite'));cleanup.push(()=>db.close());return {repo:new P2gItemCatalogRepository(db),db}}
describe('P2G item identity and repository contract',()=>{
  it('accepts native item identities only, without widening other game domains',()=>{
    expect(itemIdentitySchema.parse({gameId:'mhp2g',itemId:1})).toEqual({gameId:'mhp2g',itemId:1})
    for(const value of [{gameId:'mhp2g',saveId:1},{gameId:'mhp2g',itemId:1,saveId:1},{gameId:'mh3g',itemId:1},{gameId:'mhp2g',itemId:-1}])expect(itemIdentitySchema.safeParse(value).success).toBe(false)
    expect(catalogGameIdSchema.safeParse('mhp2g').success).toBe(true)
    expect(gameIdSchema.safeParse('mhp2g').success).toBe(false)
    expect(decorationIdentitySchema.safeParse({gameId:'mhp2g',saveId:1}).success).toBe(false)
    expect(itemCatalogFiltersSchema.safeParse({gameId:'mhp2g',targetSaveId:1}).success).toBe(false)
    expect(itemCatalogFiltersSchema.safeParse({gameId:'mh3g',targetItemId:1}).success).toBe(false)
  })
  it('searches both confirmed languages and native numbers with filtering and pagination',()=>{
    const {repo}=repository()
    expect(repo.searchItems({gameId:'mhp2g'}).total).toBe(3)
    expect(repo.searchItems({gameId:'mhp2g',includePlaceholders:true}).total).toBe(4)
    for(const query of ['测试成品','テスト品','1'])expect(repo.searchItems({gameId:'mhp2g',query}).items[0]).toMatchObject({itemId:1,gameId:'mhp2g'})
    expect(repo.searchItems({gameId:'mhp2g',sourceKinds:['shop'],pageSize:1}).items[0]).toMatchObject({itemId:2})
    expect(repo.searchItems({gameId:'mhp2g',page:2,pageSize:1}).items).toHaveLength(1)
    expect(repo.searchItems({gameId:'mhp2g',query:'不存在'}).total).toBe(0)
    expect(repo.getItemFacets()).toMatchObject({rarities:[],maxStacks:[10]})
  })
  it('returns full item identities, unknowns and pending cross-catalog details',()=>{
    const {repo}=repository(),item=repo.getItem({gameId:'mhp2g',itemId:1})!
    expect(item).not.toHaveProperty('saveId')
    expect(item).toMatchObject({rarity:null,dexId:null,nameEn:'',description:'第一行\n第二行'})
    expect(item.relations[0].relatedItems.map(i=>i.gameId==='mhp2g'?i.itemId:null)).toEqual([2,3])
    expect(item.relations[0].quantity).toBeNull()
    const ingredient=repo.getItem({gameId:'mhp2g',itemId:2})!
    expect(ingredient.relations.find(r=>r.sourceKind==='weapon')?.pendingTarget).toEqual({kind:'weapon',name:'测试武器'})
    expect(ingredient.relations.find(r=>r.sourceKind==='quest')?.probability).toBeNull()
    expect(repo.getItem({gameId:'mhp2g',itemId:999})).toBeNull()
  })
  it('rejects a wrong schema or missing required table',()=>{
    const {db}=repository();db.exec('DROP TABLE catalog_item_relation_targets')
    expect(()=>new P2gItemCatalogRepository(db)).toThrow(/缺少字段/)
    db.exec("UPDATE meta SET value='unknown' WHERE key='catalog_schema'")
    expect(()=>new P2gItemCatalogRepository(db)).toThrow(/版本/)
  })
})
