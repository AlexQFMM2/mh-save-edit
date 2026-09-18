import { describe, expect, it } from 'vitest'
import { validateCharm } from '../api/loadout/charm'
import type { LoadoutCalculationSnapshot, LoadoutCharm } from '../api/loadout/types'

function fixture() {
  const snapshot: LoadoutCalculationSnapshot = {
    gameId: 'mhgu', dataVersion: 'synthetic', skills: [], decorations: [], relicLookups: [],
    charmClasses: [{ classId: 1, nameCn: '合成护石', nameEn: 'Synthetic', maxSlots: 3 }],
    charmRanges: [
      { rangeKey: 'a', classId: 1, position: 'A', skillId: 31, minPoints: 1, maxPoints: 6, slotCount: null, maxSlots: 3, status: 'rule', source: 'synthetic-A' },
      { rangeKey: 'b', classId: 1, position: 'B', skillId: 32, minPoints: -3, maxPoints: 10, slotCount: null, maxSlots: 3, status: 'rule', source: 'synthetic-B' },
    ],
    charmSlotRules: Array.from({ length: 21 }, (_, fulfillment) => ({ classId: 1, fulfillment, maxSlots: 3, thresholds: [25, 50, 75], evidence: 'verified', source: 'synthetic-slots' })),
  }
  const charm: LoadoutCharm = { kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '合成护石', slots: 3, skill1: { skillId: 31, nameCn: 'A', points: 6 }, skill2: { skillId: 32, nameCn: 'B', points: 10 }, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [] }
  return { snapshot, charm }
}

describe('GU position pools and independent field diagnostics', () => {
  it('confirms independent A/B ranges plus verified slots without a pair whitelist', () => {
    const { snapshot, charm } = fixture()
    expect(validateCharm(snapshot, charm)).toMatchObject({ legality: 'confirmed', encoding: 'encodable', issues: [] })
  })
  it.each(['A', 'B'] as const)('reports only the invalid %s point and preserves the whole manual input', position => {
    const { snapshot, charm } = fixture()
    if (position === 'A') charm.skill1!.points = 7
    else charm.skill2!.points = 11
    const before = structuredClone(charm)
    const result = validateCharm(snapshot, charm)
    expect(result.legality).toBe('invalid')
    expect(result.encoding).toBe('encodable')
    expect(result.issues.map(issue => issue.path)).toEqual([position === 'A' ? 'charm.skill1.points' : 'charm.skill2.points'])
    expect(result.ranges.map(row => row.position)).toEqual(['A', 'B'])
    expect(charm).toEqual(before)
  })
  it('reports an impossible joint slot count only on slots, not either skill', () => {
    const { snapshot, charm } = fixture()
    snapshot.charmSlotRules!.forEach(row => { row.thresholds = [100, 100, 100] })
    const result = validateCharm(snapshot, charm)
    expect(result.legality).toBe('invalid')
    expect(result.issues.map(issue => issue.path)).toEqual(['charm.slots'])
  })
  it('labels missing slot evidence as unknown slots, not a missing pair table', () => {
    const { snapshot, charm } = fixture()
    snapshot.charmSlotRules!.forEach(row => { row.evidence = 'reference' })
    const result = validateCharm(snapshot, charm)
    expect(result.legality).toBe('unknown')
    expect(result.issues.map(issue => issue.code)).toEqual(['charm.slots.unknown'])
    expect(result.issues[0].path).toBe('charm.slots')
  })
  it('reports unknown membership at the position ID without blaming the other skill', () => {
    const { snapshot, charm } = fixture()
    charm.skill1!.skillId = 999
    expect(validateCharm(snapshot, charm)).toMatchObject({ legality: 'unknown', encoding: 'encodable', issues: [{ path: 'charm.skill1.skillId', code: 'charm.skill.range.unknown' }] })
  })
  it('separates a missing A and duplicate IDs from slot diagnostics', () => {
    const { snapshot, charm } = fixture()
    expect(validateCharm(snapshot, { ...charm, skill1: null }).issues.map(issue => issue.path)).toEqual(['charm.skill1'])
    snapshot.charmRanges.push({ ...snapshot.charmRanges[1], rangeKey: 'same', skillId: 31 })
    charm.skill2!.skillId = 31
    expect(validateCharm(snapshot, charm).issues.map(issue => issue.code)).toEqual(['charm.skill.duplicate'])
  })
  it('preserves signed B points and blocks only true encoding overflow', () => {
    const { snapshot, charm } = fixture()
    for (const points of [-3, 0]) expect(validateCharm(snapshot, { ...charm, skill2: { ...charm.skill2!, points } }).legality).toBe('confirmed')
    charm.skill1!.points = 32768
    expect(validateCharm(snapshot, charm)).toMatchObject({ encoding: 'blocked', legality: 'invalid', issues: [{ code: 'charm.skill.encoding', path: 'charm.skill1' }] })
  })
  it('keeps explicit single-A slot entries and verified pure-slot records supported', () => {
    const { snapshot, charm } = fixture()
    expect(validateCharm(snapshot, { ...charm, skill1: null, skill2: null }).legality).toBe('confirmed')
    snapshot.charmSlotRules = []
    snapshot.charmRanges[0] = { ...snapshot.charmRanges[0], status: 'exact', slotCount: 3 }
    expect(validateCharm(snapshot, { ...charm, skill2: null }).legality).toBe('confirmed')
  })
})
