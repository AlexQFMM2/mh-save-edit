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
})
