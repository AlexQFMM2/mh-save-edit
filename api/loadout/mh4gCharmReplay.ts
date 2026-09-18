import { mh4gClassFor, mh4gFulfillment } from './mh4gCharmRules'
import type { Mh4gAppraisalGroup, Mh4gSkillRange } from './mh4gCharmTypes'

export type Mh4gRandomState = [number, number]
export type Mh4gAppraisalReplay = {
  groupIndex: number
  sourceItemId: number
  initialState: Mh4gRandomState
  finalState: Mh4gRandomState
  classId: number
  slots: number
  skill1Id: number
  skill1Points: number
  skill2Id: number
  skill2Points: number
  fulfillment: number
  row: number
}

/** Equivalent to the reviewed MUL/UMLAL/LSR/MLA/UXTH for every uint16 input. */
export function nextMh4gRandomState(state: number): number {
  if (!Number.isInteger(state) || state < 0 || state > 0xffff) throw new Error('MH4G RNG state must be uint16')
  return ((state || 1) * 176) % 65363
}

/**
 * Deterministic functional replay of the reviewed appraisal path, not a claim
 * that an arbitrary initial pair occurs in a naturally initialized game.
 * Keep this boundary explicit until independently checked generation witnesses
 * and the source-state assumptions can be attached to candidates.
 */
export function replayMh4gAppraisal(group: Mh4gAppraisalGroup, initial: Mh4gRandomState): Mh4gAppraisalReplay {
  if (!Array.isArray(initial) || initial.length !== 2) throw new Error('MH4G replay requires two RNG states')
  initial.forEach(nextMh4gRandomState)
  const state: Mh4gRandomState = [...initial]
  const draw = (stream: 0 | 1) => state[stream] = nextMh4gRandomState(state[stream])
  const points = (range: Mh4gSkillRange, signStream: 0 | 1): number => {
    let min = range[1]
    let count = range[2] - min + 1
    if (range[2] > 0 && min <= 0) {
      if (draw(signStream) & 1) { min = 1; count = range[2] }
      else count = 1 - min
    }
    if (count <= 0) throw new Error('Invalid MH4G point range')
    // Even a singleton range consumes both draws in the executable.
    return min + ((draw(1) ^ draw(0)) % count)
  }
  const aPool = group.pools.A.rows
  if (!aPool.length) throw new Error('MH4G appraisal requires an A pool')
  const a = aPool[draw(1) % aPool.length]
  const aPoints = points(a, 0)
  const aId = aPoints ? a[0] : 0
  let b: Mh4gSkillRange | undefined
  let bId = 0
  let bPoints = 0
  const chance = (draw(1) ^ draw(0)) % 100
  if (chance >= 100 - group.secondSkillAttemptPercent) {
    const bPool = group.pools.B.rows
    if (!bPool.length) throw new Error('MH4G B attempt has no pool')
    b = bPool[draw(0) % bPool.length]
    bPoints = points(b, 1)
    bId = bPoints ? b[0] : 0
  }
  if (aId === bId) { bId = 0; bPoints = 0 }
  const contributions = [{ points: aPoints, maxPoints: a[2] }]
  if (b) contributions.push({ points: bPoints, maxPoints: b[2] })
  const fulfillment = mh4gFulfillment(contributions)
  const stream = draw(1) & 0x80 ? 1 : 0
  const slotRoll = draw(stream) % 100
  const weights = group.slotWeights[fulfillment.row]
  if (!weights || weights.length !== 4 || weights.some(weight => !Number.isInteger(weight) || weight < 0) || weights.reduce((a, b) => a + b, 0) !== 100) throw new Error('Invalid MH4G slot weights')
  let cumulative = 0
  let slots = 0
  while (slots < 4) {
    cumulative += weights[slots]
    if (slotRoll < cumulative) break
    slots++
  }
  const classId = mh4gClassFor(group, fulfillment.value, slots)
  if (classId == null || slots > 3) throw new Error('MH4G appraisal result cannot be classified')
  return { groupIndex: group.groupIndex, sourceItemId: group.sourceItemId, initialState: [...initial], finalState: state, classId, slots, skill1Id: aId, skill1Points: aPoints, skill2Id: bId, skill2Points: bPoints, fulfillment: fulfillment.value, row: fulfillment.row }
}
