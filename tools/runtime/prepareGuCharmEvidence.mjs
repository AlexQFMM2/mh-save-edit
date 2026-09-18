import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { compareNativeSlotAvailability, hashCharmSlotRows, readCharmSlotEvidenceRows } from './charmSlotEvidence.mjs'

// Explicit generation-reference correspondence, not directory/file enumeration order.
export const GU_SLOT_FILES = [['amuletSlotData00.amslt', 97], ['amuletSlotData01.amslt', 98], ['amuletSlotData02.amslt', 99], ['amuletSlotData03.amslt', 100]]
const digest = value => createHash('sha256').update(value).digest('hex')

function validateLayout(db, requireZero) {
  const classes = db.prepare('SELECT id,rarity,max_slots FROM cn__talismans WHERE id>0 ORDER BY id').all()
  if (!classes.length || classes.some(row => !GU_SLOT_FILES.some(([, rarity]) => rarity === row.rarity) || !Number.isInteger(row.max_slots) || row.max_slots < 0 || row.max_slots > 3)) throw new Error('GU charm classes missing or outside the reviewed slot groups')
  const rows = db.prepare('SELECT rarity_marker,fulfillment,slot1_threshold,slot2_threshold,slot3_threshold FROM cn__talisman_slot_thresholds ORDER BY rarity_marker,fulfillment').all()
  if (rows.some(row => !GU_SLOT_FILES.some(([, rarity]) => rarity === row.rarity_marker) || !Number.isInteger(row.fulfillment) || row.fulfillment < 0 || row.fulfillment > 20)) throw new Error('GU slot thresholds contain an unreviewed group or fulfillment')
  for (const [, rarity] of GU_SLOT_FILES) {
    const values = rows.filter(row => row.rarity_marker === rarity)
    const positive = values.filter(row => row.fulfillment > 0)
    if (positive.length !== 20 || positive.some((row, i) => row.fulfillment !== i + 1)) throw new Error(`Incomplete GU slot thresholds for rarity ${rarity}`)
    if (requireZero && values.filter(row => row.fulfillment === 0).length !== 1) throw new Error(`GU zero-fulfillment row missing or duplicated for rarity ${rarity}; prepare native evidence before packaging`)
    for (const row of values) {
      const thresholds = [row.slot1_threshold, row.slot2_threshold, row.slot3_threshold]
      if (thresholds.some((value, i) => !Number.isInteger(value) || value < 0 || value > 100 || i > 0 && value < thresholds[i - 1])) throw new Error(`Invalid GU cumulative slot thresholds for rarity ${rarity}`)
    }
  }
  return classes
}

/** Packaging guard only. This does not create evidence or independently replay
 * native files; it requires the producer's audit to still match these rows. */
export function assertPreparedGuCharmEvidence(db) {
  const classes = validateLayout(db, true)
  const rows = readCharmSlotEvidenceRows(db)
  if (rows.length !== classes.length * 21) throw new Error('Incomplete GU class/fulfillment slot coverage')
  const metadata = db.prepare("SELECT source_sha256,builder_sha256 FROM catalog_build_metadata WHERE game_id='mhgu' AND domain='charm-slot-native-audit'").get()
  const sourceSha256 = hashCharmSlotRows(rows)
  if (!metadata || metadata.source_sha256 !== sourceSha256 || !/^[0-9a-f]{64}$/.test(metadata.builder_sha256)) throw new Error('GU native slot audit missing or stale; prepare verified private runtime assets before packaging')
  return { classes: classes.length, rows: rows.length, sourceSha256, builderSha256: metadata.builder_sha256 }
}

/** Cross-check the two fixed private native inputs before any write. Install
 * zero rows and the matching audit atomically; preserve reference probabilities. */
export function prepareGuCharmEvidence(db, sourceRoot) {
  validateLayout(db, false)
  const hashes = []
  const emptyRows = []
  const differences = []
  for (const [file, rarity] of GU_SLOT_FILES) {
    const gu = fs.readFileSync(path.join(sourceRoot, 'mhgu-table', file))
    const xx = fs.readFileSync(path.join(sourceRoot, 'mhxx-table', file))
    if (!gu.equals(xx)) throw new Error(`GU/XX native slot table differs: ${file}`)
    const hash = digest(gu)
    hashes.push([file, hash])
    const reference = db.prepare('SELECT fulfillment,slot1_threshold,slot2_threshold,slot3_threshold FROM cn__talisman_slot_thresholds WHERE rarity_marker=? AND fulfillment>0 ORDER BY fulfillment').all(rarity)
    differences.push(...compareNativeSlotAvailability(gu, reference).map(row => ({ file, ...row })))
    const weights = [...gu.subarray(8, 12)]
    if (weights.reduce((sum, value) => sum + value, 0) !== 100) throw new Error(`Invalid empty-charm probability total: ${file}`)
    emptyRows.push({ rarity, thresholds: [weights[0], weights[0] + weights[1], weights[0] + weights[1] + weights[2]], source: `native-gu+xx:${file}:sha256:${hash}` })
  }
  const builderSha256 = digest(JSON.stringify(['slot-availability-fulfillment-reference-v2', hashes, digest(fs.readFileSync(new URL(import.meta.url))), digest(fs.readFileSync(new URL('./charmSlotEvidence.mjs', import.meta.url)))]))
  const details = { hashes, probabilityDifferences: differences, scope: 'Native GU/XX slot availability only; fulfillment formula and source/class correspondence remain generation-reference derived, not ExeFS proof.' }
  const existingZero = db.prepare('SELECT id,rarity_marker,slot1_threshold,slot2_threshold,slot3_threshold,source FROM cn__talisman_slot_thresholds WHERE fulfillment=0 ORDER BY rarity_marker').all()
  const unchangedZero = existingZero.length === emptyRows.length && existingZero.every((row, i) => row.id === 1000 + emptyRows[i].rarity && row.rarity_marker === emptyRows[i].rarity && [row.slot1_threshold, row.slot2_threshold, row.slot3_threshold].every((value, j) => value === emptyRows[i].thresholds[j]) && row.source === emptyRows[i].source)
  const metadata = db.prepare("SELECT source_sha256,builder_sha256 FROM catalog_build_metadata WHERE game_id='mhgu' AND domain='charm-slot-native-audit'").get()
  if (unchangedZero && metadata?.source_sha256 === hashCharmSlotRows(readCharmSlotEvidenceRows(db)) && metadata.builder_sha256 === builderSha256) return { ...assertPreparedGuCharmEvidence(db), ...details, changed: false }
  return db.transaction(() => {
    const clear = db.prepare('DELETE FROM cn__talisman_slot_thresholds WHERE fulfillment=0 AND rarity_marker=?')
    const insert = db.prepare('INSERT INTO cn__talisman_slot_thresholds(id,rarity_marker,fulfillment,slot1_threshold,slot2_threshold,slot3_threshold,source) VALUES (?,?,0,?,?,?,?)')
    for (const row of emptyRows) { clear.run(row.rarity); insert.run(1000 + row.rarity, row.rarity, ...row.thresholds, row.source) }
    db.prepare('INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES (?,?,?,?)').run('charm-slot-native-audit', 'mhgu', hashCharmSlotRows(readCharmSlotEvidenceRows(db)), builderSha256)
    const evidence = assertPreparedGuCharmEvidence(db)
    return { ...evidence, ...details, changed: true }
  })()
}
