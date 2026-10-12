// @ts-expect-error Synthetic ESM fixture.
import { createDecorationFixture } from './fixtures/p2gDecorationCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildDecorationCatalog } from '../tools/build_mhp2g_decoration_catalog.mjs'
// @ts-expect-error Synthetic ESM fixture.
import { createSkillFixture } from './fixtures/p2gSkillCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildSkillCatalog } from '../tools/build_mhp2g_skill_catalog.mjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// @ts-expect-error Shared synthetic JavaScript fixture.
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
// @ts-expect-error Native ESM build tooling.
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
// @ts-expect-error Native ESM build tooling.
import { sha256 } from '../tools/mhp2g/sources.mjs'
// @ts-expect-error Synthetic JavaScript fixture.
import { createMonsterFixture } from './fixtures/p2gMonsterCatalog.mjs'
// @ts-expect-error Native ESM build tooling.
import { buildMonsterCatalog } from '../tools/build_mhp2g_monster_catalog.mjs'
// @ts-expect-error Synthetic JavaScript fixture.
import { createQuestFixture } from './fixtures/p2gQuestCatalog.mjs'
// @ts-expect-error Native ESM build tooling.
import { buildQuestCatalog } from '../tools/build_mhp2g_quest_catalog.mjs'
const handlers=vi.hoisted(()=>new Map<string,(event:unknown,payload:unknown)=>any>())
vi.mock('electron',()=>({ipcMain:{handle:(name:string,fn:(event:unknown,payload:unknown)=>any)=>handlers.set(name,fn),removeHandler:(name:string)=>handlers.delete(name)}}))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanups:(()=>void)[]=[]
afterEach(()=>{cleanups.splice(0).reverse().forEach(fn=>fn());handlers.clear()})
describe('P2G production IPC handler dispatch (no Electron launch)',()=>{
  it('opens an item-only database without instantiating other catalogs and rejects legacy identities',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-ipc-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
    const source=path.join(dir,'source.sqlite'),output=path.join(dir,'runtime');createP2gSource(source);buildCatalog({source,output,expectedSha256:sha256(source)})
    cleanups.push(registerCatalogIpc(output))
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(invoke(catalogChannels.searchItems,{gameId:'mhp2g'}).total).toBe(3)
    expect(invoke(catalogChannels.getItem,{gameId:'mhp2g',itemId:1})).toMatchObject({itemId:1,nameEn:'',dexId:null})
    expect(invoke(catalogChannels.getItemFacets,'mhp2g').maxStacks).toEqual([10])
    expect(()=>invoke(catalogChannels.getItem,{gameId:'mhp2g',saveId:1})).toThrow()
    expect(()=>invoke(catalogChannels.searchWeapons,{gameId:'mhp2g'})).toThrow()
    expect(()=>invoke(catalogChannels.searchSkills,{gameId:'mhp2g'})).toThrow()
  })
  it('dispatches native P2G monsters without requiring the other three databases',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-monster-ipc-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
    const f=createMonsterFixture(dir);buildMonsterCatalog(f);cleanups.push(registerCatalogIpc(f.output))
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(invoke(catalogChannels.searchMonsters,{gameId:'mhp2g',query:'テスト獣'})).toHaveLength(1)
    expect(invoke(catalogChannels.getMonster,{gameId:'mhp2g',monsterId:1}).drops[0].item).toMatchObject({itemId:2})
    expect(invoke(catalogChannels.getMonsterFacets,'mhp2g').monsterCount).toBe(1)
    expect(()=>invoke(catalogChannels.getItem,{gameId:'mhp2g',saveId:2})).toThrow()
    expect(()=>invoke(catalogChannels.getQuest,{gameId:'mhp2g',questKey:'wiki:9:0:1'})).toThrow(/任务资料尚未安装/)
  })
  it('dispatches P2G quests and facets, resolves old references, and isolates identities',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-quest-ipc-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
    const f=createQuestFixture(dir);buildQuestCatalog(f);cleanups.push(registerCatalogIpc(f.output))
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(invoke(catalogChannels.searchQuests,{gameId:'mhp2g'}).total).toBe(3)
    expect(invoke(catalogChannels.getQuest,{gameId:'mhp2g',questKey:'wiki:9:0:1'}).rewards[0].item).toMatchObject({itemId:2})
    expect(invoke(catalogChannels.getQuestFacets,'mhp2g').systems).toHaveLength(2)
    expect(()=>invoke(catalogChannels.getQuest,{gameId:'mhgu',questKey:'mhp2g:q1'})).toThrow()
  })
  it('dispatches P2G skills, native equipment keys and full material identities',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-skill-ipc-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
    const f=createSkillFixture(dir);buildSkillCatalog(f);cleanups.push(registerCatalogIpc(f.output))
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(invoke(catalogChannels.searchSkills,{gameId:'mhp2g'}).total).toBe(3)
    expect(invoke(catalogChannels.getSkill,{gameId:'mhp2g',skillId:3}).p2g.specialRule).toBeTruthy()
    expect(invoke(catalogChannels.getSkillFacets,'mhp2g').sources).toEqual(['armor','decoration'])
    expect(invoke(catalogChannels.getP2gSkillEquipment,{gameId:'mhp2g',equipmentKey:'item:1'}).recipes[0].materials[0].item).toMatchObject({gameId:'mhp2g',itemId:2})
    expect(()=>invoke(catalogChannels.getP2gSkillEquipment,{gameId:'mhgu',equipmentKey:'item:1'})).toThrow()
    expect(invoke(catalogChannels.searchQuests,{gameId:'mhp2g'}).total).toBe(3)
  })
  it('dispatches P2G decorations with native identity and full linked materials',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-decoration-ipc-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
    const f=createDecorationFixture(dir);buildDecorationCatalog(f);cleanups.push(registerCatalogIpc(f.output))
    const invoke=(channel:string,payload:unknown)=>handlers.get(channel)!(null,payload)
    expect(invoke(catalogChannels.searchDecorations,{gameId:'mhp2g',query:'テスト珠乙'})).toMatchObject({total:1,items:[{itemId:3}]})
    expect(invoke(catalogChannels.getDecoration,{gameId:'mhp2g',itemId:1}).materials[0]).toMatchObject({gameId:'mhp2g',itemId:2})
    expect(invoke(catalogChannels.getDecorationFacets,'mhp2g').slots).toEqual([1,3])
    expect(invoke(catalogChannels.getItem,{gameId:'mhp2g',itemId:1}).decoration).toEqual({gameId:'mhp2g',itemId:1})
    expect(()=>invoke(catalogChannels.getDecoration,{gameId:'mhp2g',saveId:1})).toThrow()
    expect(()=>invoke(catalogChannels.getDecoration,{gameId:'mhgu',itemId:1})).toThrow()
    expect(invoke(catalogChannels.searchSkills,{gameId:'mhp2g'}).total).toBe(3)
  })
  it('reports a missing runtime database instead of manufacturing empty catalog data',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-missing-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}));cleanups.push(registerCatalogIpc(dir))
    expect(()=>handlers.get(catalogChannels.searchItems)!(null,{gameId:'mhp2g'})).toThrow()
  })
})
