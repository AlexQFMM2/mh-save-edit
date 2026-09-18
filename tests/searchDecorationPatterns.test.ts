import { describe, expect, it } from 'vitest'
import { assignDecorationPatterns } from '../api/loadout/searchDecorationPatterns'
import { createArmorOrdering } from '../api/loadout/searchOrdering'
import { calculateLoadout } from '../api/loadout/calculator'
import { SearchControl } from '../api/loadout/searchControl'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type LoadoutCatalogSnapshot, type LoadoutDecoration, type LogicalLoadout } from '../api/loadout/types'

import { createPatternFixture as fixture } from './fixtures/searchPatterns'
const controller = (request: AutoLoadoutRequest) => new SearchControl(request, { checkpoint: async () => {}, progress: () => {} })
const meets = (snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, value: LogicalLoadout) => {
  const result = calculateLoadout(snapshot, value)
  return result.encoding !== 'blocked' && request.targets.every(target => (result.skills.find(row => row.skillId === target.skillId)?.total ?? 0) >= target.threshold)
}

// Independent small-space oracle: enumerate every decoration placement and use
// the authoritative calculator. No contribution-vector bound or memoization.
function brute(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, input: LogicalLoadout) {
  const value = structuredClone(input)
  const containers = [value.weapon, ...ARMOR_LOADOUT_SLOTS.map(part => value.armor[part]), value.charm].filter(row => row != null).filter(row => row.lock !== 'equipmentAndDecorations')
  for (const row of containers) row.decorations = []
  const options = (free: number, start = 0, chosen: LoadoutDecoration[] = []): LoadoutDecoration[][] => {
    const values = [[...chosen]]
    if (chosen.length < 3) for (let i = start; i < snapshot.decorations.length; i++) if (snapshot.decorations[i].slots <= free) values.push(...options(free - snapshot.decorations[i].slots, i, [...chosen, snapshot.decorations[i]]))
    return values
  }
  const search = (index: number): boolean => {
    if (index === containers.length) return meets(snapshot, request, value)
    for (const decorations of options(containers[index].slots)) { containers[index].decorations = decorations; if (search(index + 1)) return true }
    return false
  }
  return search(0)
}

describe('whole-container decoration patterns', () => {
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('matches exhaustive small-space feasibility with signed points, fixed jewels and torso copies: %s', async game => {
    let feasible = 0
    let infeasible = 0
    for (let seed = 0; seed < 24; seed++) {
      const { snapshot, loadout, request, torsoId } = fixture(game)
      loadout.armor.head!.skills = [{ skillId: 10, nameCn: 'A', points: seed % 9 - 3 }, { skillId: 11, nameCn: 'B', points: (seed * 7) % 11 - 4 }]
      if (seed % 3 === 0) loadout.armor.arms!.skills = [{ skillId: torsoId, nameCn: 'Torso', points: 1 }]
      if (seed % 4 === 0) { loadout.armor.head!.lock = 'equipmentAndDecorations'; loadout.armor.head!.decorations = [snapshot.decorations[0]] }
      request.targets[0].threshold = 1 + seed % 5
      request.targets[1].threshold = 1 + (seed * 3) % 7
      const before = structuredClone(loadout)
      const result = await assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11, torsoId]), controller(request))
      expect(result).not.toBeUndefined()
      const expected = brute(snapshot, request, loadout)
      if (expected) feasible++; else infeasible++
      expect(Boolean(result), `seed=${seed}`).toBe(expected)
      if (result) expect(meets(snapshot, request, result)).toBe(true)
      expect(loadout).toEqual(before)
    }
    expect(feasible).toBeGreaterThan(0)
    expect(infeasible).toBeGreaterThan(0)
  })
  it('orders by unmet targets without deleting negative or modifier-bearing armor', () => {
    const { snapshot, loadout, request } = fixture()
    loadout.armor.head!.skills = [{ skillId: 10, nameCn: 'A', points: 10 }]
    const candidates = [
      { ...loadout.armor.chest!, candidateKey: 'high-a', skills: [{ skillId: 10, nameCn: 'A', points: 10 }] },
      { ...loadout.armor.chest!, candidateKey: 'fill-b', skills: [{ skillId: 11, nameCn: 'B', points: 4 }] },
      { ...loadout.armor.chest!, candidateKey: 'signed', skills: [{ skillId: 10, nameCn: 'A', points: -2 }, { skillId: 205, nameCn: 'boost', points: 1 }] },
    ]
    const bySlot = ARMOR_LOADOUT_SLOTS.map(part => part === 'chest' ? candidates : [loadout.armor[part]!])
    const before = structuredClone(bySlot)
    const order = createArmorOrdering(snapshot, request, bySlot, new Set([10, 11, 203, 204, 205]))
    expect(order(loadout, 1)[0].candidateKey).toBe('fill-b')
    expect(order(loadout, 1).map(row => row.candidateKey).sort()).toEqual(candidates.map(row => row.candidateKey).sort())
    expect(bySlot).toEqual(before)
  })
  it('retains negative deficits (surplus) across cached layouts', async () => {
    const { snapshot, loadout, request } = fixture()
    snapshot.decorations = [{ saveId: 1, nameCn: 'signed', slots: 1, skills: [{ skillId: 10, nameCn: 'A', points: -5 }, { skillId: 11, nameCn: 'B', points: 3 }] }]
    loadout.armor.chest!.slots = 0
    request.targets[0].threshold = 5
    const control = controller(request)
    for (const points of [6, 10, 6, 11]) {
      loadout.armor.head!.skills = [{ skillId: 10, nameCn: 'A', points }]
      const result = await assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11]), control)
      expect(Boolean(result)).toBe(points >= 10)
    }
  })
  it('defers modifier-bearing inputs and modifier jewels to the general solver', async () => {
    const { snapshot, loadout, request } = fixture()
    loadout.armor.arms!.skills = [{ skillId: 205, nameCn: 'boost', points: 10 }]
    expect(await assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11, 205]), controller(request))).toBeUndefined()
    loadout.armor.arms!.skills[0].points = 3
    expect(await assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11, 205]), controller(request))).not.toBeUndefined()
    loadout.armor.arms!.skills = []
    snapshot.decorations[0].skills.push({ skillId: 204, nameCn: 'secret', points: -1 })
    expect(await assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11, 204]), controller(request))).toBeUndefined()
  })
  it('propagates cooperative cancellation during pattern preparation', async () => {
    const { snapshot, loadout, request } = fixture()
    const control = { tick: async () => { throw new Error('cancelled') } } as unknown as SearchControl
    await expect(assignDecorationPatterns(snapshot, request, loadout, new Set([10, 11]), control)).rejects.toThrow('cancelled')
  })
})
