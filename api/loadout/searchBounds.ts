import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type LoadoutArmor, type LoadoutCatalogSnapshot, type LogicalLoadout, type LoadoutSkillPoint } from './types'
import { getGameLoadoutRules } from './rules'

/** Componentwise optimistic bounds only. Negative values are never used for dominance.
 * Multiplying every contribution by maximum torso copies deliberately overestimates
 * non-chest contributions, so enabling skills cannot remove a feasible branch. */
export function createSearchBounds(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, bySlot: LoadoutArmor[][], charms: LogicalLoadout['charm'][]) {
  const positive = (points: LoadoutSkillPoint[], skillId: number) => points.reduce((sum, point) => sum + (point.skillId === skillId ? Math.max(0, point.points) : 0), 0)
  const torsoId = getGameLoadoutRules(snapshot.gameId).torsoSkillId
  const maxTorso = bySlot.map((values, index) => ARMOR_LOADOUT_SLOTS[index] === 'chest' ? 0 : values.reduce((max, value) => Math.max(max, positive(value.skills, torsoId)), 0))
  const targets = request.targets.map(target => {
    const rate = snapshot.decorations.reduce((max, value) => value.slots > 0 ? Math.max(max, positive(value.skills, target.skillId) / value.slots) : max, 0)
    const decorationBound = (value: { slots: number; decorations: { skills: LoadoutSkillPoint[] }[] }) => positive(value.decorations.flatMap(item => item.skills), target.skillId) + Math.ceil(rate * Math.max(0, value.slots))
    const armorBound = (value: LoadoutArmor) => positive(value.skills, target.skillId) + decorationBound(value)
    const suffix = Array<number>(6).fill(0)
    for (let i = 4; i >= 0; i--) suffix[i] = suffix[i + 1] + bySlot[i].reduce((max, value) => Math.max(max, armorBound(value)), 0)
    const charmBound = charms.reduce((max, value) => !value ? max : Math.max(max, positive([value.skill1, value.skill2].filter((point): point is LoadoutSkillPoint => Boolean(point)), target.skillId) * (snapshot.gameId === 'mhgu' ? 2 : 1) + decorationBound(value)), 0)
    return { target, armorBound, suffix, extra: charmBound + (request.baseLoadout.weapon ? decorationBound(request.baseLoadout.weapon) : 0) + (snapshot.gameId === 'mhgu' ? 2 : 0) }
  })
  return (base: LogicalLoadout, depth: number) => {
    let copies = 0
    for (let i = 0; i < 5; i++) if (ARMOR_LOADOUT_SLOTS[i] !== 'chest') copies += i < depth ? positive(base.armor[ARMOR_LOADOUT_SLOTS[i]]?.skills ?? [], torsoId) : maxTorso[i]
    return targets.every(({ target, armorBound, suffix, extra }) => {
      let bound = suffix[depth] + extra
      for (let i = 0; i < depth; i++) { const value = base.armor[ARMOR_LOADOUT_SLOTS[i]]; if (value) bound += armorBound(value) }
      return bound * (1 + copies) >= target.threshold
    })
  }
}
