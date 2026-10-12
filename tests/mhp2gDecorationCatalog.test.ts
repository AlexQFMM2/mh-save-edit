import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Synthetic ESM fixture.
import { createDecorationFixture } from './fixtures/p2gDecorationCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildDecorationCatalog } from '../tools/build_mhp2g_decoration_catalog.mjs'
import { P2gDecorationCatalogRepository } from '../api/catalog/p2gDecorationRepository'
import { P2gSkillCatalogRepository } from '../api/catalog/p2gSkillRepository'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { decorationCatalogFiltersSchema, decorationIdentitySchema } from '../api/catalog/schemas'
const cleanup:(()=>void)[]=[]
afterEach(()=>cleanup.splice(0).reverse().forEach(fn=>fn()))
function setup(build=true) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-decorations-'));cleanup.push(()=>fs.rmSync(dir,{recursive:true,force:true}));const f=createDecorationFixture(dir);if(build)buildDecorationCatalog(f);return f}
function open(file:string) {const db=new Database(file,{readonly:true});cleanup.push(()=>db.close());return db}
describe('P2G decoration catalog',()=>{
  it('builds repeatably without altering prior domains and rejects overwrites',()=>{
    const f=setup();const first=fs.readFileSync(path.join(f.output,'mhp2g.sqlite')),repeat=buildDecorationCatalog({...f,output:f.output+'-repeat'})
    expect(repeat.audit).toMatchObject(f.expected);expect(fs.readFileSync(path.join(f.output+'-repeat','mhp2g.sqlite'))).toEqual(first)
    expect(()=>buildDecorationCatalog(f)).toThrow(/exists/i)
    const db=open(path.join(f.output,'mhp2g.sqlite'));expect(db.prepare('SELECT count(*) n FROM p2g_quests').get()).toEqual({n:3});expect(db.prepare('SELECT count(*) n FROM p2g_skills').get()).toEqual({n:3})
  })
  it.each(['fingerprint','quantity','missing','unmapped','identity'])('rejects %s evidence without publishing incomplete output',kind=>{
    const f=setup(false)
    if(kind==='fingerprint')f.baseSha256='bad'
    else {
      const db=new Database(f.base)
      if(kind==='quantity')db.exec("UPDATE catalog_item_relations SET quantity=99 WHERE usage_kind='decoration'")
      if(kind==='missing')db.exec("DELETE FROM catalog_item_relations WHERE usage_kind='decoration'")
      if(kind==='unmapped')db.exec("INSERT INTO catalog_item_relations(source_key,item_id,source_kind,usage_kind,target_name,quantity,metadata) VALUES('unknown',2,'decoration','decoration','Synthetic',1,'{}')")
      if(kind==='identity')db.exec("UPDATE p2g_skill_equipment SET detail_json=json_set(detail_json,'$.itemId',2) WHERE equipment_key='item:1'")
      db.close();f.baseSha256=undefined
    }
    expect(()=>buildDecorationCatalog(f)).toThrow();expect(fs.existsSync(f.output)).toBe(false)
  })
  it('searches Japanese, material and activation names with reasons and positive skill filters',()=>{
    const f=setup(),repo=new P2gDecorationCatalogRepository(open(path.join(f.output,'mhp2g.sqlite')))
    expect(repo.searchDecorations({gameId:'mhp2g',query:'テスト珠乙'})).toMatchObject({total:1,items:[{itemId:3}]})
    expect(repo.searchDecorations({gameId:'mhp2g',query:'测试材料甲'})).toMatchObject({total:2,items:expect.arrayContaining([expect.objectContaining({matchReason:'命中：制作材料·测试材料甲'})])})
    expect(repo.searchDecorations({gameId:'mhp2g',query:'テスト減少'}).items[0]).toMatchObject({itemId:1,matchReason:'命中：发动技能·测试减弱'})
    expect(repo.searchDecorations({gameId:'mhp2g',skillId:2,sort:'skillPoints'}).items.map(i=>i.itemId)).toEqual([3])
    expect(repo.searchDecorations({gameId:'mhp2g',slots:1}).total).toBe(1)
    expect(repo.searchDecorations({gameId:'mhp2g',query:'0x3'}).items[0].itemId).toBe(3)
    expect(repo.searchDecorations({gameId:'mhp2g',pageSize:1,page:2})).toMatchObject({total:2,hasNext:false,items:[{itemId:3}]})
    expect(repo.searchDecorations({gameId:'mhp2g',targetItemId:3,query:'unrelated',slots:1}).items[0].itemId).toBe(3)
    expect(repo.searchDecorations({gameId:'mhgu'}).total).toBe(0)
    expect(repo.getDecorationFacets()).toMatchObject({slots:[1,3],skills:expect.arrayContaining([expect.objectContaining({nameJp:'テスト系甲'})])})
  })
  it('preserves alternatives, signed points, null production cost, and native material identities',()=>{
    const f=setup(),db=open(path.join(f.output,'mhp2g.sqlite')),repo=new P2gDecorationCatalogRepository(db)
    const d=repo.getDecoration({gameId:'mhp2g',itemId:1})!
    expect(d).toMatchObject({itemId:1,itemSaveId:null,price:null,p2g:{buyPrice:100,craftingCost:null,rarity:null,unlockCondition:null}})
    expect(d.skills.map(s=>s.points)).toEqual([2,-1]);expect(d.materials.map(m=>m.recipeIndex)).toEqual([1,2]);expect(d.materials[0]).toMatchObject({gameId:'mhp2g',itemId:2,quantity:2});expect(d.materials[0]).not.toHaveProperty('saveId')
    expect(repo.getDecoration({gameId:'mhp2g',itemId:200})).toBeNull()
    expect(new P2gSkillCatalogRepository(db).getSkill(1)?.p2g?.equipment.find(e=>e.kind==='decoration')?.decorationItemId).toBe(1)
  })
  it('links every old material usage and reverses searches to items',()=>{
    const f=setup(),db=open(path.join(f.output,'mhp2g.sqlite')),items=new P2gItemCatalogRepository(db)
    const material=items.getItem({gameId:'mhp2g',itemId:2})!
    expect(material.relations.filter(r=>r.usageKind==='decoration')).toEqual(expect.arrayContaining([expect.objectContaining({relatedDecoration:{gameId:'mhp2g',itemId:1,nameCn:'测试珠'},pendingTarget:null})]))
    expect(items.getItem({gameId:'mhp2g',itemId:1})?.decoration).toEqual({gameId:'mhp2g',itemId:1})
    expect(items.searchItems({gameId:'mhp2g',query:'テスト珠乙'}).items.find(i=>i.gameId==='mhp2g'&&i.itemId===2)?.matchReason).toBe('命中：装饰品材料·乙合成珠')
  })
  it('retains old skill database behavior and rejects cross-game identities',()=>{
    const f=setup(false),db=open(f.base)
    expect(()=>new P2gDecorationCatalogRepository(db)).toThrow(/装饰品资料尚未安装/)
    expect(new P2gSkillCatalogRepository(db).getEquipment('item:1')).not.toHaveProperty('decorationItemId')
    expect(decorationIdentitySchema.parse({gameId:'mhp2g',itemId:1})).toEqual({gameId:'mhp2g',itemId:1})
    for(const identity of [{gameId:'mhp2g',saveId:1},{gameId:'mhgu',itemId:1},{gameId:'mhp2g',itemId:1,saveId:1}])expect(()=>decorationIdentitySchema.parse(identity)).toThrow()
    expect(()=>decorationCatalogFiltersSchema.parse({gameId:'mhp2g',targetSaveId:1})).toThrow();expect(()=>decorationCatalogFiltersSchema.parse({gameId:'mhgu',targetItemId:1})).toThrow()
  })
})
