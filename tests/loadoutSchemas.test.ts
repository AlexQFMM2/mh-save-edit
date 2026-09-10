import { describe,expect,it } from 'vitest'
import { autoLoadoutControlSchema, autoLoadoutDeleteSchema, autoLoadoutJobFiltersSchema, autoLoadoutJobSchema, loadoutArmorFiltersSchema, loadoutWeaponFiltersSchema } from '../api/loadout/schemas'

describe('loadout IPC schemas', () => {
  it('accepts paged equipment filters and rejects extra path-like fields', () => {
    expect(loadoutWeaponFiltersSchema.parse({ gameId: 'mh4g', query: '发掘', rarity: 10, slots: 3, sort: 'attack', page: 1, pageSize: 100 }).gameId).toBe('mh4g')
    expect(loadoutArmorFiltersSchema.parse({ gameId: 'mhgu', part: 'head', skillId: 10, combat: 'gunner', gender: 'female', sort: 'skill' }).sort).toBe('skill')
    expect(() => loadoutWeaponFiltersSchema.parse({ gameId: 'mh4g', path: '/tmp/private.sqlite' })).toThrow()
  })

  it('rejects invalid sorts and oversized search terms', () => {
    expect(() => loadoutWeaponFiltersSchema.parse({ gameId: 'mhgu', sort: 'defense' })).toThrow()
    expect(() => loadoutArmorFiltersSchema.parse({ gameId: 'mhgu', part: 'head', sort: 'attack' })).toThrow()
    expect(() => loadoutWeaponFiltersSchema.parse({ gameId: 'mhgu', query: 'x'.repeat(121) })).toThrow()
  })

  it('strictly validates local auto-loadout task operations', () => {
    const jobId = '6fc17f1c-3e57-45af-83cc-2ec32a79a66c'
    expect(autoLoadoutJobSchema.parse({ jobId })).toEqual({ jobId })
    expect(autoLoadoutJobFiltersSchema.parse({ gameId: 'mhgu', statuses: ['running', 'queued'], query: '痛击', limit: 100 }).limit).toBe(100)
    expect(autoLoadoutControlSchema.parse({ jobId, action: 'pause' }).action).toBe('pause')
    expect(autoLoadoutDeleteSchema.parse({ jobIds: [jobId] }).jobIds).toEqual([jobId])
    expect(() => autoLoadoutJobSchema.parse({ jobId: '../state.sqlite' })).toThrow()
    expect(() => autoLoadoutJobFiltersSchema.parse({ gameId: 'mhxx', statuses: ['waiting'], path: '/tmp/jobs.sqlite' })).toThrow()
    expect(() => autoLoadoutControlSchema.parse({ jobId, action: 'restart' })).toThrow()
    expect(() => autoLoadoutDeleteSchema.parse({ jobIds: [] })).toThrow()
  })
})
