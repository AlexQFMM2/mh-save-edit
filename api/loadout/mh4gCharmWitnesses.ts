import type { LoadoutCalculationSnapshot, LoadoutCharm } from './types'
import type { Mh4gCharmWitness } from './mh4gCharmTypes'

const indexes = new WeakMap<Mh4gCharmWitness[], Map<string, Mh4gCharmWitness>>()
const key = (fields: number[]) => fields.join(':')

/** Exact outcome membership; no extrapolation from maxima or marginal ranges. */
export function findMh4gCharmWitness(snapshot: LoadoutCalculationSnapshot, charm: Pick<LoadoutCharm, 'classId' | 'slots' | 'skill1' | 'skill2'>): Mh4gCharmWitness | undefined {
  const witnesses = snapshot.mh4gCharmWitnesses
  if (!snapshot.mh4gCharmRules || !snapshot.mh4gCharmWitnessSource || !witnesses) return undefined
  let index = indexes.get(witnesses)
  if (!index) {
    index = new Map(witnesses.map(row => [key(row.slice(0, 6)), row]))
    indexes.set(witnesses, index)
  }
  return index.get(key([charm.classId, charm.slots, charm.skill1?.skillId ?? 0, charm.skill1?.points ?? 0, charm.skill2?.skillId ?? 0, charm.skill2?.points ?? 0]))
}

export const MH4G_WITNESS_NOTICE_CODE = 'charm.mh4g.witness.confirmed'
export const MH4G_WITNESS_SCOPE_MESSAGE = '已匹配开发阶段独立核对的 4G 鉴定函数生成结果；正常游玩初态可达性、其他产出路径及实际浮点状态不在本见证证明范围内。'
export const MH4G_WITNESS_COVERAGE_MESSAGE = '4G 护石仅搜索已独立核对的有界生成见证，未穷举全部护石；搜索结束不构成全域无解证明。'
