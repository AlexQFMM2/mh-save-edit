import { describe, expect, it } from 'vitest'
import { database, syntheticNative } from './fixtures/mh4gCharm.mjs'
import { sha256 } from '../tools/runtime/mh4gCharmNative.mjs'
import { repairMh4gCharms } from '../tools/runtime/repairMh4gCharms.mjs'
import { installMh4gExecution, validateMh4gExecution } from '../tools/runtime/mh4gCharmExecution.mjs'
import { replayMh4gAppraisal } from '../api/loadout/mh4gCharmReplay'
import { readMh4gCharmEvidence } from '../api/loadout/mh4gCharmRepository'
import { applyCharmValidation, validateCharm } from '../api/loadout/charm'
import { searchCharms } from '../api/loadout/searchCharms'
import { calculateLoadout } from '../api/loadout/calculator'
import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout } from '../api/loadout/types'

import { syntheticExecution as envelope } from './fixtures/mh4gExecution.mjs'
import { projectMh4gWitnesses } from '../tools/runtime/projectMh4gWitnesses'
import { installMh4gWitnessData } from '../tools/runtime/mh4gCharmWitnessData.mjs'
import { createMh4gWitnessReader } from '../api/loadout/mh4gCharmWitnessRepository'
function snapshot(db, expectedHash) {
  const ranges = db.prepare('SELECT * FROM catalog_skill_talisman_ranges').all().map(row => ({ rangeKey: row.range_key, classId: row.talisman_id, position: row.position, skillId: row.skill_id, minPoints: row.min_points, maxPoints: row.max_points, slotCount: row.slot_count, maxSlots: row.max_slots, status: row.range_status, source: row.source }))
  const evidence = readMh4gCharmEvidence(db, ranges)
  if (expectedHash && evidence.mh4gCharmRules) Object.assign(evidence, { mh4gCharmWitnessIssue: undefined }, createMh4gWitnessReader(expectedHash)(db, evidence.mh4gCharmRules))
  return { gameId: 'mh4g', dataVersion: 'synthetic', weapons: [], armors: [], decorations: [], relicLookups: [],
    skills: Array.from({ length: 80 }, (_, i) => ({ skillId: i + 1, nameCn: `s${i + 1}`, activations: [] })),
    charmClasses: Array.from({ length: 14 }, (_, i) => ({ classId: i + 1, nameCn: `c${i + 1}`, nameEn: '', maxSlots: 3 })),
    charmRanges: ranges, ...evidence,
  }
}
function charm(row) {
  return { kind: 'charm', gameId: 'mh4g', classId: row[0], classNameCn: `c${row[0]}`, slots: row[1], skill1: row[2] ? { skillId: row[2], points: row[3], nameCn: 'A' } : null, skill2: row[4] ? { skillId: row[4], points: row[5], nameCn: 'B' } : null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked' }
}
const control = { tick: async () => {} }

describe('MH4G exact generation witness admission', () => {
  it('uses the same bounded witnesses for manual checks, B-target candidates and totals', async () => {
    const db = database()
    try {
      const input = syntheticNative()
      repairMh4gCharms(db, input)
      const report = envelope(input)
      const projected = projectMh4gWitnesses(JSON.stringify(input), report)
      const trusted = sha256(JSON.stringify(projected.payload))
      repairMh4gCharms(db, projected.native)
      const first = installMh4gWitnessData(db, projected.native, projected.payload, 'synthetic-builder', trusted)
      expect(installMh4gWitnessData(db, projected.native, projected.payload, 'synthetic-builder', trusted)).toEqual(first)
      const data = snapshot(db, trusted)
      expect(data.mh4gCharmWitnessIssue).toBeUndefined()
      expect(data.mh4gCharmWitnesses.length).toBeGreaterThan(0)
      const row = data.mh4gCharmWitnesses.find(r => r[4] > 0 && r[4] !== r[2] && r[5] > 0)
      expect(row).toBeTruthy()
      const manual = applyCharmValidation(data, charm(row))
      expect(manual.legality).toBe('confirmed')
      expect(manual.issues[0].message).toContain('初态可达性')
      expect(manual.issues[0].source).toContain(`outcome=${row.join(',')}`)
      expect(row).toHaveLength(6)
      expect(manual.issues[0].source).not.toContain('state=')
      const generated = await searchCharms(data, new Set([row[4]]), control)
      expect(generated.candidates.some(c => c.skill2?.skillId === row[4] && c.skill1)).toBe(true)
      expect(generated.warnings.join('')).toContain('未穷举')
      for (const value of generated.candidates) {
        expect(value.skill1).not.toBeNull()
        expect(validateCharm(data, value).legality).toBe('confirmed')
      }
      const loadout = createEmptyLogicalLoadout('mh4g', data.dataVersion)
      loadout.charm = manual
      loadout.weapon = { kind: 'weapon', gameId: 'mh4g', nameCn: '合成武器', typeId: 1, slots: 0, defense: 0, decorations: [], lock: 'unlocked' }
      for (const part of ARMOR_LOADOUT_SLOTS) loadout.armor[part] = { kind: 'armor', gameId: 'mh4g', part, nameCn: '合成防具', gender: 'both', combat: 'both', slots: 0, baseDefense: 1, maxDefense: 1, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, skills: [], decorations: [], lock: 'unlocked' }
      expect(calculateLoadout(data, loadout).legality).toBe('confirmed')
      expect(calculateLoadout({ ...data, mh4gCharmWitnesses: undefined }, loadout).legality).toBe('unknown')
      const modified = { ...manual, slots: 1 }
      const before = structuredClone(modified)
      expect(validateCharm(data, modified).legality).toBe('invalid')
      expect(modified).toEqual(before)
    } finally { db.close() }
  })
  it('keeps old assets without witnesses unknown and preserves manual values', async () => {
    const db = database()
    try {
      const input = syntheticNative(); repairMh4gCharms(db, input)
      const data = snapshot(db)
      const result = replayMh4gAppraisal(input.groups[0], [1, 2])
      const value = charm([result.classId, result.slots, result.skill1Id, result.skill1Points, result.skill2Id, result.skill2Points])
      const before = structuredClone(value)
      expect(validateCharm(data, value).legality).toBe('unknown')
      expect(value).toEqual(before)
      expect((await searchCharms(data, new Set([1]), control)).candidates).toEqual([])
      expect(data.mh4gCharmWitnessIssue).toContain('未加载')
    } finally { db.close() }
  })
  it('rejects partial grids, modified modes and wrong input bindings without overwriting evidence', () => {
    const db = database()
    try {
      const input = syntheticNative(); repairMh4gCharms(db, input)
      const report = envelope(input)
      installMh4gExecution(db, JSON.stringify(input), report, 'test')
      const before = db.prepare('SELECT * FROM catalog_mh4g_charm_execution').get()
      expect(() => installMh4gExecution(db, JSON.stringify(input) + '\n', report, 'test')).toThrow('different native file')
      const short = { ...report, cases: report.cases.slice(0, 12) }
      expect(() => validateMh4gExecution(short)).toThrow('6144')
      expect(() => validateMh4gExecution({ ...report, fpscr: 0 })).toThrow('mode')
      expect(() => validateMh4gExecution({ ...report, limitations: [] })).toThrow('limitations')
      expect(db.prepare('SELECT * FROM catalog_mh4g_charm_execution').get()).toEqual(before)
    } finally { db.close() }
  })
  it('downgrades an unreviewed set even when its database checksum was recomputed', async () => {
    const db = database()
    try {
      const input = syntheticNative()
      const projected = projectMh4gWitnesses(JSON.stringify(input), envelope(input))
      const trusted = sha256(JSON.stringify(projected.payload))
      repairMh4gCharms(db, projected.native)
      installMh4gWitnessData(db, projected.native, projected.payload, 'test', trusted)
      projected.payload.outcomes.pop()
      const save = () => db.prepare('UPDATE catalog_mh4g_charm_witnesses SET payload_json=?,payload_sha256=?').run(JSON.stringify(projected.payload), sha256(JSON.stringify(projected.payload)))
      save()
      const data = snapshot(db, trusted)
      expect(data.mh4gCharmRules).toBeTruthy()
      expect(data.mh4gCharmWitnesses).toBeUndefined()
      expect(data.mh4gCharmWitnessIssue).toContain('unreviewed outcome set')
      expect((await searchCharms(data, new Set([1]), control)).candidates).toEqual([])
      projected.payload.nativeSha256 = 'stale'; save()
      expect(snapshot(db, trusted).mh4gCharmWitnessIssue).toContain('snapshot changed')
    } finally { db.close() }
  })
})
