import type Database from 'better-sqlite3'
import { readStoredMh4gNative } from '../../tools/runtime/mh4gCharmNative.mjs'
import type { LoadoutCalculationSnapshot, LoadoutCharmRange } from './types'
import { readMh4gCharmWitnesses } from './mh4gCharmWitnessRepository'

type Evidence = Pick<LoadoutCalculationSnapshot, 'mh4gCharmRules' | 'mh4gCharmRulesIssue' | 'mh4gCharmWitnesses' | 'mh4gCharmWitnessSource' | 'mh4gCharmWitnessIssue'>

/** One input validator is shared with preparation; no runtime copy of its rules. */
export function readMh4gCharmEvidence(db: Database.Database, ranges: LoadoutCharmRange[]): Evidence {
  try {
    const input = readStoredMh4gNative(db)
    if (!input) return { mh4gCharmRulesIssue: '未加载 4G 原生鉴定资料；当前范围资料不能单独证明联合生成合法性。' }
    const expected = new Set<string>()
    for (const group of input.groups) for (const band of group.classes) for (const position of ['A', 'B'] as const) {
      for (const [id, min, max] of group.pools[position].rows) expected.add(JSON.stringify([band.classId, position, id, min, max, null]))
    }
    const actual = new Set(ranges.map(row => JSON.stringify([row.classId, row.position, row.skillId, row.minPoints, row.maxPoints, row.slotCount])))
    if (actual.size !== ranges.length || expected.size !== actual.size || [...expected].some(key => !actual.has(key))) throw new Error('显示范围与原生技能池不一致，请重新准备 4G 资料')
    return { mh4gCharmRules: input, ...readMh4gCharmWitnesses(db, input) }
  } catch (error) {
    return { mh4gCharmRulesIssue: `4G 原生资料校验失败：${error instanceof Error ? error.message : String(error)}` }
  }
}
