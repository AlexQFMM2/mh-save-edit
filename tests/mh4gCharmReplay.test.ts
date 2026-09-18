import { describe, expect, it } from 'vitest'
import { nextMh4gRandomState, replayMh4gAppraisal, type Mh4gRandomState } from '../api/loadout/mh4gCharmReplay'
import { checkMh4gAppraisal } from '../api/loadout/mh4gCharmRules'
import type { Mh4gAppraisalGroup, Mh4gCharmNativeInput } from '../api/loadout/mh4gCharmTypes'

// Artificial pool and weight data only. No private native table fixtures.
function group(): Mh4gAppraisalGroup {
  return {
    groupIndex: 0, sourceItemId: 999,
    classes: [{ classId: 1, minScore: 0, maxScore: 8 }, { classId: 2, minScore: 8, maxScore: null }],
    secondSkillAttemptPercent: 100,
    pools: { A: { rows: [[1, 1, 5], [2, 1, 10]], sha256: 'synthetic', address: 0 }, B: { rows: [[3, -5, 5]], sha256: 'synthetic', address: 0 } },
    slotWeights: Array.from({ length: 21 }, () => [10, 20, 30, 40]), slotSha256: 'synthetic', slotAddress: 0,
  }
}
function native(g: Mh4gAppraisalGroup): Mh4gCharmNativeInput {
  return { format: 'mh4g-charm-native-v1', gameId: 'mh4g', algorithm: 'appraisal-f32-v1', source: { codeSha256: 'synthetic', expandedSha256: 'synthetic' }, evidence: { kind: 'native-static', scope: 'reviewed-appraisal-path', limitations: ['rng-reachability'] }, groups: [g] }
}

describe('MH4G deterministic functional replay', () => {
  it('matches the native wide-integer instruction formula for all uint16 states', () => {
    for (let state = 0; state <= 65535; state++) {
      // Independent literal MUL/UMLAL/LSR/MLA/UXTH evaluation, no floating point.
      const product = BigInt(state || 1) * 176n
      const wide = 0x2015aea7n + product * 0x2015aea7n
      const quotient = (wide >> 32n) >> 13n
      const expected = Number((product + quotient * 173n) & 0xffffn)
      if (nextMh4gRandomState(state) !== expected) throw new Error(`RNG mismatch at ${state}`)
    }
    expect(nextMh4gRandomState(0)).toBe(nextMh4gRandomState(1))
    expect(nextMh4gRandomState(65363)).toBe(0)
  })
  it('does not assume the state-one orbit contains every possible state', () => {
    const visited = new Set<number>()
    let state = 1
    while (!visited.has(state)) { visited.add(state); state = nextMh4gRandomState(state) }
    expect(state).toBe(1)
    expect(visited.size).toBe(5400)
  })
  it('rejects malformed states without silently masking them', () => {
    for (const value of [-1, 65536, 1.1, NaN, Infinity]) expect(() => nextMh4gRandomState(value)).toThrow('uint16')
  })
  it('consumes mandatory draws even with no B pool and a singleton A range', () => {
    const g = group()
    g.pools.A.rows = [[1, 1, 1]]
    g.pools.B.rows = []
    g.secondSkillAttemptPercent = 0
    g.slotWeights = Array.from({ length: 21 }, () => [100, 0, 0, 0])
    const start: Mh4gRandomState = [1, 1]
    const result = replayMh4gAppraisal(g, start)
    // A index s1, A points s1/s0, B chance s1/s0, slot branch s1,
    // and bit 0x80 of the fourth s1 result selects one final stream draw.
    const advance = (state: number, count: number) => { for (let i = 0; i < count; i++) state = nextMh4gRandomState(state); return state }
    const branch = advance(1, 4) & 0x80
    expect(result.finalState).toEqual([advance(1, branch ? 2 : 3), advance(1, branch ? 5 : 4)])
    expect(result.skill2Id).toBe(0)
    expect(result.skill2Points).toBe(0)
    expect(start).toEqual([1, 1])
    expect(replayMh4gAppraisal(g, start)).toEqual(result)
  })
  it('clears duplicate B without redrawing or changing random consumption', () => {
    const duplicate = group(); duplicate.pools.A.rows = [[1, 1, 5]]; duplicate.pools.B.rows = [[1, 1, 5]]
    const distinct = structuredClone(duplicate); distinct.pools.B.rows[0][0] = 3
    const a = replayMh4gAppraisal(duplicate, [1, 9])
    const b = replayMh4gAppraisal(distinct, [1, 9])
    expect(a.skill2Id).toBe(0); expect(a.skill2Points).toBe(0)
    expect(b.skill2Id).toBe(3)
    expect(a.finalState).toEqual(b.finalState)
  })
  it('generates positive, negative and cleared-zero B records through separate sign branches', () => {
    const g = group()
    const points = new Set<number>()
    for (let seed = 1; seed <= 256; seed++) {
      const result = replayMh4gAppraisal(g, [seed, seed + 100])
      points.add(result.skill2Points)
      if (!result.skill2Points) expect(result.skill2Id).toBe(0)
    }
    expect([...points].some(p => p < 0)).toBe(true)
    expect([...points].some(p => p > 0)).toBe(true)
    expect(points.has(0)).toBe(true)
  })
  it('all replayed synthetic outputs satisfy the shared static checker', () => {
    const g = group()
    const data = native(g)
    const outcomes = new Set<string>()
    for (let seed = 0; seed < 1024; seed++) {
      const result = replayMh4gAppraisal(g, [seed, (seed * 977) & 65535])
      const check = checkMh4gAppraisal(data, { classId: result.classId, slots: result.slots, skill1: { skillId: result.skill1Id, points: result.skill1Points, nameCn: 'A' }, skill2: result.skill2Id ? { skillId: result.skill2Id, points: result.skill2Points, nameCn: 'B' } : null })
      expect(check.status).toBe('satisfied')
      expect(check.fulfillment).toBe(result.fulfillment)
      outcomes.add(`${result.classId}:${result.slots}`)
    }
    expect(outcomes.size).toBeGreaterThan(3)
  })
  it('rejects missing required pools and non-probability slot rows', () => {
    const g = group(); g.pools.A.rows = []
    expect(() => replayMh4gAppraisal(g, [1, 1])).toThrow('A pool')
    const bad = group(); bad.slotWeights = Array.from({ length: 21 }, () => [99, 0, 0, 0])
    expect(() => replayMh4gAppraisal(bad, [1, 1])).toThrow('slot weights')
  })
})
