import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { checkCharmSlots } from '../api/loadout/charmSlotRules'
import { applyCharmValidation } from '../api/loadout/charm'
import { searchCharms } from '../api/loadout/searchCharms'
import { SearchControl } from '../api/loadout/searchControl'
import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout, type AutoLoadoutRequest, type LoadoutArmor, type LoadoutCatalogSnapshot, type LoadoutCharm, type LoadoutWeapon } from '../api/loadout/types'

const weapon: LoadoutWeapon = { kind: 'weapon', gameId: 'mhgu', candidateKey: 'w', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试武器', nameEn: 'Test', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 1, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'equipment' }
const armor = (part: LoadoutArmor['part'], key: string, points: number, slots = 0): LoadoutArmor => ({ kind: 'armor', gameId: 'mhgu', candidateKey: key, sourceKind: 'catalog', dexId: 1, templateKey: null, saveType: 1, saveId: 1, nameCn: key, nameEn: key, part, combat: 'both', gender: 'both', rarity: 1, slots, baseDefense: 1, maxDefense: 1, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, iconPath: null, skills: [{ skillId: 10, nameCn: '合成技能', points }], decorations: [], lock: 'unlocked' })
function fixture() {
  const snapshot: LoadoutCatalogSnapshot = { gameId: 'mhgu', dataVersion: 'v', weapons: [weapon], armors: ARMOR_LOADOUT_SLOTS.flatMap(part => [armor(part, `${part}:a`, 3), armor(part, `${part}:b`, -1)]), decorations: [], skills: [{ skillId: 10, nameCn: '合成技能', nameEn: 'Test', nameJp: '', activations: [{ activationKey: 'a', skillId: 10, threshold: 7, direction: 'positive', nameCn: '测试发动' }] }], charmClasses: [], charmRanges: [], relicLookups: [] }
  const baseLoadout = { ...createEmptyLogicalLoadout('mhgu', 'v'), weapon }
  const request: AutoLoadoutRequest = { requestId: 'request', gameId: 'mhgu', dataVersion: 'v', baseLoadout, targets: [{ activationKey: 'a', skillId: 10, threshold: 7, nameCn: '测试发动' }], resultLimit: 50, timeoutMs: 5000 }
  return { snapshot, request }
}
const context = { checkpoint: async () => {}, progress: () => {} }
afterEach(() => vi.restoreAllMocks())

describe('streaming automatic loadout search', () => {
  it('matches an independent exhaustive oracle for a signed small candidate domain', async () => {
    const { snapshot, request } = fixture()
    const expected: string[] = []
    for (let mask = 0; mask < 32; mask++) {
      const choices = ARMOR_LOADOUT_SLOTS.map((part, index) => ({ key: `${part}:${mask & (1 << index) ? 'b' : 'a'}`, points: mask & (1 << index) ? -1 : 3 }))
      if (choices.reduce((sum, item) => sum + item.points, 0) >= 7) expected.push(choices.map(value => value.key).join(','))
    }
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results.map(result => ARMOR_LOADOUT_SLOTS.map(part => result.loadout.armor[part]?.candidateKey).join(',')).sort()).toEqual(expected.sort())
    expect(report.progress.searchComplete).toBe(true)
    expect(report.progress.verified).toBeLessThanOrEqual(32)
  })
  it('finds and reports a result before exploring the entire armor Cartesian product', async () => {
    const { snapshot, request } = fixture(); request.resultLimit = 1
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results).toHaveLength(1)
    expect(report.progress.verified).toBe(1)
    expect(report.progress.incompleteReason).toBe('candidate-bound')
    expect(report.progress.searchComplete).toBe(false)
  })
  it('returns explicit timeout metadata even with zero results', async () => {
    const { snapshot, request } = fixture(); request.timeoutMs = 1
    let now = 0; vi.spyOn(Date, 'now').mockImplementation(() => now++)
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results).toEqual([])
    expect(report.progress).toMatchObject({ searchComplete: false, incompleteReason: 'timeout' })
  })
  it('excludes explicit paused duration from the budget', async () => {
    const { request } = fixture(); request.timeoutMs = 10
    let now = 0; vi.spyOn(Date, 'now').mockImplementation(() => now)
    const control = new SearchControl(request, { progress: () => {}, checkpoint: async () => { now += 1000; return 1000 } })
    await control.tick(true)
    expect(control.elapsedMs).toBe(0)
  })
  it('solves a multi-target decoration tradeoff with a negative contribution', async () => {
    const { snapshot, request } = fixture()
    snapshot.armors = ARMOR_LOADOUT_SLOTS.map(part => armor(part, part, part === 'head' ? 7 : 0, part === 'head' ? 2 : 0))
    snapshot.skills.push({ skillId: 20, nameCn: '第二技能', nameEn: 'Second', nameJp: '', activations: [] })
    snapshot.decorations = [
      { saveId: 1, nameCn: '权衡珠', slots: 1, skills: [{ skillId: 10, nameCn: '合成技能', points: -4 }, { skillId: 20, nameCn: '第二技能', points: 5 }] },
      { saveId: 2, nameCn: '补足珠', slots: 1, skills: [{ skillId: 10, nameCn: '合成技能', points: 2 }] },
    ]
    request.targets = [{ activationKey: 'a', skillId: 10, threshold: 5, nameCn: 'A' }, { activationKey: 'b', skillId: 20, threshold: 5, nameCn: 'B' }]
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results).toHaveLength(1)
    expect(report.results[0].loadout.armor.head?.decorations.map(value => value.saveId).sort()).toEqual([1, 2])
  })
  it('retains a special-skill route where the jewel creates a newly boosted skill', async () => {
    const { snapshot, request } = fixture()
    snapshot.armors = ARMOR_LOADOUT_SLOTS.map(part => armor(part, part, 0, part === 'head' ? 1 : 0))
    snapshot.armors[0].skills = [{ skillId: 204, nameCn: '秘术', points: 10 }]
    snapshot.skills.push({ skillId: 204, nameCn: '秘术', nameEn: '', nameJp: '', activations: [] })
    snapshot.decorations = [{ saveId: 1, nameCn: '合成珠', slots: 1, skills: [{ skillId: 10, nameCn: '合成技能', points: 3 }] }]
    request.targets[0].threshold = 5
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results[0].calculation.skills.find(value => value.skillId === 10)?.total).toBe(5)
  })
  it('does not certify an unconfirmed charm domain as exhaustive', async () => {
    const { snapshot, request } = fixture(); request.targets[0].threshold = 100
    snapshot.charmClasses = [{ classId: 1, nameCn: '测试护石', nameEn: '', maxSlots: 0 }]
    snapshot.charmRanges = [{ rangeKey: 'a', classId: 1, skillId: 10, position: 'A', minPoints: 1, maxPoints: 5, slotCount: null, maxSlots: 3, status: 'rule', source: 'synthetic' }]
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.results).toEqual([])
    expect(report.progress.incompleteReason).toBe('unknown-charm-range')
    expect(report.progress.coverageWarnings?.length).toBeGreaterThan(0)
  })
})

