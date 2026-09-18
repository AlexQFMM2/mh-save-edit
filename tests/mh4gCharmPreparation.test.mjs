import { describe, expect, it } from 'vitest'
import { mh4gTalismanRows, readStoredMh4gNative, validateMh4gNativeInput } from '../tools/runtime/mh4gCharmNative.mjs'
import { repairMh4gCharms } from '../tools/runtime/repairMh4gCharms.mjs'
import { readMh4gCharmEvidence } from '../api/loadout/mh4gCharmRepository'

import { database, syntheticNative } from './fixtures/mh4gCharm.mjs'

describe('MH4G native preparation and old-asset crosswalk', () => {
  it('uses distinct A/B mappings and does not swap the two middle A pools', () => {
    const db = database()
    try {
      const rows = mh4gTalismanRows(db, db.prepare('SELECT skill_id FROM catalog_skills').all())
      const ids = (classId, position) => rows.filter(r => r.talismanId === classId && r.position === position).map(r => r.skillId)
      expect(ids(1, 'B')).toEqual([])
      expect(ids(3, 'B')).toEqual([11])
      expect(ids(5, 'B')).toEqual([12])
      expect(ids(8, 'A')).toEqual([4])
      expect(ids(8, 'B')).toEqual([13])
      expect(ids(10, 'A')).toEqual([5])
      expect(ids(10, 'B')).toEqual([14])
      expect(ids(13, 'B')).toEqual([15])
      expect(ids(14, 'B')).toEqual([15])
    } finally { db.close() }
  })
  it('repairs older assets idempotently without claiming native evidence', () => {
    const db = database()
    try {
      const first = repairMh4gCharms(db)
      const rows = db.prepare('SELECT * FROM catalog_skill_talisman_ranges ORDER BY range_key').all()
      expect(first.native).toBe(false)
      expect(readStoredMh4gNative(db)).toBeNull()
      expect(repairMh4gCharms(db)).toEqual(first)
      expect(db.prepare('SELECT * FROM catalog_skill_talisman_ranges ORDER BY range_key').all()).toEqual(rows)
    } finally { db.close() }
  })
  it('stores validated private native input and preserves limitations', () => {
    const db = database()
    try {
      const input = syntheticNative()
      const prepared = repairMh4gCharms(db, input)
      expect(prepared.native).toBe(true)
      expect(readStoredMh4gNative(db)).toEqual(input)
      expect(repairMh4gCharms(db).fingerprint).toBe(prepared.fingerprint)
      db.prepare("UPDATE catalog_mh4g_charm_native SET payload_json='{}'").run()
      expect(() => readStoredMh4gNative(db)).toThrow('digest mismatch')
    } finally { db.close() }
  })
  it('rejects unknown references and inputs before replacing existing ranges', () => {
    const db = database()
    try {
      repairMh4gCharms(db)
      const before = db.prepare('SELECT * FROM catalog_skill_talisman_ranges').all()
      const input = syntheticNative()
      input.groups[0].slotWeights[0] = [99, 0, 0, 0]
      expect(() => repairMh4gCharms(db, input)).toThrow('slot weights')
      expect(db.prepare('SELECT * FROM catalog_skill_talisman_ranges').all()).toEqual(before)
      db.prepare("UPDATE charm_skill_ranges SET source='unreviewed'").run()
      expect(() => repairMh4gCharms(db)).toThrow('unreviewed reference')
      expect(db.prepare('SELECT * FROM catalog_skill_talisman_ranges').all()).toEqual(before)
    } finally { db.close() }
  })
  it('runtime rejects corrupt or mismatched evidence without losing the range snapshot', () => {
    const db = database()
    try {
      expect(readMh4gCharmEvidence(db, []).mh4gCharmRulesIssue).toContain('未加载')
      repairMh4gCharms(db, syntheticNative())
      const ranges = db.prepare('SELECT * FROM catalog_skill_talisman_ranges').all().map(row => ({ classId: row.talisman_id, position: row.position, skillId: row.skill_id, minPoints: row.min_points, maxPoints: row.max_points, slotCount: row.slot_count }))
      expect(readMh4gCharmEvidence(db, ranges).mh4gCharmRules).toBeTruthy()
      const altered = structuredClone(ranges)
      altered[0].maxPoints += 1
      expect(readMh4gCharmEvidence(db, altered).mh4gCharmRulesIssue).toContain('显示范围与原生技能池不一致')
      expect(readMh4gCharmEvidence(db, altered).mh4gCharmRules).toBeUndefined()
      db.prepare("UPDATE catalog_mh4g_charm_native SET payload_sha256='corrupt'").run()
      expect(readMh4gCharmEvidence(db, ranges).mh4gCharmRulesIssue).toContain('digest mismatch')
      expect(ranges[0].maxPoints).toBe(2)
    } finally { db.close() }
  })
  it('fails closed on unreviewed hashes, duplicate skills, bad digests and removed caveats', () => {
    const badHash = syntheticNative(); badHash.source.codeSha256 = '0'.repeat(64)
    expect(() => validateMh4gNativeInput(badHash)).toThrow('unreviewed executable')
    const duplicate = syntheticNative(); duplicate.groups[0].pools.A.rows[1][0] = 1
    expect(() => validateMh4gNativeInput(duplicate)).toThrow('invalid skill range')
    const digest = syntheticNative(); digest.groups[0].pools.A.sha256 = '0'.repeat(64)
    expect(() => validateMh4gNativeInput(digest)).toThrow('digest mismatch')
    const caveats = syntheticNative(); caveats.evidence.limitations = []
    expect(() => validateMh4gNativeInput(caveats)).toThrow('limitations')
  })
})
