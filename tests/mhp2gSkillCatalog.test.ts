import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach,describe,expect,it } from 'vitest'
// @ts-expect-error Synthetic ESM fixture.
import { createSkillFixture } from './fixtures/p2gSkillCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildSkillCatalog } from '../tools/build_mhp2g_skill_catalog.mjs'
import { P2gSkillCatalogRepository } from '../api/catalog/p2gSkillRepository'
import { p2gSkillEquipmentIdentitySchema,skillIdentitySchema } from '../api/catalog/schemas'
const cleanup:(()=>void)[]=[]
afterEach(()=>cleanup.splice(0).reverse().forEach(fn=>fn()))
function setup(build=true) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-skills-'));cleanup.push(()=>fs.rmSync(dir,{recursive:true,force:true}));const fixture=createSkillFixture(dir)
  if(build)buildSkillCatalog(fixture)
  return fixture
}
function open(file:string) {const db=new Database(file,{readonly:true});cleanup.push(()=>db.close());return db}
describe('P2G skills evidence and independent repository',()=>{
  it('builds deterministically, preserves existing quest/items, and refuses overwrite',()=>{
    const f=setup(),first=fs.readFileSync(path.join(f.output,'mhp2g.sqlite'));const second=buildSkillCatalog({...f,output:f.output+'-repeat'})
    expect(fs.readFileSync(path.join(f.output+'-repeat','mhp2g.sqlite')).equals(first)).toBe(true);expect(second.audit).toMatchObject({skills:3,activations:3,special:1,composites:1,points:4})
    expect(()=>buildSkillCatalog(f)).toThrow(/exists/i)
    const db=open(path.join(f.output,'mhp2g.sqlite'));expect(db.prepare('SELECT count(*) n FROM p2g_quests').get()).toEqual({n:3})
  })
  it.each(['base','endpoint','threshold','component','excluded','identity'])('rejects invalid %s without publishing output',(kind)=>{
    const f=setup(false)
    if(kind==='base')f.snapshot.inputs['base.sqlite']='bad'
    if(kind==='endpoint')f.snapshot.equipment[0].recipes[0].materials[0].itemId=60000
    if(kind==='threshold')f.snapshot.skills[0].activations[0].threshold=0
    if(kind==='component')f.snapshot.skills[1].activations[0].components[0].skillId=300
    if(kind==='excluded')f.snapshot.excludedNativeTextOrdinals.push(1)
    if(kind==='identity')f.snapshot.equipment[0].equipmentKey='armor_head:88'
    f.save();expect(()=>buildSkillCatalog(f)).toThrow();expect(fs.existsSync(f.output)).toBe(false)
  })
  it('searches Japanese, related equipment and composite effects with reasons',()=>{
    const f=setup(),repo=new P2gSkillCatalogRepository(open(path.join(f.output,'mhp2g.sqlite')))
    expect(repo.searchSkills({gameId:'mhp2g',query:'テスト珠'})).toMatchObject({total:2,items:expect.arrayContaining([expect.objectContaining({match:'命中：相关装饰品·测试珠'})])})
    expect(repo.searchSkills({gameId:'mhp2g',query:'测试头盔'}).total).toBe(2)
    expect(repo.searchSkills({gameId:'mhp2g',direction:'negative'}).total).toBe(1)
    expect(repo.searchSkills({gameId:'mhp2g',direction:'special'}).items[0].skillId).toBe(3)
    expect(repo.searchSkills({gameId:'mhp2g',source:'talisman'}).total).toBe(0)
    expect(repo.searchSkills({gameId:'mhgu'}).total).toBe(0)
    expect(repo.searchSkills({gameId:'mhp2g',targetSkillId:2,query:'no match'}).total).toBe(1)
    expect(repo.searchSkills({gameId:'mhp2g',pageSize:1,page:2})).toMatchObject({total:3,hasNext:true,items:[{skillId:2}]})
  })
  it('preserves null special threshold, signed points, recipe alternatives and itemId',()=>{
    const f=setup(),repo=new P2gSkillCatalogRepository(open(path.join(f.output,'mhp2g.sqlite')))
    expect(repo.getSkill(3)).toMatchObject({activations:[],p2g:{specialRule:{descriptionCn:'合成特殊规则，不使用阈值。'}}})
    expect(repo.getSkill(1)?.activations[0]).toMatchObject({dexActivationId:null,wikiDetail:{sourceVersion:'MHP2G'}})
    expect(repo.getSkill(2)?.activations[0].components[0]).toMatchObject({skillId:1})
    expect(repo.getEquipment('item:1')).toMatchObject({skills:[{points:2},{points:-1}],recipes:[{materials:[{item:{gameId:'mhp2g',itemId:2},quantity:2}]},{materials:[{item:{itemId:1}}]}]})
    expect(repo.getEquipment('missing')).toBeNull();expect(repo.getSkill(999)).toBeNull();expect(repo.getSkillFacets().sources).not.toContain('talisman')
  })
  it('reports recoverable old database state and rejects foreign identities',()=>{
    const f=setup(false);expect(()=>new P2gSkillCatalogRepository(open(f.base))).toThrow(/技能资料尚未安装/)
    expect(()=>skillIdentitySchema.parse({gameId:'mhp2g',skillId:1,saveId:1})).toThrow()
    expect(()=>p2gSkillEquipmentIdentitySchema.parse({gameId:'mhgu',equipmentKey:'item:1'})).toThrow()
    expect(()=>p2gSkillEquipmentIdentitySchema.parse({gameId:'mhp2g',equipmentKey:'../data'})).toThrow()
  })
})
