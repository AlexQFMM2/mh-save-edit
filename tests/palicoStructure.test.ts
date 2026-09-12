import { describe, expect, it } from 'vitest'
import { rebuildPalicoStructure } from '../api/save/palicoStructure'
import type { SavePalicoDetail, SavePalicoGenerationRules } from '../api/save/types'

const patterns = [
  { scope: 'normal_move' as const, patternId: 0, sequence: 'AB', validLength: 8, weight: 1 },
  { scope: 'charisma_move' as const, patternId: 0, sequence: 'ABC', validLength: 9, weight: 1 },
  { scope: 'skill' as const, patternId: 0, sequence: 'AC', validLength: 6, weight: 1 },
]
const rules: SavePalicoGenerationRules = {
  patterns,
  grants: [
    { forteId: -1, kind: 'move', role: 'common', entryId: 50 },
    { forteId: -1, kind: 'move', role: 'common', entryId: 51 },
    ...Array.from({ length: 8 }, (_, forteId) => ({ forteId, kind: 'move' as const, role: 'primary' as const, entryId: forteId + 1 })),
    ...Array.from({ length: 6 }, (_, index) => [
      { forteId: index + 1, kind: 'move' as const, role: 'secondary' as const, entryId: 20 + index * 2 },
      { forteId: index + 1, kind: 'move' as const, role: 'secondary' as const, entryId: 21 + index * 2 },
    ]).flat(),
    { forteId: 7, kind: 'move', role: 'secondary_fixed', entryId: 40 },
    ...Array.from({ length: 8 }, (_, forteId) => [
      { forteId, kind: 'skill' as const, role: 'innate' as const, entryId: 60 + forteId * 2 },
      { forteId, kind: 'skill' as const, role: 'innate' as const, entryId: 61 + forteId * 2 },
    ]).flat(),
  ],
  pools: [
    { kind: 'move', group: 'A', entryId: 80 }, { kind: 'move', group: 'B', entryId: 81 }, { kind: 'move', group: 'C', entryId: 82 },
    { kind: 'skill', group: 'A', entryId: 83 }, { kind: 'skill', group: 'B', entryId: 84 }, { kind: 'skill', group: 'C', entryId: 85 },
  ],
  source: 'synthetic',
}

function palico(): SavePalicoDetail {
  return {
    index: 0, empty: false, name: 'Mochi', level: 99, experience: 123456, forte: 1, forteNameCn: '战斗', target: 0,
    targetNameCn: '平衡', received: false, enthusiasm: 5, greeting: '', nameGiver: '', previousOwner: '',
    equippedActions: [2, 50, 0, 0, 0, 0, 0, 0], equippedSkills: [62, 0, 0, 0, 0, 0, 0, 0],
    learnedActions: [2, 20, 50, 51, 80, 81, 90, 91, ...Array(8).fill(57)],
    learnedSkills: [62, 63, 83, 85, 92, 93, ...Array(6).fill(96)], actionPattern: 0, actionValidLength: 8,
    skillPattern: 0, skillValidLength: 6, voice: 0, eyes: 0, clothing: 0, coat: 0, ears: 0, tail: 0,
    coatColor: '00000000', rightEyeColor: '00000000', leftEyeColor: '00000000', vestColor: '00000000',
    status: 0, trainingState: 0, assignment: 0, prowlerSelected: 0, assignmentReferencesHex: '', diagnostics: [],
  }
}

describe('Palico native structure rebuild', () => {
  it('switches bias, preserves compatible generated/transferred entries and clears equipped slots', () => {
    const result = rebuildPalicoStructure(palico(), rules, 2)
    expect(result.learnedActions).toEqual([3, 22, 50, 51, 80, 81, 90, 91, ...Array(8).fill(57)])
    expect(result.learnedSkills).toEqual([64, 65, 83, 85, 92, 93, ...Array(6).fill(96)])
    expect(result.equippedActions).toEqual(Array(8).fill(0))
    expect(result.equippedSkills).toEqual(Array(8).fill(0))
    expect(result.actionValidLength).toBe(8)
    expect(result.skillValidLength).toBe(6)
  })

  it('uses the charisma layout and its three transfer positions without touching unrelated data', () => {
    const current = palico()
    const result = rebuildPalicoStructure(current, rules, 0)
    expect(result.learnedActions).toEqual([1, 50, 51, 80, 81, 82, 90, 91, 0, ...Array(7).fill(57)])
    expect(result.actionValidLength).toBe(9)
    expect(current.level).toBe(99)
    expect(current.experience).toBe(123456)
    expect(current.trainingState).toBe(0)
  })

  it('rejects incomplete rule sets instead of guessing a native structure', () => {
    expect(() => rebuildPalicoStructure(palico(), { ...rules, grants: rules.grants.filter(value => !(value.forteId === 2 && value.role === 'primary')) }, 2)).toThrow(/固有行动/)
  })
})
