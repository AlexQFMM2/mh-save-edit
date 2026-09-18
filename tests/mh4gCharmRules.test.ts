import { describe, expect, it } from 'vitest'
import { checkMh4gAppraisal, mh4gClassFor, mh4gFulfillment } from '../api/loadout/mh4gCharmRules'
import { validateCharm } from '../api/loadout/charm'
import { searchCharms } from '../api/loadout/searchCharms'
import type { SearchControl } from '../api/loadout/searchControl'
import type { Mh4gAppraisalGroup, Mh4gCharmNativeInput } from '../api/loadout/mh4gCharmTypes'
import type { LoadoutCalculationSnapshot, LoadoutCharm } from '../api/loadout/types'

// Small invented pools/weights, not a copy of the private native tables.
const group = (): Mh4gAppraisalGroup => ({
  groupIndex: 0, sourceItemId: 999,
  classes: [{ classId: 1, minScore: 0, maxScore: 8 }, { classId: 2, minScore: 8, maxScore: null }],
  secondSkillAttemptPercent: 50,
  pools: { A: { rows: [[1, 1, 10], [3, 1, 5]], sha256: 'synthetic', address: 0 }, B: { rows: [[2, -5, 10], [1, -1, 3], [4, -5, 13]], sha256: 'synthetic', address: 0 } },
  slotWeights: Array.from({ length: 21 }, () => [50, 0, 50, 0]), slotSha256: 'synthetic', slotAddress: 0,
})
function native(): Mh4gCharmNativeInput {
  return { format: 'mh4g-charm-native-v1', gameId: 'mh4g', algorithm: 'appraisal-f32-v1', source: { codeSha256: 'synthetic', expandedSha256: 'synthetic' }, evidence: { kind: 'native-static', scope: 'reviewed-appraisal-path', limitations: ['other-acquisition-paths', 'rng-reachability', 'fpscr-runtime-state'] }, groups: [group()] }
}
function charm(overrides: Partial<LoadoutCharm> = {}): LoadoutCharm {
  return { kind: 'charm', gameId: 'mh4g', classId: 1, classNameCn: '合成品级', slots: 0, skill1: { skillId: 1, points: 1, nameCn: '合成A' }, skill2: null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], ...overrides }
}
function snapshot(): LoadoutCalculationSnapshot {
  const rules = native()
  return {
    gameId: 'mh4g', dataVersion: 'synthetic', decorations: [], skills: [], relicLookups: [],
    charmClasses: [1, 2].map(classId => ({ classId, nameCn: '合成品级', nameEn: '', maxSlots: 3 })),
    charmRanges: rules.groups.flatMap(g => g.classes.flatMap(band => (['A', 'B'] as const).flatMap(position => g.pools[position].rows.map(([skillId, minPoints, maxPoints]) => ({ rangeKey: `${band.classId}:${position}:${skillId}`, classId: band.classId, position, skillId, minPoints, maxPoints, slotCount: null, maxSlots: 3, status: 'rule' as const, source: 'synthetic' }))))),
    mh4gCharmRules: rules,
  }
}

