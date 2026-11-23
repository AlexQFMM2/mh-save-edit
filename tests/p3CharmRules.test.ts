import { describe, expect, it } from 'vitest'
import { checkP3Charm, enumerateP3CharmCandidates, type P3CharmRules } from '../api/loadout/p3CharmRules'
import type { LoadoutCharm } from '../api/loadout/types'

const pool = (rows: [number, number, number][], position: 'A' | 'B') => ({ poolKey: 'p', position, label: '合成', rows: rows.map(([skillId, min, max]) => ({ skillId, min, max })) })
const table = (cumulative: [number, number, number, number]) => Array.from({ length: 21 }, (_, rank) => cumulative.map((value, slot) => ({ rank, slot, cumulative: value, width: value - (slot === 0 ? 0 : cumulative[slot - 1]) }))).flat()

const rules: P3CharmRules = {
  sources: [
    { sourceKey: 'mystery', itemId: 808, labelJp: 'なぞ', skill1Pool: 'mystery1', skill2Pool: null, secondSkillThreshold: 100, slotTableKey: 'mystery', evidence: 'synthetic' },
    { sourceKey: 'shining', itemId: 809, labelJp: '光る', skill1Pool: 'shining1', skill2Pool: 'shining2', secondSkillThreshold: 35, slotTableKey: 'shining', evidence: 'synthetic' },
    { sourceKey: 'ancient', itemId: 810, labelJp: '古びた', skill1Pool: 'ancient1', skill2Pool: 'ancient2', secondSkillThreshold: 25, slotTableKey: 'ancient', evidence: 'synthetic' },
  ],
  slotTables: {
    mystery: table([10, 10, 60, 100]),
    shining: table([10, 35, 60, 100]),
    ancient: table([0, 25, 60, 100]),
  },
  grades: [
    { sourceKey: 'mystery', grade: 0, minF: 0, maxF: 7, nameCn: '兵士护石', nameJp: '兵士の護石' },
    { sourceKey: 'mystery', grade: 1, minF: 8, maxF: 26, nameCn: '斗士护石', nameJp: '闘士の護石' },
    { sourceKey: 'shining', grade: 2, minF: 0, maxF: 7, nameCn: '骑士护石', nameJp: '騎士の護石' },
    { sourceKey: 'shining', grade: 3, minF: 8, maxF: 26, nameCn: '城塞护石', nameJp: '城塞の護石' },
    { sourceKey: 'ancient', grade: 4, minF: 0, maxF: 7, nameCn: '女王护石', nameJp: '女王の護石' },
    { sourceKey: 'ancient', grade: 5, minF: 8, maxF: 12, nameCn: '王之护石', nameJp: '王の護石' },
    { sourceKey: 'ancient', grade: 6, minF: 13, maxF: 26, nameCn: '龙之护石', nameJp: '龍の護石' },
  ],
  pools: {
    mystery1: { ...pool([[3, 1, 8]], 'A'), poolKey: 'mystery1' },
    shining1: { ...pool([[3, 1, 5]], 'A'), poolKey: 'shining1' },
    shining2: { ...pool([[2, -3, 3]], 'B'), poolKey: 'shining2' },
    ancient1: { ...pool([[3, 1, 7]], 'A'), poolKey: 'ancient1' },
    ancient2: { ...pool([[2, -10, 10]], 'B'), poolKey: 'ancient2' },
  },
  rankScale: 0.1,
  rankMax: 20,
}

const charm = (value: Partial<LoadoutCharm>): LoadoutCharm => ({
  kind: 'charm', gameId: 'mhp3', classId: 0, classNameCn: '兵士护石', slots: 2,
  skill1: { skillId: 3, points: 2, nameCn: '合成' }, skill2: null, decorations: [],
  legality: 'unknown', encoding: 'encodable', issues: [], ...value,
})

describe('P3 native charm rules', () => {
  it('accepts a natural charm and derives the reported rank', () => {
    const check = checkP3Charm(rules, charm({}))
    expect(check.issues).toEqual([])
    expect(check.legality).toBe('confirmed')
    expect(check.rank).toBe(2)
    expect(check.gradeValue).toBe(6)
  })
  it('rejects out-of-range points, wrong grade and unreachable slots', () => {
    expect(checkP3Charm(rules, charm({ skill1: { skillId: 3, points: 9, nameCn: '合成' } })).issues.map(i => i.code)).toContain('charm.skill.non-natural')
    expect(checkP3Charm(rules, charm({ classId: 3, slots: 0, skill1: { skillId: 3, points: 1, nameCn: '合成' } })).issues.map(i => i.code)).toContain('charm.grade.mismatch')
    expect(checkP3Charm(rules, charm({ slots: 1, skill1: { skillId: 3, points: 1, nameCn: '合成' } })).issues.map(i => i.code)).toContain('charm.slots.non-natural')
  })
  it('rejects a second skill in the mystery pool and duplicate skill ids', () => {
    expect(checkP3Charm(rules, charm({ skill2: { skillId: 2, points: 1, nameCn: '合成' } })).issues.map(i => i.code)).toContain('charm.skill2.impossible')
    expect(checkP3Charm(rules, charm({ classId: 2, slots: 1, skill1: { skillId: 3, points: 2, nameCn: '合成' }, skill2: { skillId: 3, points: 1, nameCn: '合成' } })).issues.map(i => i.code)).toContain('charm.skill.duplicate')
  })
  it('blocks values outside the 12-byte encoding', () => {
    const check = checkP3Charm(rules, charm({ classId: 7, slots: 4, skill1: { skillId: 3, points: 40, nameCn: '合成' } }))
    expect(check.encoding).toBe('blocked')
    expect(check.legality).toBe('invalid')
  })
  it('enumerates only combinations that the same rules accept', () => {
    const candidates = enumerateP3CharmCandidates(rules, new Set([3]), 2000)
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(checkP3Charm(rules, candidate).legality).toBe('confirmed')
      expect(candidate.gameId).toBe('mhp3')
    }
    expect(new Set(candidates.map(candidate => candidate.classId))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
  })
})
