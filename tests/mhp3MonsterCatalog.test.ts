import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { p3MonsterFixture } from './fixtures/p3MonsterCatalog'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
import { P3MonsterCatalogRepository } from '../api/catalog/p3MonsterRepository'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { catalogGameIdSchema, monsterCatalogFiltersSchema, monsterIdentitySchema, questIdentitySchema } from '../api/catalog/schemas'
const handlers = vi.hoisted(() => new Map<string, (event: unknown, payload: unknown) => any>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: any) => handlers.set(name, fn), removeHandler: (name: string) => handlers.delete(name) } }))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); handlers.clear() })
function fixture() { const db = p3MonsterFixture(); cleanup.push(() => db.close()); return { db, repo: new P3MonsterCatalogRepository(db) } }

describe('P3 monster domain', () => {
  it('bounds native identities and isolates general/task domains and mixed identities', () => {
    for (const id of [0, -1, 75, 1.5]) expect(monsterIdentitySchema.safeParse({ gameId: 'mhp3', monsterId: id }).success).toBe(false)
    for (const extra of [{ saveId: 1 }, { itemId: 1 }, { dexId: 1 }]) expect(monsterIdentitySchema.safeParse({ gameId: 'mhp3', monsterId: 40, ...extra }).success).toBe(false)
    expect(catalogGameIdSchema.safeParse('mhp3').success).toBe(false)
    expect(questIdentitySchema.safeParse({ gameId: 'mhp3', questKey: 'dex:1' }).success).toBe(false)
    expect(monsterCatalogFiltersSchema.safeParse({ gameId: 'mhp3', targetMonsterId: 75 }).success).toBe(false)
    expect(monsterCatalogFiltersSchema.safeParse({ gameId: 'mhgu', scope: 'extended' }).success).toBe(false)
    const { repo } = fixture()
    expect(() => repo.searchMonsters({ gameId: 'mhgu' })).toThrow('不匹配')
    expect(() => repo.getMonster({ gameId: 'mhp2g', monsterId: 40 })).toThrow('不匹配')
  })
  it('keeps same-name variants independent and lets direct targets bypass normal scope and query', () => {
    const { repo } = fixture()
    expect(repo.searchMonsters({ gameId: 'mhp3' }).map(m => m.monsterId)).toEqual([8, 36, 40])
    expect(repo.searchMonsters({ gameId: 'mhp3', scope: 'extended' }).map(m => m.monsterId)).toEqual([37])
    expect(repo.searchMonsters({ gameId: 'mhp3', scope: 'all', query: '同名测试' }).map(m => m.monsterId)).toEqual([36, 37])
    expect(repo.searchMonsters({ gameId: 'mhp3', targetMonsterId: 37, query: '不匹配' })).toHaveLength(1)
    expect(repo.getMonster({ gameId: 'mhp3', monsterId: 74 })).toBeNull()
    expect(repo.getMonsterFacets()).toMatchObject({ monsterCount: 3, scopeCounts: { normal: 3, extended: 1, all: 4 } })
  })
  it('retains disputed state, part conditions, repeated control, units and unknown drop values', () => {
    const { repo } = fixture(), m = repo.getMonster({ gameId: 'mhp3', monsterId: 40 })!
    expect(m.weakness[1]).toMatchObject({ conditionCn: '超带电状态', shot: null })
    expect(m.ailments[0]).toMatchObject({ toleranceInitial: null, applicable: null, p3: { damageUnit: 'per-interval', damageIntervalSeconds: 2 } })
    expect(m.traps[0].p3?.repetitions).toHaveLength(2)
    expect(m.traps[0].p3?.effect).toBe('conditional')
    expect(m.drops[1]).toMatchObject({ quantity: null, probability: null, rankNameCn: '村★2特例', p3: { attemptCount: 2, rawWeight: 17 } })
    expect(repo.getMonster({ gameId: 'mhp3', monsterId: 8 })!.weakness.map(w => w.conditionCn)).toEqual(['该部位覆泥', '该部位无泥'])
    expect(m.quests).toEqual([]); expect(m.p3!.appearances[0]).not.toHaveProperty('questKey')
  })
  it('searches names, aliases, hex IDs, drop items and appearances with reasons and reciprocal sources', () => {
    const { repo, db } = fixture(), items = new P3ItemCatalogRepository(db)
    expect(repo.searchMonsters({ gameId: 'mhp3', query: '0x28' }).map(m => m.monsterId)).toEqual([40])
    for (const q of ['合成怪物别名', 'テスト40']) expect(repo.searchMonsters({ gameId: 'mhp3', query: q }).length).toBeGreaterThan(0)
    expect(repo.searchMonsters({ gameId: 'mhp3', query: '测试出没' })[0].matchReason).toContain('出没任务')
    const item = items.getItem({ gameId: 'mhp3', itemId: 10 })!
    expect(repo.searchMonsters({ gameId: 'mhp3', query: item.nameCn })[0].matchReason).toContain('掉落道具')
    expect(item.relations.filter(r => r.sourceKind === 'monster')).toHaveLength(8)
    expect(item.relations.some(r => r.relatedMonster?.monsterId === 37)).toBe(true)
    expect(items.searchItems({ gameId: 'mhp3', query: '状态测试', sourceKinds: ['monster'] }).items[0].matchReason).toContain('怪物来源')
    expect(items.getItemFacets().relations.some(r => r.sourceKind === 'monster')).toBe(true)
  })
  it('uses all three IPC handlers and leaves an older item library usable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p3-monsters-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
    p3MonsterFixture(join(dir, 'mhp3.sqlite')).close(); cleanup.push(registerCatalogIpc(dir))
    const call = (c: string, p: unknown) => handlers.get(c)!(null, p)
    expect(call(catalogChannels.searchMonsters, { gameId: 'mhp3' })).toHaveLength(3)
    expect(call(catalogChannels.getMonster, { gameId: 'mhp3', monsterId: 40 }).p3.appearances).toHaveLength(1)
    expect(call(catalogChannels.getMonsterFacets, 'mhp3').scopeCounts.all).toBe(4)
    const db = p3ItemFixture(); cleanup.push(() => db.close())
    expect(() => new P3MonsterCatalogRepository(db)).toThrow('尚未安装')
    expect(new P3ItemCatalogRepository(db).getItem({ gameId: 'mhp3', itemId: 10 })!.p3.coverage.monster).toBe('not-collected')
  })
})
