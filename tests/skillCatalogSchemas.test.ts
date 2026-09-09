import { describe, expect, it } from 'vitest'
import { skillCatalogFiltersSchema, skillIdentitySchema } from '../api/catalog/schemas'
describe('skill catalog schemas', () => {
  it('accepts strict valid skill filters', () => expect(skillCatalogFiltersSchema.parse({ gameId: 'mhgu', query: '痛击', direction: 'positive', source: 'talisman', page: 1, pageSize: 100 })).toBeTruthy())
  it('rejects invalid filters and path-like extra fields', () => {
    expect(() => skillCatalogFiltersSchema.parse({ gameId: 'mhgu', direction: 'up' })).toThrow()
    expect(() => skillCatalogFiltersSchema.parse({ gameId: 'mhgu', pageSize: 101 })).toThrow()
    expect(() => skillIdentitySchema.parse({ gameId: 'mhgu', skillId: -1, path: '/tmp/x' })).toThrow()
  })
})
