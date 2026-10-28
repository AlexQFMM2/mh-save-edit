import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { p3WeaponFixture } from './fixtures/p3WeaponCatalog'
import { p3ArmorFixture } from './fixtures/p3ArmorCatalog'
import { P3WeaponCatalogRepository } from '../api/catalog/p3WeaponRepository'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { weaponIdentitySchema, weaponCatalogFiltersSchema, weaponTreeRequestSchema, catalogGameIdSchema } from '../api/catalog/schemas'
const handlers=vi.hoisted(()=>new Map<string,(event:unknown,payload:unknown)=>any>())
vi.mock('electron',()=>({ipcMain:{handle:(name:string,fn:any)=>handlers.set(name,fn),removeHandler:(name:string)=>handlers.delete(name)}}))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanups:(()=>void)[]=[]
afterEach(()=>{cleanups.splice(0).reverse().forEach(fn=>fn());handlers.clear()})
function fixture(){const db=p3WeaponFixture();cleanups.push(()=>db.close());return {db,repo:new P3WeaponCatalogRepository(db)}}
describe('P3 weapon content domain',()=>{
  it('bounds all native identities and rejects foreign, mixed and save identities',()=>{
    for(const key of ['mhp3:weapon:5:91','mhp3:weapon:9:66','mhp3:weapon:17:85'])expect(weaponIdentitySchema.safeParse({gameId:'mhp3',weaponKey:key}).success).toBe(true)
    for(const key of ['mhp3:weapon:5:92','mhp3:weapon:10:1','mhp3:weapon:9:67','mhp3:weapon:17:0','weapon_ranged:1'])expect(weaponIdentitySchema.safeParse({gameId:'mhp3',weaponKey:key}).success).toBe(false)
    for(const value of [{gameId:'mhp2g',weaponKey:'mhp3:weapon:5:1'},{gameId:'mhp3',weaponKey:'mhp3:weapon:5:1',saveId:1}])expect(weaponIdentitySchema.safeParse(value).success).toBe(false)
    expect(catalogGameIdSchema.safeParse('mhp3').success).toBe(false)
    expect(weaponTreeRequestSchema.safeParse({gameId:'mhp3',weaponTypeId:10}).success).toBe(false)
    expect(weaponCatalogFiltersSchema.safeParse({gameId:'mhp3',sort:'saveId'}).success).toBe(false)
    const {repo}=fixture();expect(()=>repo.searchWeapons({gameId:'mhgu'} as never)).toThrow();expect(()=>repo.getWeapon({gameId:'mhp2g',weaponKey:'mhp3:weapon:5:1'} as never)).toThrow()
  })
  it('keeps base sorting independent of boosts, signed affinity and all acquisition scopes',()=>{
    const {repo}=fixture();expect(repo.getWeaponFacets().weaponTypes).toHaveLength(12)
    const normal=repo.searchWeapons({gameId:'mhp3',weaponTypeId:1,sort:'attack',direction:'desc'})
    expect(normal.items.map(w=>w.nativeId)).toEqual([2,1]);expect(normal.items[0].affinity).toBe(-15)
    expect(repo.searchWeapons({gameId:'mhp3',scope:'special'}).total).toBe(1)
    expect(repo.searchWeapons({gameId:'mhp3',scope:'unknown'}).total).toBe(1)
    expect(repo.searchWeapons({gameId:'mhp3',targetWeaponKey:'mhp3:weapon:5:4'}).total).toBe(1)
    expect(repo.getWeapon({gameId:'mhp3',weaponKey:'mhp3:weapon:5:91'})).toBeNull()
    expect(normal.items[0]).not.toHaveProperty('saveId');expect(normal.items[0]).not.toHaveProperty('boost')
  })
  it('preserves alternative recipes, unknown appraisal quantities, return and cross-type graph edges',()=>{
    const {repo}=fixture();const w=repo.getWeapon({gameId:'mhp3',weaponKey:'mhp3:weapon:5:1'})!
    expect(w.recipes.map(r=>r.kind)).toEqual(['production','production','appraisal'])
    expect(w.recipes[2]).toMatchObject({cost:null,materials:[{quantity:null}]})
    expect(w.recipes[0].byproducts[0].itemId).toBe(30)
    const tree=repo.getWeaponTree(1);expect(tree.edges).toHaveLength(3);expect(tree.nodes.find(w=>w.typeId===2)?.isCrossType).toBe(true)
    expect(tree.edges.some(e=>e.childWeaponKey==='mhp3:weapon:5:1')).toBe(true)
  })
  it('searches material aliases and reverses boost, recipe, ammo and coating links without making unavailable ammo usable',()=>{
    const {repo,db}=fixture();const items=new P3ItemCatalogRepository(db)
    expect(repo.searchWeapons({gameId:'mhp3',query:'6'}).total).toBe(0)
    for(const query of ['合成别名','テスト5_1','0x1'])expect(repo.searchWeapons({gameId:'mhp3',query}).total).toBeGreaterThan(0)
    expect(repo.searchWeapons({gameId:'mhp3',query:'测试材料'}).items[0].matchReason).toContain('材料')
    expect(items.getItem({gameId:'mhp3',itemId:10})?.p3.weaponRecipes).toHaveLength(1)
    expect(items.getItem({gameId:'mhp3',itemId:94})?.p3.weaponUsages).toHaveLength(2)
    expect(items.getItem({gameId:'mhp3',itemId:30})?.p3.weaponUsages).toHaveLength(0)
    expect(items.searchItems({gameId:'mhp3',query:'合成别名',usageKinds:['weapon']}).items[0].matchReason).toContain('相关武器')
    const w=repo.getWeapon({gameId:'mhp3',weaponKey:'mhp3:weapon:11:1'})!
    expect(w.special.kind==='bowgun'&&w.special.ammo[1]).toMatchObject({available:false,requiresSkill:true,capacity:null,skillCapacity:2,item:{gameId:'mhp3',itemId:20}})
  })
  it('uses all four IPC channels, and leaves armor-only libraries usable with a clear weapon error',()=>{
    const dir=mkdtempSync(join(tmpdir(),'p3-weapons-'));cleanups.push(()=>rmSync(dir,{recursive:true,force:true}));p3WeaponFixture(join(dir,'mhp3.sqlite')).close();cleanups.push(registerCatalogIpc(dir))
    const call=(c:string,p:unknown)=>handlers.get(c)!(null,p)
    expect(call(catalogChannels.searchWeapons,{gameId:'mhp3'}).total).toBe(13)
    expect(call(catalogChannels.getWeapon,{gameId:'mhp3',weaponKey:'mhp3:weapon:5:1'}).gameId).toBe('mhp3')
    expect(call(catalogChannels.getWeaponFacets,'mhp3').weaponTypes).toHaveLength(12)
    expect(call(catalogChannels.getWeaponTree,{gameId:'mhp3',weaponTypeId:1}).edges).toHaveLength(3)
    const old=p3ArmorFixture();cleanups.push(()=>old.close());expect(()=>new P3WeaponCatalogRepository(old)).toThrow('武器资料尚未安装');expect(new P3ItemCatalogRepository(old).getItem({gameId:'mhp3',itemId:10})?.p3.coverage.weapon).toBe('not-collected')
  })
})
