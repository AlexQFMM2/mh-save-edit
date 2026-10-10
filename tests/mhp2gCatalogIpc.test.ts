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
  it('reports a missing runtime database instead of manufacturing empty catalog data',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-missing-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}));cleanups.push(registerCatalogIpc(dir))
    expect(()=>handlers.get(catalogChannels.searchItems)!(null,{gameId:'mhp2g'})).toThrow()
  })
})
