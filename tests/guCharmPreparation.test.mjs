import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { GU_SLOT_FILES, prepareGuCharmEvidence, assertPreparedGuCharmEvidence } from '../tools/runtime/prepareGuCharmEvidence.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-gu-slots-'))
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE cn__talismans(id INTEGER PRIMARY KEY, rarity INTEGER, max_slots INTEGER);
    CREATE TABLE cn__talisman_slot_thresholds(id INTEGER PRIMARY KEY, rarity_marker INTEGER, fulfillment INTEGER, slot1_threshold INTEGER, slot2_threshold INTEGER, slot3_threshold INTEGER, source TEXT);
    CREATE TABLE catalog_build_metadata(domain TEXT, game_id TEXT, source_sha256 TEXT, builder_sha256 TEXT, PRIMARY KEY(domain,game_id));
    INSERT INTO catalog_build_metadata VALUES ('unrelated','mhgu','keep-source','keep-builder');`)
  for (const version of ['mhgu-table', 'mhxx-table']) fs.mkdirSync(path.join(root, version))
  GU_SLOT_FILES.forEach(([file, rarity], i) => {
    db.prepare('INSERT INTO cn__talismans VALUES (?,?,3)').run(i + 1, rarity)
    const bytes = Buffer.alloc(92)
    bytes.writeUInt32LE(21, 4)
    for (let fulfillment = 0; fulfillment <= 20; fulfillment++) bytes.set([25, 25, 25, 25], 8 + fulfillment * 4)
    for (const version of ['mhgu-table', 'mhxx-table']) fs.writeFileSync(path.join(root, version, file), bytes)
    for (let fulfillment = 1; fulfillment <= 20; fulfillment++) db.prepare('INSERT INTO cn__talisman_slot_thresholds VALUES (?,?,?,25,50,75,?)').run(rarity * 100 + fulfillment, rarity, fulfillment, 'synthetic-reference')
  })
  const rows = () => ({ thresholds: db.prepare('SELECT * FROM cn__talisman_slot_thresholds ORDER BY id').all(), metadata: db.prepare('SELECT * FROM catalog_build_metadata ORDER BY domain,game_id').all() })
  const change = (file, mutate, versions = ['mhgu-table', 'mhxx-table']) => {
    for (const version of versions) { const name = path.join(root, version, file); const bytes = fs.readFileSync(name); mutate(bytes); fs.writeFileSync(name, bytes) }
  }
  const close = () => { db.close(); fs.rmSync(root, { recursive: true, force: true }) }
  return { root, db, rows, change, close }
}

describe('GU private native evidence preparation', () => {
  it('upgrades old rows atomically, preserves unrelated metadata, and then performs a byte-identical no-op', () => {
    const f = fixture()
    try {
      expect(() => assertPreparedGuCharmEvidence(f.db)).toThrow(/zero-fulfillment/)
      const first = prepareGuCharmEvidence(f.db, f.root)
      expect(first).toMatchObject({ changed: true, classes: 4, rows: 84, probabilityDifferences: [] })
      expect(f.rows().metadata.find(row => row.domain === 'unrelated').source_sha256).toBe('keep-source')
      const bytes = f.db.serialize()
      const second = prepareGuCharmEvidence(f.db, f.root)
      expect(second.changed).toBe(false)
      expect(second.sourceSha256).toBe(first.sourceSha256)
      expect(second.builderSha256).toBe(first.builderSha256)
      expect(f.db.serialize()).toEqual(bytes)
      expect(assertPreparedGuCharmEvidence(f.db).sourceSha256).toBe(first.sourceSha256)
    } finally { f.close() }
  })
  it('retains reference probability differences only when all four slot availabilities agree', () => {
    const f = fixture()
    try {
      f.change(GU_SLOT_FILES[0][0], bytes => bytes.set([26, 24, 25, 25], 12))
      const report = prepareGuCharmEvidence(f.db, f.root)
      expect(report.probabilityDifferences).toHaveLength(1)
      expect(f.db.prepare('SELECT slot1_threshold FROM cn__talisman_slot_thresholds WHERE rarity_marker=97 AND fulfillment=1').get().slot1_threshold).toBe(25)
    } finally { f.close() }
  })
  it.each(['zero-slot', 'other-slot', 'version', 'count', 'empty-row', 'missing-file', 'coverage'])('rejects %s defects before writing any database rows', defect => {
    const f = fixture()
    try {
      if (defect === 'zero-slot') f.change(GU_SLOT_FILES[0][0], bytes => bytes.set([0, 50, 25, 25], 12))
      if (defect === 'other-slot') f.change(GU_SLOT_FILES[0][0], bytes => bytes.set([25, 0, 50, 25], 12))
      if (defect === 'version') f.change(GU_SLOT_FILES[0][0], bytes => bytes[12]++, ['mhxx-table'])
      if (defect === 'count') f.change(GU_SLOT_FILES[0][0], bytes => bytes.writeUInt32LE(20, 4))
      if (defect === 'empty-row') f.change(GU_SLOT_FILES[0][0], bytes => bytes.set([0, 0, 0, 0], 8))
      if (defect === 'missing-file') fs.unlinkSync(path.join(f.root, 'mhxx-table', GU_SLOT_FILES[3][0]))
      if (defect === 'coverage') f.db.prepare('DELETE FROM cn__talisman_slot_thresholds WHERE rarity_marker=100 AND fulfillment=20').run()
      const before = f.rows()
      const expected = { 'zero-slot': /availability/, 'other-slot': /availability/, version: /differs/, count: /size\/count/, 'empty-row': /empty-charm/, 'missing-file': /ENOENT/, coverage: /Incomplete/ }
      expect(() => prepareGuCharmEvidence(f.db, f.root)).toThrow(expected[defect])
      expect(f.rows()).toEqual(before)
    } finally { f.close() }
  })
  it('rolls back zero rows if evidence installation fails inside the transaction', () => {
    const f = fixture()
    try {
      f.db.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON catalog_build_metadata WHEN NEW.domain='charm-slot-native-audit' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END")
      const before = f.rows()
      expect(() => prepareGuCharmEvidence(f.db, f.root)).toThrow(/synthetic audit failure/)
      expect(f.rows()).toEqual(before)
    } finally { f.close() }
  })
  it('does not turn missing or stale producer evidence into a packaging success', () => {
    const f = fixture()
    try {
      prepareGuCharmEvidence(f.db, f.root)
      f.db.prepare('UPDATE cn__talisman_slot_thresholds SET slot1_threshold=26 WHERE rarity_marker=97 AND fulfillment=1').run()
      expect(() => assertPreparedGuCharmEvidence(f.db)).toThrow(/stale/)
      prepareGuCharmEvidence(f.db, f.root)
      f.db.prepare("DELETE FROM catalog_build_metadata WHERE domain='charm-slot-native-audit'").run()
      const before = f.rows()
      expect(() => assertPreparedGuCharmEvidence(f.db)).toThrow(/missing/)
      expect(f.rows()).toEqual(before)
    } finally { f.close() }
  })
})
