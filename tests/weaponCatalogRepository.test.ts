import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { WeaponCatalogRepository } from '../api/catalog/weaponRepository'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import type { GameId, } from '../api/core/loadout'

const databases: Database.Database[] = []
function repository(gameId: GameId) { const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true }); databases.push(db); return new WeaponCatalogRepository(db) }
afterEach(() => databases.splice(0).forEach((db) => db.close()))

describe('WeaponCatalogRepository', () => {
  it.each([['mh3g', 1421, 12], ['mh4g', 2324, 14], ['mhgu', 10911, 14]] as const)('returns the audited visible %s catalog and facets', (gameId, total, types) => {
    const repo = repository(gameId)
    expect(repo.searchWeapons({ gameId }).total).toBe(total)
    expect(repo.getWeaponFacets(gameId).weaponTypes).toHaveLength(types)
  })

  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('keeps final-only pagination, picker results and tree flags consistent for %s', gameId => {
    const repo = repository(gameId)
    const picker = new LoadoutCatalogRepository(databases.at(-1)!, gameId)
    const first = repo.searchWeapons({ gameId, finalOnly: true })
    expect(first.total).toBeGreaterThan(0)
    const catalogKeys = new Set<string>(); const pickerKeys = new Set<string>()
    for (let page = 1; page <= Math.ceil(first.total / 100); page++) {
      const catalogPage = repo.searchWeapons({ gameId, finalOnly: true, page })
      const pickerPage = picker.searchWeapons({ gameId, finalOnly: true, page })
      expect(pickerPage.total).toBe(first.total)
      expect(catalogPage.items.every(item => item.isFinalForm && !item.isPlaceholder)).toBe(true)
      expect(pickerPage.items.every(item => item.sourceKind === 'catalog')).toBe(true)
      catalogPage.items.forEach(item => catalogKeys.add(item.weaponKey))
      pickerPage.items.forEach(item => pickerKeys.add(item.weaponKey!))
    }
    expect(catalogKeys.size).toBe(first.total); expect(pickerKeys).toEqual(catalogKeys)
    expect(picker.searchWeapons({ gameId, sourceKind: 'relicTemplate', finalOnly: true }).total).toBe(0)
    const tree = repo.getWeaponTree(gameId, 1)
    expect(tree.nodes.filter(node => node.isFinalForm).every(node => catalogKeys.has(node.weaponKey) && !tree.edges.some(edge => edge.parentWeaponKey === node.weaponKey))).toBe(true)
    expect(tree.nodes.some(node => !node.isFinalForm)).toBe(true)
  })

  it('searches names and decimal or hexadecimal identities', () => {
    const repo = repository('mhgu')
    const named = repo.searchWeapons({ gameId: 'mhgu', query: '贝鲁纳大剑' })
    expect(named.items[0]?.nameEn).toContain('Petrified Blade')
    expect(repo.searchWeapons({ gameId: 'mhgu', query: '0x1', weaponTypeId: 1 }).items.some((item) => item.dexId === 1 || item.saveId === 1)).toBe(true)
  })

  it('filters attributes, slots and directly producible entries', () => {
    const repo = repository('mh4g')
    const facets = repo.getWeaponFacets('mh4g')
    const attribute = facets.attributes[0]
    const result = repo.searchWeapons({ gameId: 'mh4g', attributeId: attribute.attributeId, slots: facets.slots[0], directlyProducible: true })
    expect(result.items.every((weapon) => weapon.isDirectlyProducible && weapon.slots === facets.slots[0] && weapon.attributes.some((value) => value.attributeId === attribute.attributeId))).toBe(true)
  })

  it('sorts sharpness and keeps ranged weapons after melee weapons', () => {
    const result = repository('mhgu').searchWeapons({ gameId: 'mhgu', sort: 'sharpness', direction: 'desc', sharpnessStage: 'handicraft2', pageSize: 100 })
    expect(result.items[0]?.sharpness).not.toBeNull()
  })

  it('returns every discriminated special detail shape', () => {
    const repo = repository('mhgu')
    const expected = new Map([[6, 'huntingHorn'], [8, 'gunlance'], [9, 'phialWeapon'], [10, 'phialWeapon'], [11, 'insectGlaive'], [12, 'bowgun'], [13, 'bowgun'], [14, 'bow']])
    for (const [typeId, kind] of expected) {
      const summary = repo.searchWeapons({ gameId: 'mhgu', weaponTypeId: typeId, pageSize: 1 }).items[0]
      expect(repo.getWeapon({ gameId: 'mhgu', weaponKey: summary.weaponKey })?.kind).toBe(kind)
    }
  })

  it('returns exact targets, material item identities and derivation trees', () => {
    const repo = repository('mh3g')
    const summary = repo.searchWeapons({ gameId: 'mh3g', weaponTypeId: 1, pageSize: 1 }).items[0]
    expect(repo.searchWeapons({ gameId: 'mh3g', targetWeaponKey: summary.weaponKey, query: 'does not matter', finalOnly: true }).items.map((item) => item.weaponKey)).toEqual([summary.weaponKey])
    const detail = repo.getWeapon({ gameId: 'mh3g', weaponKey: summary.weaponKey })
    expect(detail?.materials.every((material) => material.saveId >= 0)).toBe(true)
    const tree = repo.getWeaponTree('mh3g', 1)
    expect(tree.nodes.length).toBeGreaterThan(50)
    expect(tree.edges.every((edge) => tree.nodes.some((node) => node.weaponKey === edge.parentWeaponKey) && tree.nodes.some((node) => node.weaponKey === edge.childWeaponKey))).toBe(true)
  })
})
