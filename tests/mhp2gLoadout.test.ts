import { describe, expect, it } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { reconcileImportedLoadout } from '../api/loadout/file'
import { logicalLoadoutSchema, autoLoadoutRequestSchema } from '../api/loadout/schemas'
import { validateAutoResult } from '../api/loadout/resultValidation'
import { ARMOR_LOADOUT_SLOTS, type LoadoutArmor, type LoadoutDecoration } from '../api/loadout/types'
import { nativeArmor, nativeJewel, p2gLoadoutFixture } from './fixtures/p2gLoadout'

const context = { checkpoint: async () => {}, progress: () => {} }

describe('P2G logical identity and calculation', () => {
  it('round-trips native identities without inventing save IDs or a charm', () => {
    const { snapshot, loadout, request } = p2gLoadoutFixture()
    loadout.weapon!.decorations = [snapshot.decorations[0]]
    expect(logicalLoadoutSchema.parse(JSON.parse(JSON.stringify(loadout)))).toEqual(loadout)
    expect(autoLoadoutRequestSchema.parse(request).gameId).toBe('mhp2g')
    const result = calculateLoadout(snapshot, loadout)
    expect(result.encoding).toBe('encodable')
    expect(result.legality).toBe('confirmed')
    expect(result.slots).toHaveLength(6)
    expect(result).toMatchObject({ defense: 27, maxDefense: 127, resistances: { fire: -10, water: 5, thunder: 0, ice: 15, dragon: -5 } })
    expect(loadout.charm).toBeNull()
  })

  it('rejects fake identities, cross-game jewels, relics, instances and charms', () => {
    const { loadout } = p2gLoadoutFixture()
    for (const patch of [{ saveId: 1 }, { saveType: 7 }, { sourceKind: 'relicTemplate' }, { instance: { recordHex: '00'.repeat(16) } }, { weaponKey: 'weapon_blademaster:0' }, { decorations: [{ saveId: 1, nameCn: 'wrong', slots: 1, skills: [] }] }]) {
      expect(logicalLoadoutSchema.safeParse({ ...loadout, weapon: { ...loadout.weapon, ...patch } }).success).toBe(false)
    }
    expect(logicalLoadoutSchema.safeParse({ ...loadout, armor: { head: { ...loadout.armor.head, dexId: 1 } } }).success).toBe(false)
    expect(logicalLoadoutSchema.safeParse({ ...loadout, charm: { kind: 'charm', gameId: 'mh3g', classId: 1, classNameCn: '', slots: 0, skill1: null, skill2: null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' } }).success).toBe(false)
  })

  it.each([-21, -20, -19, -15, -14, -10, -9, 0, 9, 10, 14, 15, 19, 20, 21])('selects the correct activation at %i points', points => {
    const { snapshot, loadout } = p2gLoadoutFixture()
    loadout.armor = { head: nativeArmor('head', 1, points) }
    const expected = points >= 20 ? 20 : points >= 15 ? 15 : points >= 10 ? 10 : points <= -20 ? -20 : points <= -15 ? -15 : points <= -10 ? -10 : null
    expect(calculateLoadout(snapshot, loadout).skills.find(s => s.skillId === 10)?.activation?.threshold ?? null).toBe(expected)
  })

  it('multiplies signed chest armor and jewels, but not jewels in torso-copy pieces', () => {
    const { snapshot, loadout } = p2gLoadoutFixture()
    loadout.armor = { chest: { ...nativeArmor('chest'), skills: [{ skillId: 10, nameCn: '合成甲', points: 3 }, { skillId: 11, nameCn: '合成乙', points: -4 }], decorations: [snapshot.decorations[0]] } }
    for (const part of ['head', 'arms', 'waist', 'legs'] as const) loadout.armor[part] = { ...nativeArmor(part), skills: [{ skillId: 1, nameCn: '倍加', points: 1 }], slots: 1, decorations: part === 'head' ? [snapshot.decorations[1]] : [] }
    const result = calculateLoadout(snapshot, loadout)
    expect(result.skills.find(s => s.skillId === 10)).toMatchObject({ total: 24, special: 20, decorations: 1, chest: 3 })
    expect(result.skills.find(s => s.skillId === 11)).toMatchObject({ total: -23, special: -20, decorations: 1, chest: -4 })
    delete loadout.armor.chest
    expect(calculateLoadout(snapshot, loadout).skills.find(s => s.skillId === 10)?.total).toBe(-1)
  })

  it('rehydrates business values and rejects removed or mismatched identities without mutating input', () => {
    const { snapshot, loadout } = p2gLoadoutFixture()
    loadout.weapon!.defense = 999
    loadout.weapon!.decorations = [{ ...snapshot.decorations[0], slots: 0, skills: [] }]
    loadout.armor.head!.skills = []
    const before = structuredClone(loadout)
    const hydrated = reconcileImportedLoadout(snapshot, loadout)
    expect(hydrated.weapon).toMatchObject({ defense: 2, decorations: [{ slots: 1, skills: snapshot.decorations[0].skills }] })
    expect(hydrated.armor.head!.skills).toHaveLength(2)
    expect(loadout).toEqual(before)
    loadout.weapon!.decorations = [nativeJewel(999, 100, 100)]
    expect(() => reconcileImportedLoadout(snapshot, loadout)).toThrow('装饰品已不在')
    loadout.weapon!.decorations = []
    if (loadout.weapon!.gameId === 'mhp2g') loadout.weapon!.weaponKey = 'weapon_blademaster:2'
    expect(() => reconcileImportedLoadout(snapshot, loadout)).toThrow('身份与候选键')
  })

  it('does not synthesize component skill points for a compound activation', () => {
    const { snapshot, loadout } = p2gLoadoutFixture()
    snapshot.skills[1].activations[0].components = [{ skillId: 11, activationKey: 'p2g-test:11:10', nameCn: '合成组成' }]
    expect(calculateLoadout(snapshot, loadout).skills.find(s => s.skillId === 11)?.total).toBe(5)
  })
})

describe('P2G search and revalidation', () => {
  it('searches native candidates without a charm stage and preserves the request', async () => {
    const { snapshot, request } = p2gLoadoutFixture(), stages: string[] = []
    const before = structuredClone(request)
    const report = await runAutoLoadout(snapshot, request, { ...context, progress: p => stages.push(p.stage) })
    expect(report.results).toHaveLength(1)
    expect(report.results[0].loadout.charm).toBeNull()
    expect(report.results[0].calculation).toMatchObject({ legality: 'confirmed', encoding: 'encodable' })
    expect(stages.some(s => s.includes('护石'))).toBe(false)
    expect(report.progress.searchComplete).toBe(true)
    expect(request).toEqual(before)
  })

  it.each(['gender', 'combat', 'slots'] as const)('keeps manual %s warnings but rejects incompatible fixed automatic inputs', async field => {
    const { snapshot, loadout, request } = p2gLoadoutFixture()
    const head = loadout.armor.head!
    head.lock = 'equipmentAndDecorations'
    if (field === 'gender') head.gender = 'female'
    if (field === 'combat') head.combat = 'gunner'
    if (field === 'slots') head.decorations = [snapshot.decorations[0]]
    expect(calculateLoadout(snapshot, loadout)).toMatchObject({ legality: 'invalid', encoding: 'encodable' })
    await expect(runAutoLoadout(snapshot, request, context)).rejects.toThrow('固定装备不适用')
  })

  it('checks current target identity, current thresholds, version and applicability before applying history', () => {
    const { snapshot, loadout, request } = p2gLoadoutFixture()
    expect(() => validateAutoResult(snapshot, loadout, request.targets)).not.toThrow()
    snapshot.skills[1].activations[0].threshold = 15
    expect(() => validateAutoResult(snapshot, loadout, request.targets)).toThrow('不再满足目标')
    request.targets[0].activationKey = 'removed'
    expect(() => validateAutoResult(snapshot, loadout, request.targets)).toThrow('目标不存在')
    loadout.dataVersion = 'old'
    expect(() => validateAutoResult(snapshot, loadout, request.targets)).toThrow('资料版本')
  })

  it('matches an independent unpruned oracle with signed jewels, multiple torso copies and multiple targets', async () => {
    const { snapshot, request } = p2gLoadoutFixture()
    snapshot.armors = ARMOR_LOADOUT_SLOTS.flatMap(part => [nativeArmor(part, 1, part === 'chest' ? 3 : -1), { ...nativeArmor(part, 2, 2), skills: part === 'chest' ? [{ skillId: 10, nameCn: 'A', points: -2 }, { skillId: 11, nameCn: 'B', points: 4 }] : [{ skillId: 1, nameCn: '复制', points: 1 }] }])
    request.targets = [10, 11].map(skillId => ({ activationKey: `p2g-test:${skillId}:10`, skillId, threshold: 10, nameCn: '合成目标' }))
    const patterns = (capacity: number, start = 0): LoadoutDecoration[][] => {
      const result: LoadoutDecoration[][] = [[]]
      for (let i = start; i < snapshot.decorations.length; i++) {
        const jewel = snapshot.decorations[i]
        if (jewel.slots <= capacity) for (const tail of patterns(capacity - jewel.slots, i)) result.push([jewel, ...tail])
      }
      return result
    }
    const points = (values: { skillId: number; points: number }[], id: number) => values.reduce((n, p) => n + (p.skillId === id ? p.points : 0), 0)
    const expected: string[] = []
    for (let mask = 0; mask < 32; mask++) {
      const armor = ARMOR_LOADOUT_SLOTS.map((part, index) => snapshot.armors.find(a => a.part === part && a.candidateKey.endsWith(`:${mask & (1 << index) ? 2 : 1}`))!) as LoadoutArmor[]
      const copies = armor.filter(a => a.part !== 'chest').reduce((n, a) => n + points(a.skills, 1), 0)
      const multipliers = [1, ...armor.map(a => a.part === 'chest' ? 1 + copies : 1)]
      const containers = [request.baseLoadout.weapon!, ...armor]
      const baseline = [10, 11].map(id => armor.reduce((n, a) => n + points(a.skills, id) * (a.part === 'chest' ? 1 + copies : 1), 0))
      const enumerate = (index: number, totals: number[]): boolean => {
        if (index === containers.length) return totals.every(n => n >= 10)
        return patterns(containers[index].slots).some(jewels => enumerate(index + 1, totals.map((n, i) => n + jewels.reduce((sum, j) => sum + points(j.skills, [10, 11][i]), 0) * multipliers[index])))
      }
      if (enumerate(0, baseline)) expected.push(armor.map(a => a.candidateKey).join(','))
    }
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(32)
    const report = await runAutoLoadout(snapshot, request, context)
    expect(report.progress.searchComplete).toBe(true)
    expect(report.results.map(r => ARMOR_LOADOUT_SLOTS.map(part => r.loadout.armor[part]!.candidateKey).join(',')).sort()).toEqual(expected.sort())
    for (const result of report.results) expect(() => validateAutoResult(snapshot, result.loadout, request.targets)).not.toThrow()
  })
})
