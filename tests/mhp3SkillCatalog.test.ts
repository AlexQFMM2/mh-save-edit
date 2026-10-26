import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { p3SkillFixture } from './fixtures/p3SkillCatalog'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'
import { P3SkillCatalogRepository } from '../api/catalog/p3SkillRepository'
import { armorIdentitySchema, p3SkillArmorIdentitySchema, skillIdentitySchema } from '../api/catalog/schemas'
const handlers=vi.hoisted(()=>new Map<string,(event:unknown,payload:unknown)=>any>())
vi.mock('electron',()=>({ipcMain:{handle:(name:string,fn:(event:unknown,payload:unknown)=>any)=>handlers.set(name,fn),removeHandler:(name:string)=>handlers.delete(name)}}))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanups:(()=>void)[]=[]
afterEach(()=>{cleanups.splice(0).reverse().forEach(fn=>fn());handlers.clear()})
function fixture(){const db=p3SkillFixture();cleanups.push(()=>db.close());const jewels=new P3DecorationCatalogRepository(db,new P3ItemCatalogRepository(db));return {db,repo:new P3SkillCatalogRepository(db,jewels)}}
describe('P3 native skill read model',()=>{
  it('separates identities, same-name armors, signed points and torso-copy markers',()=>{
    const {db,repo}=fixture(),s=repo.getSkill(2)!
    expect(s.armors).toHaveLength(2);expect(s.armors.map(a=>a.points)).toEqual([-2,1])
    expect(s.armors[0]).toMatchObject({gameId:'mhp3',armorKey:'mhp3:armor:4:1'});expect(s.armors[0]).not.toHaveProperty('dexId')
    expect(s.decorations[0]).toMatchObject({gameId:'mhp3',itemId:825,points:-1});expect(s.decorations[0]).not.toHaveProperty('saveId')
    expect(repo.getSkill(1)).toMatchObject({activations:[],specialRule:{descriptionCn:'测试复制含胴部装饰品'}})
    expect(repo.getArmor('mhp3:armor:4:2')?.skills[0]).toMatchObject({kind:'torso-copy-marker',nameCn:'复制测试'})
    expect(()=>db.prepare('INSERT INTO p3_armor_skill_points VALUES(?,?,?,?)').run('mhp3:armor:4:2',3,0,'signed-points')).toThrow()
    expect(()=>repo.getArmor('mhp3:armor:0:999')).toThrow();expect(repo.getSkill(999)).toBeNull()
  })
  it('searches multilingual names, explanations, aliases and related names with reasons',()=>{
    const {repo}=fixture()
    for(const query of ['Negative','テスト2','测试别称2','测试发动2','独立测试说明2','0x2'])expect(repo.searchSkills({gameId:'mhp3',query}).items.some(s=>s.skillId===2)).toBe(true)
    for(const [query,reason] of [['合成防具','相关防具'],['同名珠','相关装饰品'],['审定旧称','相关装饰品'],['合成赠品','相关护石']])expect(repo.searchSkills({gameId:'mhp3',query}).items[0].match).toContain(reason)
    expect(repo.searchSkills({gameId:'mhp3',direction:'negative'}).items.map(s=>s.skillId)).toEqual([2])
    expect(repo.searchSkills({gameId:'mhp3',direction:'special'}).items.map(s=>s.skillId)).toEqual([1])
    expect(repo.searchSkills({gameId:'mhp3',query:'no match',direction:'negative',targetSkillId:3}).items.map(s=>s.skillId)).toEqual([3])
    expect(repo.searchSkills({gameId:'mhp3',page:2,pageSize:2})).toMatchObject({total:3,hasNext:false,items:[{skillId:3}]})
    expect(repo.getSkill(2)?.p3?.charmSources.map(s=>s.sourceKind)).toEqual(['random-pool','special-gift']);expect(repo.getSkill(2)?.talismans).toEqual([])
  })
  it('supports the armor domain identity and rejects identity contamination',()=>{
    expect(skillIdentitySchema.parse({gameId:'mhp3',skillId:1})).toBeTruthy()
    for(const value of [{gameId:'mhp3',armorKey:'mhp3:armor:5:1'},{gameId:'mhp2g',armorKey:'mhp3:armor:4:1'},{gameId:'mhp3',armorKey:'mhp3:armor:4:1',dexId:1}])expect(p3SkillArmorIdentitySchema.safeParse(value).success).toBe(false)
    expect(armorIdentitySchema.safeParse({gameId:'mhp3',armorKey:'mhp3:armor:4:1'}).success).toBe(true)
    expect(()=>fixture().repo.searchSkills({gameId:'mhgu'})).toThrow(/不匹配/)
  })
  it('dispatches P3 skill and minimal armor IPC lazily and keeps other catalog scopes closed',()=>{
    const dir=mkdtempSync(join(tmpdir(),'p3-skills-'));cleanups.push(()=>rmSync(dir,{recursive:true,force:true}));p3SkillFixture(join(dir,'mhp3.sqlite')).close();cleanups.push(registerCatalogIpc(dir))
    const call=(channel:string,p:unknown)=>handlers.get(channel)!(null,p)
    expect(call(catalogChannels.searchSkills,{gameId:'mhp3'}).total).toBe(3)
    expect(call(catalogChannels.getSkill,{gameId:'mhp3',skillId:2}).nameCn).toBe('负向技能')
    expect(call(catalogChannels.getSkillFacets,'mhp3').directions).toContain('special')
    expect(call(catalogChannels.getP3SkillArmor,{gameId:'mhp3',armorKey:'mhp3:armor:4:1'}).nativeId).toBe(1)
    expect(()=>call(catalogChannels.searchArmors,{gameId:'mhp3'})).toThrow()
  })
  it('reports missing skill installation while keeping original items and jewels available',()=>{
    const dir=mkdtempSync(join(tmpdir(),'p3-missing-'));cleanups.push(()=>rmSync(dir,{recursive:true,force:true}));p3ItemFixture(join(dir,'mhp3.sqlite')).close();cleanups.push(registerCatalogIpc(dir))
    const call=(channel:string,p:unknown)=>handlers.get(channel)!(null,p)
    expect(()=>call(catalogChannels.searchSkills,{gameId:'mhp3'})).toThrow(/技能资料尚未安装/)
    expect(call(catalogChannels.searchItems,{gameId:'mhp3'}).total).toBe(7)
    expect(call(catalogChannels.searchDecorations,{gameId:'mhp3'}).total).toBe(2)
  })
})
