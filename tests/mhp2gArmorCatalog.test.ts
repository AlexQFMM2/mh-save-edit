import { afterEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
// @ts-expect-error Synthetic ESM fixture.
import { armorFixture } from './fixtures/p2gArmorCatalog.mjs'
// @ts-expect-error Native ESM decoder.
import { armorFields } from '../tools/mhp2g/armorFields.mjs'
// @ts-expect-error Native ESM auditor.
import { auditArmors } from '../tools/mhp2g/armorCatalog.mjs'
import { P2gArmorCatalogRepository } from '../api/catalog/p2gArmorRepository'
import { armorCatalogFiltersSchema, armorIdentitySchema, armorSetFiltersSchema } from '../api/catalog/schemas'
const opened:Database.Database[]=[]
const setup=()=>{const f=armorFixture();opened.push(f.db);f.install();return {db:f.db as Database.Database,repository:new P2gArmorCatalogRepository(f.db)}}
afterEach(()=>opened.splice(0).forEach(db=>db.close()))
describe('P2G native armor catalog',()=>{
  it('decodes signed resistance and the progress-gated capped maximum',()=>{
    const b=Buffer.alloc(40);b[4]=6;b[5]=3;b[12]=10;b.writeInt8(-8,15);b.set([2,3,4,5,6,8,255],20)
    expect(armorFields(b)).toMatchObject({gender:'female',combat:'blademaster',rarity:4,thunderRes:-8,maxBeforeFinalUnlock:24,maxDefense:136})
    b.fill(0,20,27);expect(armorFields(b).maxDefense).toBe(10)
    expect(()=>armorFields(b.subarray(1))).toThrow()
  })
  it('rejects fake Dex/save IDs, zero keys, wrong parts, and injected fields',()=>{
    expect(armorIdentitySchema.parse({gameId:'mhp2g',armorKey:'armor_head:1'})).toEqual({gameId:'mhp2g',armorKey:'armor_head:1'})
    for(const input of [{gameId:'mhp2g',dexId:1},{gameId:'mhp2g',armorKey:'armor_head:0'},{gameId:'mhp2g',armorKey:'armor_body:1'},{gameId:'mhp2g',armorKey:'armor_head:1',saveId:1}])expect(()=>armorIdentitySchema.parse(input)).toThrow()
    expect(()=>armorCatalogFiltersSchema.parse({gameId:'mhp2g',sort:'dexId'})).toThrow()
    expect(()=>armorSetFiltersSchema.parse({gameId:'mhp2g',pageSize:101})).toThrow()
  })
  it('retains alternative recipes, signed skills, real native keys and rewards',()=>{
    const {db,repository:r}=setup();expect(auditArmors(db)).toMatchObject({armors:3,sets:2,recipes:3,rewardArmors:1,alternativeArmors:1})
    const a=r.getArmor({gameId:'mhp2g',armorKey:'armor_head:1'})!
    expect(a.recipes).toHaveLength(2);expect(a).not.toHaveProperty('dexId');expect(a).not.toHaveProperty('saveId')
    expect(r.getArmor({gameId:'mhp2g',armorKey:'armor_chest:2'})).toMatchObject({price:null,recipes:[],acquisition:'测试奖励条件',skills:[{points:-3}]})
  })
  it('searches materials and old aliases with reasons and reverses armor to materials',()=>{
    const {repository:r}=setup()
    expect(r.searchArmors({gameId:'mhp2g',query:'Test Wood'}).items).toMatchObject([{armorKey:'armor_head:1',matchReason:'命中：制作材料·测试木材'}])
    expect(r.searchArmors({gameId:'mhp2g',query:'旧名称head1'}).items[0]).toMatchObject({nameCn:'测试head1',matchReason:'命中：旧译名·旧名称head1'})
    expect([...r.getMaterialItemMatches('armor_head:1').keys()].sort()).toEqual([1,2])
    expect(r.getItemArmorUsages(1)).toHaveLength(2)
  })
  it('filters both signs, keeps gender variants apart and includes shared heads',()=>{
    const {repository:r}=setup();expect(r.searchArmors({gameId:'mhp2g',skillId:1,sort:'skillPoints'}).items.map(a=>a.skills[0].points)).toEqual([-3,-3,2])
    const result=r.searchArmorSets({gameId:'mhp2g',gender:'female'})
    expect(result.total).toBe(1);expect(result.items[0].rows[0].members.chest?.armorKey).toBe('armor_chest:2')
    expect(result.items[0].rows[1].members.head?.armorKey).toBe('armor_head:1')
    expect(r.searchArmors({gameId:'mhp2g',query:'no match',targetArmorKey:'armor_chest:2'}).total).toBe(1)
  })
  it('finds set labels and sorts negative totals without counting an absent combat row as zero',()=>{
    const f=armorFixture();opened.push(f.db);f.evidence.sets[0].rows.gunner={};f.evidence.points[2].points=-2;f.install()
    const r=new P2gArmorCatalogRepository(f.db)
    expect(r.searchArmorSets({gameId:'mhp2g',query:'测试套装female'}).total).toBe(1)
    expect(r.searchArmorSets({gameId:'mhp2g',skillId:1,sort:'skillPoints',direction:'desc'}).items[0].setKey).toBe('test:female')
  })
  it('fails closed on a mismatched native icon and rolls back append',()=>{
    const f=armorFixture();opened.push(f.db);f.evidence.icons.armors[0].rowSha256='wrong'
    expect(()=>f.install()).toThrow('Armor icon identity mismatch')
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='p2g_armors'").get()).toBeUndefined()
  })
})
