import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { ItemCatalogRepository } from '../api/catalog/repository'
import type { GameId } from '../api/core/loadout'

const databases: Database.Database[] = []
function repository(gameId: GameId) {
  const database = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
  databases.push(database)
  return new ItemCatalogRepository(database)
}
afterEach(() => { databases.splice(0).forEach((database) => database.close()) })

describe('ItemCatalogRepository', () => {
  it.each([['mh3g', 1533], ['mh4g', 1937], ['mhgu', 2991]] as const)('keeps the authoritative %s save-ID array and complete mapped icons', (gameId, count) => {
    const database = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
    databases.push(database)
    const stats = database.prepare(`SELECT count(*) total,
      sum(CASE WHEN dex_id IS NOT NULL AND is_placeholder = 0 AND icon_path IS NULL THEN 1 ELSE 0 END) missing
      FROM catalog_items WHERE game_id = ?`).get(gameId) as { total: number; missing: number }
    expect(stats).toEqual({ total: count, missing: 0 })
    expect(database.pragma('foreign_key_check')).toEqual([])
  })

  it.each([['mh3g', 1308], ['mh4g', 1913], ['mhgu', 2921]] as const)('hides placeholders for %s', (gameId, visible) => {
    const result = repository(gameId).searchItems({ gameId, pageSize: 100 })
    expect(result.total).toBe(visible)
    expect(result.items).toHaveLength(100)
  })

  it('searches Chinese, English, decimal and hexadecimal identities', () => {
    const repo = repository('mh4g')
    expect(repo.searchItems({ gameId: 'mh4g', query: '调合书①' }).items[0]?.saveId).toBe(1)
    expect(repo.searchItems({ gameId: 'mh4g', query: 'Book of Combos 1' }).items[0]?.saveId).toBe(1)
    expect(repo.searchItems({ gameId: 'mh4g', query: '10' }).items[0]?.saveId).toBe(10)
    expect(repo.searchItems({ gameId: 'mh4g', query: '0x000a' }).items[0]?.saveId).toBe(10)
  })

  it('combines facets, source filters, sorting and pagination', () => {
    const repo = repository('mhgu')
    const facets = repo.getItemFacets('mhgu')
    expect(facets.rarities.length).toBeGreaterThan(5)
    expect(facets.relations.some((value) => value.usageKind === 'kinsect')).toBe(true)
    const result = repo.searchItems({ gameId: 'mhgu', sourceKinds: ['monster'], sort: 'rarity', page: 2, pageSize: 10 })
    expect(result.page).toBe(2)
    expect(result.items).toHaveLength(10)
  })

  it('returns grouped relation data and null for a missing item', () => {
    const repo = repository('mh3g')
    const item = repo.getItem({ gameId: 'mh3g', saveId: 10 })
    expect(item?.nameCn).toBe('回复药Ｇ')
    expect(Array.isArray(item?.relations)).toBe(true)
    expect(repo.getItem({ gameId: 'mh3g', saveId: 65535 })).toBeNull()
  })

  it('resolves item-to-item relation targets for detail navigation', () => {
    const item = repository('mh3g').getItem({ gameId: 'mh3g', saveId: 9 })
    const combination = item?.relations.find((relation) => relation.sourceKind === 'combination')
    expect(combination?.relatedItems.map((target) => target.nameCn)).toEqual(['药草', '蓝蘑菇'])
  })

  it('uses catalog names for equipment and decoration usage relations', () => {
    const item = repository('mh3g').getItem({ gameId: 'mh3g', saveId: 178 })
    expect(item?.relations.some((relation) => relation.usageKind === 'weapon' && !relation.targetName.includes('#'))).toBe(true)
    expect(item?.relations.some((relation) => relation.usageKind === 'weapon' && relation.relatedWeapon?.weaponKey)).toBe(true)
    expect(item?.relations.some((relation) => relation.usageKind === 'armor' && !relation.targetName.includes('#') && relation.relatedArmor?.nameCn)).toBe(true)
    expect(item?.relations.some((relation) => relation.usageKind === 'decoration' && !relation.targetName.includes('#'))).toBe(true)
  })

  it('filters an exact save target for drawer navigation', () => {
    const result = repository('mh3g').searchItems({ gameId: 'mh3g', targetSaveId: 178 })
    expect(result.items.map((item) => item.saveId)).toEqual([178])
  })
})