describe('joint charm slot evidence', () => {
  const charm: LoadoutCharm = { kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '测试', slots: 3, skill1: { skillId: 10, nameCn: '合成技能', points: 4 }, skill2: null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [] }
  function rulesFixture() {
    const { snapshot, request } = fixture()
    snapshot.charmClasses = [{ classId: 1, nameCn: '测试', nameEn: '', maxSlots: 3 }]
    snapshot.charmRanges = [{ rangeKey: 'a', classId: 1, skillId: 10, position: 'A', minPoints: 1, maxPoints: 5, slotCount: null, maxSlots: 3, status: 'rule', source: 'synthetic' }]
    snapshot.charmSlotRules = Array.from({ length: 20 }, (_, i) => ({ classId: 1, fulfillment: i + 1, maxSlots: 3, thresholds: i < 9 ? [0, 0, 0] as [number, number, number] : [0, 100, 100] as [number, number, number], source: 'synthetic-proven', evidence: 'verified' as const }))
    return { snapshot, request }
  }
  it('keeps lower points with more slots instead of only generating maximum points', async () => {
    const { snapshot, request } = rulesFixture()
    const { candidates } = await searchCharms(snapshot, new Set([10]), new SearchControl(request, context))
    expect(candidates.some(value => value.skill1?.points === 4 && value.slots === 3)).toBe(true)
    expect(candidates.some(value => value.skill1?.points === 5 && value.slots === 3)).toBe(false)
  })
  it('uses exact 3G joint rows instead of recombining two individually possible skills', () => {
    const { snapshot } = rulesFixture(); snapshot.gameId = 'mh3g'
    snapshot.charmCombinations = [[1, 3, 10, 4, 20, 2]]
    const value = { ...charm, gameId: 'mh3g' as const, skill2: { skillId: 20, nameCn: '第二技能', points: 2 } }
    expect(applyCharmValidation(snapshot, value).legality).toBe('confirmed')
    expect(applyCharmValidation(snapshot, { ...value, skill2: { ...value.skill2, points: 3 } }).legality).toBe('invalid')
  })
  it('does not upgrade reference-only thresholds to confirmed natural generation', () => {
    const { snapshot } = rulesFixture()
    snapshot.charmSlotRules!.forEach(rule => { rule.evidence = 'reference' })
    expect(checkCharmSlots(snapshot, charm)).toMatchObject({ status: 'unknown', maxSlots: 3 })
    expect(applyCharmValidation(snapshot, charm).legality).toBe('unknown')
  })
})
