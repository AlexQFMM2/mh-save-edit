import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
import { auditCatalog } from '../tools/audit_mhp2g_catalog.mjs'
import { sha256 } from '../tools/mhp2g/sources.mjs'
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
const dirs=[]
afterEach(()=>{for(const dir of dirs.splice(0))fs.rmSync(dir,{recursive:true,force:true})})
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-builder-'));dirs.push(dir);const source=path.join(dir,'source.sqlite');createP2gSource(source);return{dir,source,output:path.join(dir,'output'),expectedSha256:sha256(source)}}
describe('P2G item conversion',()=>{
  it('preserves native identities, unknowns, ranges and reviewed relations deterministically',()=>{
    const f=fixture(), result=buildCatalog(f)
    expect(result.items).toBe(4)
    expect(auditCatalog({...f,delivery:f.output}).status).toBe('passed')
    const db=new Database(path.join(f.output,'mhp2g.sqlite'),{readonly:true})
    expect(db.prepare('SELECT save_id,dex_id,rarity,name_en FROM catalog_items WHERE item_id=1').get()).toEqual({save_id:null,dex_id:null,rarity:null,name_en:''})
    expect(db.prepare("SELECT quantity,probability FROM catalog_item_relations WHERE source_key='recipe:1:0:1'").get()).toEqual({quantity:null,probability:75})
    expect(db.prepare("SELECT count(*) n FROM catalog_item_relations WHERE source_key LIKE 'gathering:line:2%'").get().n).toBe(0)
    expect(db.prepare("SELECT metadata FROM catalog_item_relations WHERE source_kind='shop'").get().metadata).toContain('12 z')
    db.close()
    const moved=path.join(f.dir,'moved.sqlite');fs.copyFileSync(f.source,moved)
    const output=path.join(f.dir,'second');buildCatalog({...f,source:moved,output})
    for(const name of ['mhp2g.sqlite','manifest.json','audit.json'])expect(fs.readFileSync(path.join(output,name)).equals(fs.readFileSync(path.join(f.output,name)))).toBe(true)
    expect(sha256(f.source)).toBe(f.expectedSha256)
  })
  it('rejects source changes, dangling endpoints and overwrites without a published output',()=>{
    const f=fixture()
    expect(()=>buildCatalog({...f,expectedSha256:'wrong'})).toThrow(/fingerprint/)
    expect(fs.existsSync(f.output)).toBe(false)
    buildCatalog(f);expect(()=>buildCatalog(f)).toThrow(/overwrite/)
    const db=new Database(f.source);db.prepare('DELETE FROM native_item_catalog WHERE item_id=3').run();db.close()
    const output=path.join(f.dir,'invalid')
    expect(()=>buildCatalog({...f,output,expectedSha256:sha256(f.source)})).toThrow(/Dangling/)
    expect(fs.existsSync(output)).toBe(false)
  })
  it('independent audit rejects valid-SQLite recipe mutation even with an updated manifest',()=>{
    const f=fixture();buildCatalog(f)
    const file=path.join(f.output,'mhp2g.sqlite'),db=new Database(file)
    db.exec("UPDATE catalog_item_relations SET probability=1 WHERE source_kind='combination' AND probability IS NOT NULL");db.close()
    const manifestFile=path.join(f.output,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));manifest.databaseSha256=sha256(file);fs.writeFileSync(manifestFile,JSON.stringify(manifest))
    expect(()=>auditCatalog({...f,delivery:f.output})).toThrow()
  })
})
