import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { readStoredMh4gWitnessData, MH4G_RUNTIME_WITNESS_SHA256 } from '../../tools/runtime/mh4gCharmWitnessData.mjs'
import type { Mh4gCharmNativeInput } from './mh4gCharmTypes'
import type { LoadoutCalculationSnapshot } from './types'

type Evidence = Pick<LoadoutCalculationSnapshot, 'mh4gCharmWitnesses' | 'mh4gCharmWitnessSource' | 'mh4gCharmWitnessIssue'>

/** Code-owned trust root; the factory seam is for synthetic tests, not settings. */
export function createMh4gWitnessReader(expectedHash: string) {
  return (db: Database.Database, native: Mh4gCharmNativeInput): Evidence => {
    try {
      const input = readStoredMh4gWitnessData(db, native, expectedHash)
      if (!input) return { mh4gCharmWitnessIssue: '未加载 4G 已审核的最小生成见证；仅有静态规则，未启用自动护石。' }
      return {
        mh4gCharmWitnesses: input.outcomes,
        mh4gCharmWitnessSource: `mh4g-reviewed-outcomes:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`,
      }
    } catch (error) {
      return { mh4gCharmWitnessIssue: `4G 生成见证校验失败：${error instanceof Error ? error.message : String(error)}` }
    }
  }
}

// No runtime fallback to full reports and no app-side replay of private inputs.
export const readMh4gCharmWitnesses = createMh4gWitnessReader(MH4G_RUNTIME_WITNESS_SHA256)
