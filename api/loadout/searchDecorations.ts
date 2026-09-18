import { calculateLoadout } from './calculator'
import { getGameLoadoutRules } from './rules'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type LoadoutCatalogSnapshot, type LoadoutDecoration, type LogicalLoadout } from './types'
import type { SearchControl } from './searchControl'

export async function assignDecorations(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, input: LogicalLoadout, relevant: Set<number>, control: SearchControl): Promise<LogicalLoadout | null> {
  const current = structuredClone(input)
  const gear = [current.weapon, ...ARMOR_LOADOUT_SLOTS.map(part => current.armor[part]), current.charm].filter((value): value is NonNullable<typeof value> => Boolean(value))
  for (const value of gear) if (value.lock !== 'equipmentAndDecorations') value.decorations = []
  const containers = gear.filter(value => value.lock !== 'equipmentAndDecorations' && value.slots > 0)
  const candidates = snapshot.decorations.filter(value => value.slots > 0 && value.slots <= 3 && value.skills.some(point => relevant.has(point.skillId) && point.points > 0)).sort((a, b) => b.skills.reduce((sum, point) => sum + (relevant.has(point.skillId) ? point.points : 0), 0) / b.slots - a.skills.reduce((sum, point) => sum + (relevant.has(point.skillId) ? point.points : 0), 0) / a.slots || a.saveId - b.saveId)
  const specialIds = new Set(snapshot.gameId === 'mhgu' ? [getGameLoadoutRules(snapshot.gameId).torsoSkillId, 204, 205] : [getGameLoadoutRules(snapshot.gameId).torsoSkillId])
  const specialJewels = candidates.some(value => value.skills.some(point => specialIds.has(point.skillId)))
  const torsoCopies = ARMOR_LOADOUT_SLOTS.filter(part => part !== 'chest').reduce((sum, part) => sum + Math.max(0, current.armor[part]?.skills.find(point => point.skillId === getGameLoadoutRules(snapshot.gameId).torsoSkillId)?.points ?? 0), 0)
  const rates = request.targets.map(target => Math.max(0, ...candidates.map(value => Math.max(0, value.skills.find(point => point.skillId === target.skillId)?.points ?? 0) / value.slots)))
  const failed = new Set<string>()
  const search = async (index: number, start: number): Promise<boolean> => {
    await control.tick()
    const calculation = calculateLoadout(snapshot, current)
    if (calculation.encoding === 'blocked') return false
    if (request.targets.every(target => (calculation.skills.find(value => value.skillId === target.skillId)?.total ?? 0) >= target.threshold)) return true
    if (index >= containers.length) return false
    // With no modifier jewels, total free slots times the best per-slot contribution is a safe upper bound.
    if (!specialJewels) {
      const free = containers.slice(index).reduce((sum, value) => sum + Math.max(0, value.slots - value.decorations.reduce((used, decoration) => used + decoration.slots, 0)), 0) * (1 + torsoCopies)
      if (request.targets.some((target, i) => (calculation.skills.find(value => value.skillId === target.skillId)?.total ?? 0) + free * rates[i] + (snapshot.gameId === 'mhgu' ? 2 : 0) < target.threshold)) return false
    }
    const key = `${index}:${start}:` + gear.map(value => value.decorations.map(decoration => decoration.saveId).join(',')).join('|')
    if (failed.has(key)) return false
    const container = containers[index]
    const used = container.decorations.reduce((sum, value) => sum + value.slots, 0)
    if (container.decorations.length < 3) for (let i = start; i < candidates.length; i++) {
      const decoration: LoadoutDecoration = candidates[i]
      if (used + decoration.slots > container.slots) continue
      container.decorations.push(decoration)
      if (await search(index, i)) return true
      container.decorations.pop()
    }
    if (await search(index + 1, 0)) return true
    failed.add(key)
    return false
  }
  return await search(0, 0) ? current : null
}
