import { describe, expect, it } from 'vitest'
import { itemCatalogFiltersSchema, itemIdentitySchema } from '../api/catalog/schemas'

describe('catalog IPC schemas', () => {
  it('accepts bounded catalog requests', () => {
    expect(itemCatalogFiltersSchema.parse({ gameId: 'mhgu', page: 1, pageSize: 100 }).pageSize).toBe(100)
    expect(itemIdentitySchema.parse({ gameId: 'mh3g', saveId: 2 }).saveId).toBe(2)
  })
  it('rejects invalid games, pages and extra path-like input', () => {
    expect(() => itemCatalogFiltersSchema.parse({ gameId: '../mhgu', page: 0 })).toThrow()
    expect(() => itemCatalogFiltersSchema.parse({ gameId: 'mhgu', pageSize: 101 })).toThrow()
    expect(() => itemIdentitySchema.parse({ gameId: 'mhgu', saveId: 1, path: '/tmp/a.sqlite' })).toThrow()
  })
})
