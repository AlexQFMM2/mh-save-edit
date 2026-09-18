import { calculateLoadout } from './calculator'
import { getGameLoadoutRules } from './rules'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type LoadoutCatalogSnapshot, type LoadoutDecoration, type LogicalLoadout } from './types'
import type { SearchControl } from './searchControl'

type Pattern = { jewels: LoadoutDecoration[]; points: number[] }
type Layout = { choices: Pattern[][]; bounds: number[][]; failed: Set<string> }
type Prepared = { snapshot: LoadoutCatalogSnapshot; request: AutoLoadoutRequest; patterns: Map<number, Pattern[]>; layouts: Map<string, Layout>; failedCount: number; bits: number[] }
const prepared = new WeakMap<SearchControl, Prepared>()

function sums(points: number[], bits: number[]): number[] {
  const result = Array<number>(bits.length).fill(0)
  for (let mask = 1; mask < bits.length; mask++) result[mask] = result[mask & (mask - 1)] + points[bits[mask]]
  return result
}

/** Exact whole-container patterns for the affine (no changing modifiers) case.
 * Undefined requests the existing general solver; null proves this bounded
 * decoration problem infeasible. Signed surplus is never capped in memo keys. */
export async function assignDecorationPatterns(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, input: LogicalLoadout, relevant: Set<number>, control: SearchControl): Promise<LogicalLoadout | null | undefined> {
  if (request.targets.length > 8) return undefined
  const torsoId = getGameLoadoutRules(snapshot.gameId).torsoSkillId
  const specialIds = new Set(snapshot.gameId === 'mhgu' ? [torsoId, 204, 205] : [torsoId])
  const jewels = snapshot.decorations.filter(row => row.slots > 0 && row.slots <= 3 && row.skills.some(point => relevant.has(point.skillId) && point.points > 0))
  if (jewels.some(row => !Number.isInteger(row.slots) || row.skills.some(point => specialIds.has(point.skillId)))) return undefined
  const originalGear = [input.weapon, ...ARMOR_LOADOUT_SLOTS.map(part => input.armor[part]), input.charm].filter(row => row != null)
  if (originalGear.some(row => row.lock !== 'equipmentAndDecorations' && (!Number.isInteger(row.slots) || row.slots < 0 || row.slots > 3))) return undefined
  const current = structuredClone(input)
  const gear = [current.weapon, ...ARMOR_LOADOUT_SLOTS.map(part => current.armor[part]), current.charm].filter(row => row != null)
  for (const row of gear) if (row.lock !== 'equipmentAndDecorations') row.decorations = []
  const baseline = calculateLoadout(snapshot, current)
  if (baseline.encoding === 'blocked') return null
  if (snapshot.gameId === 'mhgu') {
    for (const id of [204, 205]) {
      const definition = snapshot.skills.find(row => row.skillId === id)
      if (!definition) return undefined
      const total = baseline.skills.find(row => row.skillId === id)?.total
      if (total == null) continue
      const threshold = definition.activations.filter(row => row.direction !== 'negative').sort((a, b) => a.threshold - b.threshold)[0]?.threshold
      if (threshold == null ? total > 0 : total >= threshold) return undefined
    }
  }
  const remaining = request.targets.map(target => target.threshold - (baseline.skills.find(row => row.skillId === target.skillId)?.total ?? 0))
  if (remaining.every(value => value <= 0)) return current
  const copies = ARMOR_LOADOUT_SLOTS.filter(part => part !== 'chest').reduce((sum, part) => sum + Math.max(0, current.armor[part]?.skills.find(point => point.skillId === torsoId)?.points ?? 0), 0)
  const containers = gear.filter(row => row.lock !== 'equipmentAndDecorations' && row.slots > 0).map(row => ({ row, multiplier: row === current.armor.chest ? 1 + copies : 1 })).sort((a, b) => b.multiplier - a.multiplier || b.row.slots - a.row.slots)
  if (!containers.length) return null
  let cache = prepared.get(control)
  if (!cache || cache.snapshot !== snapshot || cache.request !== request) {
    cache = { snapshot, request, patterns: new Map(), layouts: new Map(), failedCount: 0, bits: Array.from({ length: 1 << request.targets.length }, (_, mask) => mask ? 31 - Math.clz32(mask & -mask) : 0) }
    prepared.set(control, cache)
  }
  const state = cache
  for (const capacity of new Set(containers.map(container => container.row.slots))) {
    if (state.patterns.has(capacity)) continue
    const unique = new Map<string, Pattern>()
    const generate = async (start: number, free: number, selected: LoadoutDecoration[], points: number[]): Promise<void> => {
      await control.tick()
      const key = points.join(',')
      if (!unique.has(key)) unique.set(key, { jewels: [...selected], points: [...points] })
      if (selected.length === 3) return
      for (let i = start; i < jewels.length; i++) {
        const jewel = jewels[i]
        if (jewel.slots > free) continue
        const next = points.map((value, index) => value + jewel.skills.reduce((sum, point) => sum + (point.skillId === request.targets[index].skillId ? point.points : 0), 0))
        selected.push(jewel)
        await generate(i, free - jewel.slots, selected, next)
        selected.pop()
      }
    }
    await generate(0, capacity, [], request.targets.map(() => 0))
    const patterns = [...unique.values()]
    const frontier: Pattern[] = []
    for (const pattern of patterns) {
      await control.tick()
      // For one identical container, componentwise domination preserves target
      // feasibility. Modifiers were excluded, and no negative value is clamped.
      if (!patterns.some(other => other !== pattern && other.points.every((value, i) => value >= pattern.points[i]) && other.points.some((value, i) => value > pattern.points[i]))) frontier.push(pattern)
    }
    state.patterns.set(capacity, frontier)
  }
  const layoutKey = containers.map(container => `${container.row.slots}x${container.multiplier}`).join(',')
  let layout = state.layouts.get(layoutKey)
  if (!layout) {
    const choices = containers.map(container => state.patterns.get(container.row.slots)!.map(pattern => ({ jewels: pattern.jewels, points: pattern.points.map(value => value * container.multiplier) })))
    const bounds = Array.from({ length: choices.length + 1 }, () => Array<number>(state.bits.length).fill(0))
    for (let i = choices.length - 1; i >= 0; i--) {
      const maximum = Array<number>(state.bits.length).fill(-Infinity)
      for (const pattern of choices[i]) {
        const contribution = sums(pattern.points, state.bits)
        for (let mask = 1; mask < maximum.length; mask++) maximum[mask] = Math.max(maximum[mask], contribution[mask])
      }
      for (let mask = 1; mask < maximum.length; mask++) bounds[i][mask] = bounds[i + 1][mask] + maximum[mask]
    }
    layout = { choices, bounds, failed: new Set() }
    if (state.layouts.size < 256) state.layouts.set(layoutKey, layout)
  }
  const model = layout
  const selected: Pattern[] = []
  const search = async (index: number, deficits: number[]): Promise<boolean> => {
    await control.tick()
    if (deficits.every(value => value <= 0)) return true
    if (index === containers.length) return false
    const required = sums(deficits, state.bits)
    // Each subset shares the same finite containers. This is stronger than
    // pretending every target can spend every slot independently, yet optimistic.
    if (required.some((value, mask) => mask > 0 && value > model.bounds[index][mask])) return false
    const key = `${index}:${deficits.join(',')}`
    if (model.failed.has(key)) return false
    const score = (pattern: Pattern) => pattern.points.reduce((sum, value, i) => sum + Math.min(Math.max(0, deficits[i]), value), 0)
    const choices = [...model.choices[index]].sort((a, b) => score(b) - score(a))
    for (const pattern of choices) {
      selected[index] = pattern
      if (await search(index + 1, deficits.map((value, i) => value - pattern.points[i]))) return true
    }
    selected.length = index
    if (state.failedCount < 50000) { model.failed.add(key); state.failedCount++ }
    return false
  }
  if (!await search(0, remaining)) return null
  selected.forEach((pattern, index) => { containers[index].row.decorations = [...pattern.jewels] })
  const verified = calculateLoadout(snapshot, current)
  if (verified.encoding === 'blocked' || !request.targets.every(target => (verified.skills.find(row => row.skillId === target.skillId)?.total ?? 0) >= target.threshold)) return undefined
  return current
}
