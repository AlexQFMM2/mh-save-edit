import type { LoadoutCalculationSnapshot, LoadoutCharm } from './types'

export type CharmSlotCheck = { status: 'confirmed' | 'invalid' | 'unknown'; maxSlots: number | null; source?: string }

/** GU position pools combine independently; fulfillment still couples both positions to slots. */
export function checkCharmSlots(snapshot: LoadoutCalculationSnapshot, charm: LoadoutCharm): CharmSlotCheck {
  if (snapshot.gameId !== 'mhgu') return { status: 'unknown', maxSlots: null }
  const rules = snapshot.charmSlotRules?.filter(rule => rule.classId === charm.classId) ?? []
  if (!rules.length) return { status: 'unknown', maxSlots: null }
  if (!charm.skill1 && charm.skill2) return { status: 'invalid', maxSlots: null, source: rules[0].source }
  let numerator = 0; let denominator = 1
  for (const [position, skill] of [['A', charm.skill1], ['B', charm.skill2]] as const) {
    if (!skill) continue
    const ranges = snapshot.charmRanges.filter(range => range.classId === charm.classId && range.position === position && range.skillId === skill.skillId)
    if (!ranges.length) return { status: 'unknown', maxSlots: null }
    const max = Math.max(...ranges.map(range => range.maxPoints))
    if (max <= 0 || (position === 'A' && skill.points <= 0) || !ranges.some(range => skill.points >= range.minPoints && skill.points <= range.maxPoints)) return { status: 'invalid', maxSlots: null, source: ranges[0].source }
    // Integer rational arithmetic avoids 9.999999 rounding down at exact bucket boundaries.
    numerator = numerator * max + Math.max(0, skill.points) * 10 * denominator
    denominator *= max
  }
  const fulfillment = !charm.skill1 && !charm.skill2 ? 0 : Math.min(20, Math.max(1, Math.floor(numerator / denominator)))
  const matches = rules.filter(rule => rule.fulfillment === fulfillment)
  if (matches.length !== 1) return { status: 'unknown', maxSlots: null }
  const rule = matches[0]
  let maxSlots = 0
  for (let slot = 1; slot <= 3; slot++) if (rule.thresholds[slot - 1] < 100) maxSlots = slot
  maxSlots = Math.min(maxSlots, rule.maxSlots)
  // A pinned community reference is not native-generation proof; never upgrade it silently.
  if (rule.evidence !== 'verified') return { status: 'unknown', maxSlots, source: rule.source }
  const cumulative = [0, ...rule.thresholds, 100]
  const possible = charm.slots >= 0 && charm.slots <= maxSlots && cumulative[charm.slots + 1] > cumulative[charm.slots]
  return { status: possible ? 'confirmed' : 'invalid', maxSlots, source: rule.source }
}
