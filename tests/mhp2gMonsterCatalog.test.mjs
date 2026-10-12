import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { createMonsterFixture } from './fixtures/p2gMonsterCatalog.mjs'
import { auditMonsters } from '../tools/audit_mhp2g_monsters.mjs'
import { buildMonsterCatalog } from '../tools/build_mhp2g_monster_catalog.mjs'
import { P2gMonsterCatalogRepository } from '../api/catalog/p2gMonsterRepository'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { catalogIdentityRows, identityFingerprint } from '../api/terminology/catalogIdentity.mjs'
import { sha256 } from '../tools/mhp2g/sources.mjs'
const cleanups=[]
afterEach(()=>cleanups.splice(0).reverse().forEach(fn=>fn()))
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-monsters-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}));return createMonsterFixture(dir)}
describe('P2G monster pipeline',()=>{
  it('preserves native item identity, nulls, percent values and two-way relationships',()=>{
    const f=fixture(),before=sha256(f.base);buildMonsterCatalog(f)
    expect(auditMonsters({...f,delivery:f.output}).status).toBe('passed')
    const db=new Database(path.join(f.output,'mhp2g.sqlite')),base=new Database(f.base);cleanups.push(()=>db.close(),()=>base.close())
    const monsters=new P2gMonsterCatalogRepository(db),items=new P2gItemCatalogRepository(db),detail=monsters.getMonster(1)
    expect(detail.drops[0]).toMatchObject({quantity:null,probability:25,item:{gameId:'mhp2g',itemId:2}})
    expect(detail.drops[0].item).not.toHaveProperty('saveId')
    expect(detail.weakness[0]).toMatchObject({thunder:70,ice:60})
    expect(detail.ailments[0].applicable).toBeNull();expect(detail.traps[0].isEffective).toBeNull()
    expect(items.getItem({gameId:'mhp2g',itemId:2}).relations.find(r=>r.sourceKind==='monster')).toMatchObject({pendingTarget:null,relatedMonster:{monsterId:1,nameCn:'测试兽'}})
    for(const query of ['テスト獣','别名兽','test beast','0x1'])expect(monsters.searchMonsters({gameId:'mhp2g',query})).toHaveLength(1)
    expect(monsters.searchMonsters({gameId:'mhp2g',query:'测试材料甲'})[0].matchReason).toBe('命中：掉落道具·测试材料甲')
    expect(monsters.searchMonsters({gameId:'mhp2g',query:'試験任務'})[0].matchReason).toBe('命中：出没任务·試験任務')
    expect(items.searchItems({gameId:'mhp2g',query:'テスト獣'}).items[0]).toMatchObject({itemId:2,matchReason:'命中：来源怪物·测试兽'})
    expect(identityFingerprint(catalogIdentityRows(base,'mhp2g'))).toBe(identityFingerprint(catalogIdentityRows(db,'mhp2g')))
    expect(sha256(f.base)).toBe(before)
    const second=path.join(path.dirname(f.output),'again');buildMonsterCatalog({...f,output:second})
    expect(sha256(path.join(second,'mhp2g.sqlite'))).toBe(sha256(path.join(f.output,'mhp2g.sqlite')))
  })
  it.each(['quantity','probability','itemId','iconPath'])('rejects mismatched %s without installing output',field=>{
    const f=fixture()
    if(field==='iconPath')f.snapshot.monsters[0].iconPath='catalog/icons/wrong.png'
    else f.snapshot.monsters[0].drops[0][field]=field==='quantity'?1:999
    f.save();expect(()=>buildMonsterCatalog(f)).toThrow();expect(fs.existsSync(f.output)).toBe(false)
  })
  it('independent audit rejects silent reward changes even with a renewed file hash',()=>{
    const f=fixture();buildMonsterCatalog(f)
    const file=path.join(f.output,'mhp2g.sqlite'),db=new Database(file)
    db.exec('UPDATE catalog_monster_drops SET probability=75');db.close()
    const fileManifest=path.join(f.output,'manifest.json'),manifest=JSON.parse(fs.readFileSync(fileManifest))
    manifest.databaseSha256=sha256(file);fs.writeFileSync(fileManifest,JSON.stringify(manifest))
    expect(()=>auditMonsters({...f,delivery:f.output})).toThrow()
  })
  it('rejects overwrite and detects an item-only catalog with a recoverable error',()=>{
    const f=fixture(),db=new Database(f.base);cleanups.push(()=>db.close())
    expect(()=>new P2gMonsterCatalogRepository(db)).toThrow(/尚未安装/)
    buildMonsterCatalog(f);expect(()=>buildMonsterCatalog(f)).toThrow(/overwrite/)
  })
  it('verifies synthetic extraction and cross-source disagreement cases',()=>{
    for(const file of ['tests/mhp2gMonsterIcons.test.py','tests/mhp2gMonsterEvidence.test.py']){
      const run=spawnSync(process.platform==='win32'?'python':'python3',[file],{encoding:'utf8'})
      expect(run.status,run.stderr).toBe(0)
    }
  })
})
