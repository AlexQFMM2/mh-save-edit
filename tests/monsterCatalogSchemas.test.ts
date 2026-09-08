import { describe, expect, it } from 'vitest'
import { monsterCatalogFiltersSchema, monsterIdentitySchema, questIdentitySchema } from '../api/catalog/schemas'

describe('monster catalog schemas', () => {
  it('accepts valid monster filters and identities', () => {
    expect(monsterCatalogFiltersSchema.parse({ gameId: 'mh3g', query: '火龙', targetMonsterId: 1 })).toEqual({ gameId: 'mh3g', query: '火龙', targetMonsterId: 1 })
    expect(monsterIdentitySchema.parse({ gameId: 'mhgu', monsterId: 129 }).monsterId).toBe(129)
    expect(questIdentitySchema.parse({ gameId: 'mhgu', questKey: 'mhgu:q1010126' }).questKey).toBe('mhgu:q1010126')
  })

  it('rejects invalid ranges, overlong queries, path fields and quest keys', () => {
    expect(() => monsterIdentitySchema.parse({ gameId: 'mh3g', monsterId: -1 })).toThrow()
    expect(() => monsterCatalogFiltersSchema.parse({ gameId: 'mh4g', query: 'x'.repeat(121) })).toThrow()
    expect(() => monsterCatalogFiltersSchema.parse({ gameId: 'mhgu', path: '../../secret' })).toThrow()
    expect(() => questIdentitySchema.parse({ gameId: 'mhgu', questKey: '../../data' })).toThrow()
  })
})
