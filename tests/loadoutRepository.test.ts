import type Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'

describe('LoadoutCatalogRepository bootstrap', () => {
  it('does not assemble weapon or armor candidates during page bootstrap', () => {
    const statements: string[] = []
    const db = {
      prepare(sql: string) {
        statements.push(sql)
        return {
          all: () => [],
          get: () => undefined,
        }
      },
    } as unknown as Database.Database

    const bootstrap = new LoadoutCatalogRepository(db, 'mhgu').getBootstrap()

    expect(bootstrap.gameId).toBe('mhgu')
    expect(bootstrap).not.toHaveProperty('weapons')
    expect(bootstrap).not.toHaveProperty('armors')
    expect(statements.some(sql => sql.includes('FROM catalog_weapons'))).toBe(false)
    expect(statements.some(sql => sql.includes('FROM catalog_armors'))).toBe(false)
  })

  it('includes universal armor for either profession without mixing exclusive professions', () => {
    const rows = ['both', 'blademaster', 'gunner'].map((combat, index) => ({ dex_id: index + 1, part: 'head', combat, gender: 'both', name_cn: `合成防具${index}`, slots: 0 }))
    const db = { prepare: (sql: string) => ({ all: () => sql.includes('FROM catalog_armors') ? rows : [], get: () => undefined }) } as unknown as Database.Database
    const repo = new LoadoutCatalogRepository(db, 'mhgu')
    expect(repo.searchArmors({ gameId: 'mhgu', part: 'head', combat: 'blademaster' }).items.map(item => item.combat)).toEqual(['both', 'blademaster'])
    expect(repo.searchArmors({ gameId: 'mhgu', part: 'head', combat: 'gunner' }).items.map(item => item.combat)).toEqual(['both', 'gunner'])
  })

  it('keeps editor enums out of bootstrap and exposes them through the lazy endpoint', () => {
    const statements: string[] = []
    const lookupRow = { lookup_kind: 'equipment_lookup', lookup_key: 'attack_tier:7:melee:0', payload_json: '{"domain":"attack_tier","save_type":7,"variant":"melee","code":0}', source: 'test' }
    const db = {
      prepare(sql: string) {
        statements.push(sql)
        return {
          all: () => sql.includes('catalog_loadout_relic_value_lookups') && !sql.includes("lookup_kind <> 'equipment_lookup'") ? [lookupRow] : [],
          get: (...parameters: unknown[]) => sql.includes('sqlite_master') && parameters[0] === 'catalog_loadout_relic_value_lookups' ? { exists: 1 } : undefined,
        }
      },
    } as unknown as Database.Database
    const repository = new LoadoutCatalogRepository(db, 'mh4g')

    expect(repository.getBootstrap().relicLookups).toEqual([])
    expect(repository.getRelicLookups()).toEqual([{ kind: 'equipment_lookup', key: 'attack_tier:7:melee:0', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 0 }, source: 'test' }])
    expect(statements.some(sql => sql.includes("lookup_kind <> 'equipment_lookup'"))).toBe(true)
    expect(statements.some(sql => sql.includes('catalog_loadout_relic_value_lookups') && !sql.includes("lookup_kind <> 'equipment_lookup'"))).toBe(true)
  })

  it('offers separate MH4G identities for both genders and keeps the Dex display name', () => {
    const armor = { dex_id: 1, part: 'head', combat: 'blademaster', gender: 'both', name_cn: '合成活动防具', slots: 3 }
    const identities = [
      { armor_dex_id: 1, save_type: 5, save_id: 101, gender: 'male' },
      { armor_dex_id: 1, save_type: 5, save_id: 102, gender: 'female' },
    ]
    const db = { prepare: (sql: string) => ({
      all: () => sql.includes('FROM catalog_armors') ? [armor] : sql.includes('FROM catalog_armor_save_identities') ? identities : [],
      get: (name: string) => sql.includes('sqlite_master') && name === 'catalog_armor_save_identities' ? { exists: 1 } : undefined,
    }) } as unknown as Database.Database
    const repo = new LoadoutCatalogRepository(db, 'mh4g')
    for (const [gender, saveId] of [['male', 101], ['female', 102]] as const) {
      const result = repo.searchArmors({ gameId: 'mh4g', part: 'head', gender })
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({ nameCn: '合成活动防具', gender, saveId, candidateKey: `catalog:1:5:${saveId}` })
    }
  })
})
