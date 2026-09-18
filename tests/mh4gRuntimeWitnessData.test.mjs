import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { database, syntheticNative } from './fixtures/mh4gCharm.mjs'
import { syntheticExecution } from './fixtures/mh4gExecution.mjs'
import { projectMh4gWitnesses } from '../tools/runtime/projectMh4gWitnesses'
import { sha256 } from '../tools/runtime/mh4gCharmNative.mjs'
import { repairMh4gCharms } from '../tools/runtime/repairMh4gCharms.mjs'
import { installMh4gExecution } from '../tools/runtime/mh4gCharmExecution.mjs'
import { installMh4gWitnessData, readStoredMh4gWitnessData, validateMh4gWitnessData, MH4G_RUNTIME_WITNESS_SHA256 } from '../tools/runtime/mh4gCharmWitnessData.mjs'

import { assertPreparedMh4gRuntime, assertNoMh4gReportBytes } from '../tools/runtime/mh4gRuntimePrivacy.mjs'

const fixture = () => {
  const native = syntheticNative(), text = JSON.stringify(native)
  const report = syntheticExecution(native)
  return { native, text, report }
}

describe('producer-verified minimal MH4G runtime witnesses', () => {
  it('retains exactly the old unique outcome set without seeds, floating traces, paths or addresses', () => {
    const { native, text, report } = fixture()
    const { payload, native: clean } = projectMh4gWitnesses(text, report)
    const expected = new Map(report.cases.map(r => {
      const row = [r.classId, r.slots, r.skill1Id, r.skill1Points, r.skill2Id, r.skill2Points]
      return [row.join(':'), row]
    }))
    expect(payload.outcomes).toEqual([...expected.values()])
    expect(Object.keys(payload).sort()).toEqual(['format', 'nativeSha256', 'outcomes'])
    expect(JSON.stringify({ payload, clean })).not.toMatch(/initialState|finalState|fulfillmentBits|slotAddress|"address"|"path"/)
    expect(JSON.stringify(native)).toBe(text)
  })
  it('rejects a changed execution even when the envelope is structurally valid', () => {
    const { text, report } = fixture()
    report.cases[0].finalState[0] ^= 1
    expect(() => projectMh4gWitnesses(text, report)).toThrow(/回放与独立执行结果不符/)
    expect(() => projectMh4gWitnesses(text + '\n', report)).toThrow(/different native input/)
  })
  it('removes the report table and physically scrubs the retired payload after VACUUM', () => {
    const { native, text, report } = fixture(), db = database()
    try {
      repairMh4gCharms(db, native)
      installMh4gExecution(db, text, report, 'synthetic-only')
      expect(db.serialize().includes(Buffer.from('initialState'))).toBe(true)
      expect(() => assertPreparedMh4gRuntime(db)).toThrow(/development execution report/)
      expect(() => assertNoMh4gReportBytes(db.serialize())).toThrow(/development report bytes/)
      const { native: clean, payload } = projectMh4gWitnesses(text, report)
      const trusted = sha256(JSON.stringify(payload))
      db.transaction(() => {
        repairMh4gCharms(db, clean)
        installMh4gWitnessData(db, clean, payload, 'synthetic-only', trusted)
      })()
      db.exec('VACUUM')
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='catalog_mh4g_charm_execution'").get()).toBeUndefined()
      expect(db.prepare("SELECT domain FROM catalog_build_metadata WHERE domain='mh4g-charm-execution'").get()).toBeUndefined()
      expect(db.serialize().includes(Buffer.from('initialState'))).toBe(false)
      expect(readStoredMh4gWitnessData(db, clean, trusted)).toEqual(payload)
      expect(assertPreparedMh4gRuntime(db, trusted).outcomes).toBe(payload.outcomes.length)
      expect(() => assertNoMh4gReportBytes(db.serialize())).not.toThrow()
      const extra = structuredClone(clean); extra.source.path = 'private-host-path'
      db.prepare('UPDATE catalog_mh4g_charm_native SET payload_json=?,payload_sha256=?').run(JSON.stringify(extra), sha256(JSON.stringify(extra)))
      expect(() => assertPreparedMh4gRuntime(db, trusted)).toThrow(/non-runtime fields/)
      db.prepare('UPDATE catalog_mh4g_charm_native SET payload_json=?,payload_sha256=?').run(JSON.stringify(clean), sha256(JSON.stringify(clean)))
      const changed = structuredClone(payload)
      changed.outcomes[0][1] = (changed.outcomes[0][1] + 1) % 4
      db.prepare('UPDATE catalog_mh4g_charm_witnesses SET payload_json=?,payload_sha256=?').run(JSON.stringify(changed), sha256(JSON.stringify(changed)))
      expect(() => readStoredMh4gWitnessData(db, clean, trusted)).toThrow()
      expect(() => validateMh4gWitnessData({ ...payload, cases: [] }, clean, trusted)).toThrow(/unexpected fields/)
      expect(() => validateMh4gWitnessData(payload, { ...clean, algorithm: 'changed' }, trusted)).toThrow(/snapshot changed/)
    } finally { db.close() }
  })
  const executionFile = process.env.MH4G_CHARM_EXECUTION_FILE
  it.skipIf(!executionFile)('projects the real independent bank to the pinned 5264-outcome runtime set', () => {
    const nativeFile = process.env.MH4G_CHARM_NATIVE_FILE || path.join(path.dirname(executionFile), 'native-v1.json')
    const projected = projectMh4gWitnesses(fs.readFileSync(nativeFile, 'utf8'), JSON.parse(fs.readFileSync(executionFile, 'utf8')))
    expect(projected.payload.outcomes).toHaveLength(5264)
    expect(sha256(JSON.stringify(projected.payload))).toBe(MH4G_RUNTIME_WITNESS_SHA256)
    expect(validateMh4gWitnessData(projected.payload, projected.native)).toEqual(projected.payload)
  })
})
