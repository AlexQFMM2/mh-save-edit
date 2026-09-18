import type { LoadoutCalculationSnapshot, LoadoutCharm } from './types'

const indexes = new WeakMap<LoadoutCalculationSnapshot, Set<string>>()
const key = (row: number[]) => [row[0], row[1], row[3] === 0 ? 0 : row[2], row[3], row[5] === 0 ? 0 : row[4], row[5]].join(':')

export function isExactCharmCombination(snapshot: LoadoutCalculationSnapshot, charm: LoadoutCharm): boolean | null {
  if (snapshot.gameId !== 'mh3g' || !snapshot.charmCombinations) return null
  let index = indexes.get(snapshot)
  if (!index) { index = new Set(snapshot.charmCombinations.map(key)); indexes.set(snapshot, index) }
  return index.has(key([charm.classId, charm.slots, charm.skill1?.skillId ?? 0, charm.skill1?.points ?? 0, charm.skill2?.skillId ?? 0, charm.skill2?.points ?? 0]))
}
