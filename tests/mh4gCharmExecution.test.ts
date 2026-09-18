import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { replayMh4gAppraisal, type Mh4gRandomState } from '../api/loadout/mh4gCharmReplay'

const executionFile = process.env.MH4G_CHARM_EXECUTION_FILE
// Explicit private evidence opt-in; no instruction bytes or real game tables
// are fixtures in the public repository or required by ordinary release CI.
describe.skipIf(!executionFile)('private isolated ARM/model differential', () => {
  it('matches native instruction output, final RNG states and exact float32 bits', () => {
    const evidence = JSON.parse(readFileSync(executionFile!, 'utf8')) as {
      format: string; engine: string; fpscr: number
      cases: { groupIndex: number; initialState: Mh4gRandomState; finalState: Mh4gRandomState; classId: number; slots: number; skill1Id: number; skill1Points: number; skill2Id: number; skill2Points: number; fulfillmentBits: number; row: number }[]
    }
    expect(evidence.format).toBe('mh4g-charm-execution-v1')
    expect(evidence.engine).toBe('unicorn-2.1.4-arm1176')
    expect(evidence.fpscr).toBe(0x03000000)
    expect(evidence.cases.length).toBeGreaterThan(0)
    const db = new Database(fileURLToPath(new URL('../data/mh4g.sqlite', import.meta.url)), { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mh4g').getBootstrap()
      expect(snapshot.mh4gCharmRulesIssue).toBeUndefined()
      const native = snapshot.mh4gCharmRules!
      const groups = new Set<number>()
      for (const expected of evidence.cases) {
        const result = replayMh4gAppraisal(native.groups[expected.groupIndex], expected.initialState)
        const { sourceItemId: _sourceItemId, fulfillment, ...fields } = result
        const fulfillmentBits = new Uint32Array(new Float32Array([fulfillment]).buffer)[0]
        expect({ ...fields, fulfillmentBits }).toEqual(expected)
        groups.add(result.groupIndex)
      }
      expect([...groups].sort()).toEqual([0, 1, 2, 3, 4, 5])
      console.info(`Independent ARM/model agreement: ${evidence.cases.length} cases; chosen FPSCR and initial states, not exhaustive natural reachability.`)
    } finally { db.close() }
  })
})
