import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { p3ArmorFixture } from './fixtures/p3ArmorCatalog'
import { p3SkillFixture } from './fixtures/p3SkillCatalog'
import { P3ArmorCatalogRepository } from '../api/catalog/p3ArmorRepository'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3SkillCatalogRepository } from '../api/catalog/p3SkillRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'
import { armorIdentitySchema, armorCatalogFiltersSchema, armorSetFiltersSchema, catalogGameIdSchema } from '../api/catalog/schemas'
const handlers = vi.hoisted(() => new Map<string, (event: unknown, payload: unknown) => any>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, fn: (event: unknown, payload: unknown) => any) => handlers.set(name, fn), removeHandler: (name: string) => handlers.delete(name) } }))
import { registerCatalogIpc, catalogChannels } from '../api/catalog/ipc'
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); handlers.clear() })
function fixture() { const db = p3ArmorFixture(); cleanups.push(() => db.close()); return { db, repo: new P3ArmorCatalogRepository(db) } }
describe('P3 armor native domain', () => {
  it('validates type-specific bounds and rejects cross-game, mixed and fake save/Dex identities', () => {
    for (const key of ['mhp3:armor:0:232', 'mhp3:armor:1:212', 'mhp3:armor:4:255']) expect(armorIdentitySchema.parse({ gameId: 'mhp3', armorKey: key })).toBeTruthy()
    for (const value of [{ gameId: 'mhp3', armorKey: 'mhp3:armor:0:233' }, { gameId: 'mhp3', armorKey: 'mhp3:armor:4:0' }, { gameId: 'mhp3', armorKey: 'armor_head:1' }, { gameId: 'mhp2g', armorKey: 'mhp3:armor:4:1' }, { gameId: 'mhp3', armorKey: 'mhp3:armor:4:1', dexId: 1 }, { gameId: 'mhp3', armorKey: 'mhp3:armor:4:1', saveId: 1 }]) expect(armorIdentitySchema.safeParse(value).success).toBe(false)
    expect(catalogGameIdSchema.safeParse('mhp3').success).toBe(false)
    expect(armorCatalogFiltersSchema.safeParse({ gameId: 'mhp3', targetDexId: 1 }).success).toBe(false)
    expect(armorSetFiltersSchema.safeParse({ gameId: 'mhp3', part: 'head' }).success).toBe(false)
    const { repo } = fixture()
    expect(() => repo.getArmor({ gameId: 'mhp2g', armorKey: 'mhp3:armor:4:1' } as never)).toThrow()
    expect(() => repo.searchArmors({ gameId: 'mhgu' } as never)).toThrow()
  })
  it('keeps same-name pieces separate, preserves signs and copy markers, and retains alternative routes', () => {
    const { repo } = fixture()
    const a = repo.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:1' })!
    expect(a.recipes).toHaveLength(2); expect(a.skills[0].points).toBe(-2)
    expect(a).not.toHaveProperty('dexId'); expect(a).not.toHaveProperty('saveId')
    expect(repo.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:2' })?.skills[0]).toMatchObject({ kind: 'torso-copy-marker', points: 1 })
    expect(repo.searchArmors({ gameId: 'mhp3' }).total).toBe(4)
    expect(repo.searchArmors({ gameId: 'mhp3', gender: 'female' }).items.map(a => a.nativeId)).toEqual([2, 4])
    expect(repo.searchArmors({ gameId: 'mhp3', combat: 'blademaster' }).items.map(a => a.nativeId)).toEqual([1, 2, 4])
  })
  it('defaults to normal acquisition but allows unknown, special and direct links', () => {
    const { repo } = fixture()
    expect(repo.searchArmors({ gameId: 'mhp3', scope: 'unknown' }).items[0]).toMatchObject({ nativeId: 5, price: null })
    expect(repo.searchArmors({ gameId: 'mhp3', scope: 'special' }).total).toBe(1)
    expect(repo.searchArmors({ gameId: 'mhp3', scope: 'all' }).total).toBe(6)
    expect(repo.searchArmorSets({ gameId: 'mhp3', targetArmorKey: 'mhp3:armor:4:5' }).items[0].rows[0].members.head?.nativeId).toBe(5)
    expect(repo.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:255' })).toBeNull()
  })
  it('searches multilingual aliases, skill and material names, and reverses material usage in items', () => {
    const { repo, db } = fixture(), itemRepo = new P3ItemCatalogRepository(db), a = repo.getArmor({ gameId: 'mhp3', armorKey: 'mhp3:armor:4:1' })!
    const m = a.recipes[0].materials[0]
    expect(repo.searchArmors({ gameId: 'mhp3', query: m.nameJp }).items[0].matchReason).toContain('制作材料')
    expect(repo.searchArmors({ gameId: 'mhp3', query: 'Negative' }).items[0].matchReason).toContain('技能')
    for (const query of ['合成旧称', 'テスト防具', 'mhp3:armor:4:1']) expect(repo.searchArmors({ gameId: 'mhp3', query }).total).toBeGreaterThan(0)
    expect(itemRepo.getItem({ gameId: 'mhp3', itemId: m.itemId })?.p3.armorRecipes?.[0].armor.armorKey).toBe(a.armorKey)
    expect(itemRepo.searchItems({ gameId: 'mhp3', query: '合成防具', usageKinds: ['armor'] }).items[0].matchReason).toContain('防具材料')
    expect(repo.searchArmors({ gameId: 'mhp3', page: 2, pageSize: 2 }).items.map(a => a.nativeId)).toEqual([3, 4])
  })
  it('does not add mutually exclusive variants into set totals', () => {
    const { repo } = fixture()
    const sets = repo.searchArmorSets({ gameId: 'mhp3', gender: 'male' })
    expect(sets.items.map(s => s.gender)).toEqual(['male', 'male'])
    expect(sets.items.every(s => s.totalBaseDefense === 10 && s.totalMaxDefense === 30)).toBe(true)
    expect(repo.searchArmorSets({ gameId: 'mhp3', query: '合成套装2' }).items[0].setKey).toBe('test:2')
  })
  it('advertises full armor only for the extended library while the old skill library remains usable', () => {
    for (const full of [true, false]) {
      const db = full ? fixture().db : p3SkillFixture(); if (!full) cleanups.push(() => db.close())
      const items = new P3ItemCatalogRepository(db), skill = new P3SkillCatalogRepository(db, new P3DecorationCatalogRepository(db, items))
      expect(skill.getSkill(2)?.p3?.armorCatalog).toBe(full ? 'full' : 'preview')
      if (!full) expect(() => new P3ArmorCatalogRepository(db)).toThrow('防具资料尚未安装')
    }
  })
  it('dispatches the four existing armor channels to P3 without opening other unsupported domains', () => {
    const dir = mkdtempSync(join(tmpdir(), 'p3-armors-')); cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    p3ArmorFixture(join(dir, 'mhp3.sqlite')).close(); cleanups.push(registerCatalogIpc(dir))
    const call = (channel: string, payload: unknown) => handlers.get(channel)!(null, payload)
    expect(call(catalogChannels.searchArmors, { gameId: 'mhp3' }).total).toBe(4)
    expect(call(catalogChannels.searchArmorSets, { gameId: 'mhp3' }).total).toBe(4)
    expect(call(catalogChannels.getArmor, { gameId: 'mhp3', armorKey: 'mhp3:armor:4:1' }).recipes).toHaveLength(2)
    expect(call(catalogChannels.getArmorFacets, 'mhp3').skills).toHaveLength(3)
    expect(() => call(catalogChannels.searchWeapons, { gameId: 'mhp3' })).toThrow()
  })
})