describe('MH4G native appraisal constraint model', () => {
  it('preserves float32 order at a bucket boundary instead of rational rounding', () => {
    const result = mh4gFulfillment([{ points: 3, maxPoints: 5 }, { points: 13, maxPoints: 13 }])
    expect(result.value).toBe(15.999999046325684)
    expect(result.row).toBe(15)
    expect(10 * 3 / 5 + 10 * 13 / 13).toBe(16)
  })
  it('retains row zero, ignores negative contribution and clamps high scores', () => {
    expect(mh4gFulfillment([{ points: 1, maxPoints: 20 }, { points: -5, maxPoints: 10 }])).toEqual({ value: 0.5, row: 0 })
    expect(mh4gFulfillment([{ points: 20, maxPoints: 10 }, { points: 20, maxPoints: 10 }])).toEqual({ value: 20, row: 20 })
    expect(() => mh4gFulfillment([{ points: 1, maxPoints: 0 }])).toThrow()
  })
  it.each([8, 13, 16])('uses inclusive lower and exclusive upper class boundary at %s', boundary => {
    const g = group()
    g.classes = [{ classId: 1, minScore: 0, maxScore: boundary }, { classId: 2, minScore: boundary, maxScore: null }]
    expect(mh4gClassFor(g, boundary - 4, 2)).toBe(2)
    expect(mh4gClassFor(g, boundary - 4 - 0.00001, 2)).toBe(1)
  })
  it('distinguishes impossible slots from a wrong final grade', () => {
    const impossibleSlot = checkMh4gAppraisal(native(), charm({ slots: 1 }))
    expect(impossibleSlot.issues.map(i => i.code)).toEqual(['charm.mh4g.slots.weight'])
    const wrongClass = checkMh4gAppraisal(native(), charm({ skill1: { skillId: 1, points: 8, nameCn: 'A' } }))
    expect(wrongClass.issues.map(i => i.code)).toEqual(['charm.mh4g.class.score'])
    expect(wrongClass.derivedClassId).toBe(2)
  })
  it('rejects pure-slot, zero-valued and duplicate-skill final records without normalizing input', () => {
    expect(checkMh4gAppraisal(native(), charm({ skill1: null })).issues.some(i => i.code === 'charm.mh4g.first.required')).toBe(true)
    const zero = charm({ skill2: { skillId: 2, points: 0, nameCn: 'B' } })
    const before = structuredClone(zero)
    expect(checkMh4gAppraisal(native(), zero).issues.some(i => i.code === 'charm.mh4g.skill.zero')).toBe(true)
    expect(zero).toEqual(before)
    expect(checkMh4gAppraisal(native(), charm({ skill2: { skillId: 1, points: 1, nameCn: 'A' } })).issues.some(i => i.code === 'charm.skill.duplicate')).toBe(true)
  })
  it('accepts negative B points as a path constraint but does not certify reachability', () => {
    const value = charm({ skill2: { skillId: 2, points: -5, nameCn: 'B' } })
    const check = checkMh4gAppraisal(native(), value)
    expect(check.status).toBe('satisfied')
    expect(check.fulfillment).toBe(1)
    const result = validateCharm(snapshot(), value)
    expect(result.encoding).toBe('encodable')
    expect(result.legality).toBe('unknown')
    expect(result.issues.map(i => i.code)).toEqual(['charm.mh4g.constraints-only'])
  })
  it('does not blame B or slots when A is outside its range', () => {
    const value = charm({ skill1: { skillId: 1, points: 11, nameCn: 'A' }, skill2: { skillId: 2, points: 5, nameCn: 'B' } })
    const result = validateCharm(snapshot(), value)
    expect(result.issues.map(i => [i.code, i.path])).toEqual([['charm.skill.non-natural', 'charm.skill1.points']])
    expect(result.ranges.map(r => r.position)).toEqual(['A', 'B'])
    expect(result.encoding).toBe('encodable')
  })
  it('keeps missing ranges and invalid points distinct without native input', () => {
    const data = snapshot(); delete data.mh4gCharmRules
    const value = charm({ skill1: { skillId: 1, points: 11, nameCn: 'A' }, skill2: { skillId: 999, points: 2, nameCn: '未知' } })
    const result = validateCharm(data, value)
    expect(result.issues.find(i => i.path === 'charm.skill1.points')?.code).toBe('charm.skill.non-natural')
    expect(result.issues.find(i => i.path === 'charm.skill2.skillId')?.code).toBe('charm.skill.range.unknown')
  })
  it('blocks only structural encoding errors, not an unconfirmed natural record', () => {
    expect(validateCharm(snapshot(), charm({ slots: 4 })).encoding).toBe('blocked')
    expect(validateCharm(snapshot(), charm({ skill1: { skillId: 1, points: 40000, nameCn: 'A' } })).encoding).toBe('blocked')
    expect(validateCharm(snapshot(), charm()).encoding).toBe('encodable')
  })
  it('keeps automatic generation gated and supplies a coverage warning', async () => {
    const data = { ...snapshot(), weapons: [], armors: [] }
    const result = await searchCharms(data, new Set([1, 2]), {} as SearchControl)
    expect(result.candidates).toEqual([])
    expect(result.warnings[0]).toContain('生成可达性')
  })
})
