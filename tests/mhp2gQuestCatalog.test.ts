import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
// @ts-expect-error Synthetic JS fixture.
import { createQuestFixture } from './fixtures/p2gQuestCatalog.mjs'
// @ts-expect-error ESM build tooling.
import { buildQuestCatalog } from '../tools/build_mhp2g_quest_catalog.mjs'
import { P2gQuestCatalogRepository } from '../api/catalog/p2gQuestRepository'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { P2gMonsterCatalogRepository } from '../api/catalog/p2gMonsterRepository'
import { questIdentitySchema, questCatalogFiltersSchema } from '../api/catalog/schemas'
const cleanups:(()=>void)[]=[]
afterEach(()=>cleanups.splice(0).reverse().forEach(fn=>fn()))
function setup() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-quest-'));cleanups.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
  const f=createQuestFixture(dir);buildQuestCatalog(f)
  const db=new Database(path.join(f.output,'mhp2g.sqlite'),{readonly:true});cleanups.push(()=>db.close())
  return {dir,f,db,repository:new P2gQuestCatalogRepository(db)}
}
describe('P2G quest builder, repository and identities',()=>{
  it('builds deterministically and refuses invalid endpoints without publishing partial output',()=>{
    const {dir,f}=setup(),copy=path.join(dir,'copy');buildQuestCatalog({...f,output:copy})
    expect(fs.readFileSync(path.join(copy,'mhp2g.sqlite'))).toEqual(fs.readFileSync(path.join(f.output,'mhp2g.sqlite')))
    expect(()=>buildQuestCatalog(f)).toThrow(/Output exists/)
    f.snapshot.quests[0].rewards[0].itemId=9999;f.save()
    const broken=path.join(dir,'broken');expect(()=>buildQuestCatalog({...f,output:broken})).toThrow(/endpoint/)
    expect(fs.existsSync(broken)).toBe(false)
    const verification=new Database(path.join(copy,'mhp2g.sqlite'),{readonly:true});expect(verification.pragma('integrity_check',{simple:true})).toBe('ok');verification.close()
  })
  it('supports all filters, aliases, bilingual and linked searches with reasons',()=>{
    const {repository:r}=setup()
    expect(r.searchQuests({gameId:'mhp2g',pageSize:1}).hasNext).toBe(true)
    expect(r.searchQuests({gameId:'mhp2g',query:'テスト任務甲'}).items.map(q=>q.questKey)).toEqual(['mhp2g:q1','mhp2g:q2'])
    expect(r.searchQuests({gameId:'mhp2g',query:'甲测试任务'}).items[1].match?.reason).toContain('关联任务')
    expect(r.searchQuests({gameId:'mhp2g',query:'测试兽'}).items[0].match?.reason).toContain('出现怪物')
    expect(r.searchQuests({gameId:'mhp2g',query:'测试区域',rank:'low',system:'village',keyStatus:'urgent'}).items.map(q=>q.questKey)).toEqual(['mhp2g:q2'])
    expect(r.searchQuests({gameId:'mhp2g',targetQuestKey:'wiki:9:0:1'}).items[0].questKey).toBe('mhp2g:q1')
    expect(r.getQuestFacets().systems.map(s=>s.key)).toContain('event')
  })
  it('preserves native item identities, nulls, condition trees and reverse relations',()=>{
    const {repository:r,db}=setup(),q=r.getQuest('wiki:9:0:1')!,wiki=r.getQuest('wiki:9:0:2')!
    expect(q.rewards[0].item).toMatchObject({gameId:'mhp2g',itemId:2});expect(q.rewards[0].item).not.toHaveProperty('saveId')
    expect(q.p2g?.supplies?.[0].item.itemId).toBe(1);expect(q.relations[0].direction).toBe('unlocks')
    expect(r.getQuest('mhp2g:q2')?.p2g?.condition.kind).toBe('any')
    expect(wiki.rewards[0]).toMatchObject({quantity:null,probability:null});expect(wiki.p2g?.supplies).toBeNull()
    expect(new P2gItemCatalogRepository(db).searchItems({gameId:'mhp2g',query:'甲测试任务',sourceKinds:['quest']}).items[0].matchReason).toContain('来源任务')
    expect(new P2gItemCatalogRepository(db).getItem({gameId:'mhp2g',itemId:2})?.relations.some(r=>r.relatedQuest?.questKey==='mhp2g:q1')).toBe(true)
    const monsters=new P2gMonsterCatalogRepository(db)
    expect(monsters.searchMonsters({gameId:'mhp2g',query:'甲测试任务'})[0].matchReason).toContain('出没任务')
    expect(monsters.getMonster(1)?.p2gQuests?.[0]).toMatchObject({questKey:'mhp2g:q1',fields:[{label:'体力',value:'123'}],linked:true})
  })
  it('rejects cross-game quest keys for both detail and target search',()=>{
    for(const [gameId,questKey] of [['mhp2g','dex:1'],['mh3g','mhp2g:q1'],['mh4g','wiki:9:0:2'],['mh3g','mhgu:q0000001']]) {
      expect(questIdentitySchema.safeParse({gameId,questKey}).success).toBe(false)
      expect(questCatalogFiltersSchema.safeParse({gameId,targetQuestKey:questKey}).success).toBe(false)
    }
    expect(questIdentitySchema.safeParse({gameId:'mhp2g',questKey:'wiki:9:0:2'}).success).toBe(true)
  })
  it('keeps older P2G databases usable and reports missing quest data',()=>{
    const {f}=setup();const db=new Database(f.base,{readonly:true});cleanups.push(()=>db.close())
    expect(()=>new P2gQuestCatalogRepository(db)).toThrow(/任务资料尚未安装/)
    expect(new P2gItemCatalogRepository(db).searchItems({gameId:'mhp2g'}).total).toBeGreaterThan(0)
    expect(new P2gMonsterCatalogRepository(db).getMonster(1)?.p2gQuests?.[0].nameJp).toBeTruthy()
  })
})
