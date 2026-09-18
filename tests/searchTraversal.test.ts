import { describe, expect, it } from 'vitest'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { ARMOR_LOADOUT_SLOTS } from '../api/loadout/types'
import { createPatternFixture } from './fixtures/searchPatterns'

const context = { checkpoint: async () => {}, progress: () => {} }
describe('progressive rank-band armor traversal', () => {
  it('returns all twenty feasible tuples in a complete two-choice, five-part domain', async () => {
    const { snapshot, loadout, request } = createPatternFixture('mh3g')
    snapshot.decorations = []
    snapshot.armors = ARMOR_LOADOUT_SLOTS.flatMap(part => [10, 11].map(skillId => ({ ...loadout.armor[part]!, slots: 0, candidateKey: `${part}:${skillId}`, skills: [{ skillId, nameCn: String(skillId), points: 3 }] })))
    loadout.armor = {}
    request.targets.forEach(target => { target.threshold = 5 })
    request.resultLimit = 100
    const before = structuredClone(request)
    const report = await runAutoLoadout(snapshot, request, context)
    // 2 or 3 pieces supplying A: C(5,2) + C(5,3) = 20.
    expect(report.results).toHaveLength(20)
    expect(new Set(report.results.map(row => row.fingerprint)).size).toBe(20)
    expect(report.progress.searchComplete).toBe(true)
    expect(report.progress.incompleteReason).toBeUndefined()
    expect(request).toEqual(before)
    for (const result of report.results) for (const target of request.targets) expect(result.calculation.skills.find(row => row.skillId === target.skillId)?.total ?? 0).toBeGreaterThanOrEqual(target.threshold)
  })
  it('terminates a zero-width rank domain with all equipment fixed', async () => {
    const { snapshot, loadout, request } = createPatternFixture('mh3g')
    snapshot.decorations = []
    for (const part of ARMOR_LOADOUT_SLOTS) {
      loadout.armor[part]!.lock = 'equipmentAndDecorations'
      loadout.armor[part]!.skills = [{ skillId: 10, nameCn: 'A', points: 1 }, { skillId: 11, nameCn: 'B', points: 1 }]
    }
    request.resultLimit = 5
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results).toHaveLength(1)
    expect(report.progress.searchComplete).toBe(true)
  })
})
