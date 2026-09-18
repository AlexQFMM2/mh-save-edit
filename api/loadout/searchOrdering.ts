import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type LoadoutArmor, type LoadoutCatalogSnapshot, type LogicalLoadout } from './types'

/** Goal-directed visitation only: keeps every candidate and never supplies a
 * feasibility bound. Signed points are unchanged in the actual search state. */
export function createArmorOrdering(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, bySlot: LoadoutArmor[][], relevant: Set<number>) {
  const targets = request.targets
  const weights = targets.map(target => {
    const rate = snapshot.decorations.reduce((best, jewel) => jewel.slots > 0 ? Math.max(best, jewel.skills.reduce((sum, point) => sum + (point.skillId === target.skillId ? point.points : 0), 0) / jewel.slots) : best, 0)
    return 100 / Math.max(0.25, rate)
  })
  const points = new Map<LoadoutArmor, number[]>()
  const modifierScores = new Map<LoadoutArmor, number>()
  for (const rows of bySlot) for (const row of rows) {
    points.set(row, targets.map(target => row.skills.reduce((sum, point) => sum + (point.skillId === target.skillId ? point.points : 0), 0)))
    modifierScores.set(row, row.skills.reduce((sum, point) => sum + (relevant.has(point.skillId) && !targets.some(target => target.skillId === point.skillId) ? point.points * 20 : 0), 0))
  }
  const fixedCharm = request.baseLoadout.charm?.lock !== 'unlocked' ? request.baseLoadout.charm : null
  const initial = targets.map(target => target.threshold - [fixedCharm?.skill1, fixedCharm?.skill2].reduce((sum, point) => sum + (point?.skillId === target.skillId ? point.points : 0), 0))
  const cache = new Map<string, LoadoutArmor[]>()
  return (base: LogicalLoadout, depth: number): LoadoutArmor[] => {
    if (bySlot[depth].length < 2) return bySlot[depth]
    const deficits = [...initial]
    for (let i = 0; i < depth; i++) {
      const armor = base.armor[ARMOR_LOADOUT_SLOTS[i]]
      if (armor) points.get(armor)!.forEach((value, index) => { deficits[index] -= value })
    }
    const key = `${depth}:${deficits.join(',')}`
    const existing = cache.get(key)
    if (existing) return existing
    const ranked = bySlot[depth].map(armor => ({ armor, score: points.get(armor)!.reduce((sum, value, i) => sum + Math.min(Math.max(0, deficits[i]), value) * weights[i], 0) + armor.slots * 100 + modifierScores.get(armor)! }))
    ranked.sort((a, b) => b.score - a.score || b.armor.maxDefense - a.armor.maxDefense || a.armor.candidateKey.localeCompare(b.armor.candidateKey))
    const rows = ranked.map(row => row.armor)
    if (cache.size < 256) cache.set(key, rows)
    return rows
  }
}
