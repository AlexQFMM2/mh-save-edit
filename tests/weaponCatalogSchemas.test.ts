import { describe, expect, it } from 'vitest'
import { weaponCatalogFiltersSchema, weaponIdentitySchema, weaponTreeRequestSchema } from '../api/catalog/schemas'

describe('weapon catalog IPC schemas', () => {
  it('accepts bounded game-specific requests', () => {
    expect(weaponIdentitySchema.parse({ gameId: 'mhgu', weaponKey: '7:60:0' }).weaponKey).toBe('7:60:0')
    expect(weaponCatalogFiltersSchema.parse({ gameId: 'mhgu', sharpnessStage: 'handicraft2', pageSize: 100 }).pageSize).toBe(100)
    expect(weaponTreeRequestSchema.parse({ gameId: 'mh4g', weaponTypeId: 14 }).weaponTypeId).toBe(14)
  })
  it('rejects version mismatches, invalid pages and injected paths', () => {
    expect(() => weaponIdentitySchema.parse({ gameId: 'mh3g', weaponKey: '7:60:0' })).toThrow()
    expect(() => weaponCatalogFiltersSchema.parse({ gameId: 'mh4g', sharpnessStage: 'handicraft2' })).toThrow()
    expect(() => weaponCatalogFiltersSchema.parse({ gameId: 'mhgu', pageSize: 101 })).toThrow()
    expect(() => weaponIdentitySchema.parse({ gameId: 'mhgu', weaponKey: '../../data/a.sqlite' })).toThrow()
  })
})
