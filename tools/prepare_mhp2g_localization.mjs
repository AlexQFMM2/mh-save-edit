#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import { createLocalization, textKey } from './mhp2g/localization.mjs'
import { R9_SHA256, sha256, verifySource } from './mhp2g/sources.mjs'

// Pinned, read-only original-Japanese catalog text extraction (not the old patch).
const JAPANESE_TEXTS_SHA256 = 'f3e13a9cae3d1a4dca7f0fb1921dd009c17236b3dfdea120c7857a74ae56e4f6'
const equipmentTables = { weapon_blademaster: 3, weapon_ranged: 5, armor_head: 7, armor_chest: 9, armor_arms: 11, armor_waist: 13, armor_legs: 15 }
export function prepareLocalization({ source, japanese, guSnapshot, reviews, output }) {
  assert(!fs.existsSync(output), 'Output already exists; refusing to overwrite')
  verifySource(source)
  assert.equal(sha256(japanese), JAPANESE_TEXTS_SHA256, 'Japanese source fingerprint mismatch')
  const native = JSON.parse(fs.readFileSync(japanese, 'utf8'))
  assert.equal(native.boot.sha256, '3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846')
  assert.equal(native.disc.DISC_ID, 'ULJM05500')
  const guManifest = JSON.parse(fs.readFileSync(path.join(guSnapshot, 'manifest.json'), 'utf8'))
  for (const file of ['terminology.sqlite', 'audit.json']) assert.equal(sha256(path.join(guSnapshot, file)), guManifest.outputs[file], `GU snapshot mismatch: ${file}`)
  const audit = JSON.parse(fs.readFileSync(path.join(guSnapshot, 'audit.json'), 'utf8'))
  const db = new Database(source, { readonly: true }), gu = new Database(path.join(guSnapshot, 'terminology.sqlite'), { readonly: true })
  let result
  try {
    const bindings = {}, nativeItems = new Map(native.items.map(row => [row.itemId, row]))
    const decorationIds = new Set(db.prepare("SELECT i.item_id FROM native_item_catalog i JOIN records r ON r.row_sha256=i.row_sha256 AND r.native_table='decoration_items'").all().map(row => row.item_id))
    assert.equal(decorationIds.size, 168, 'Incomplete native decoration identities')
    const items = db.prepare('SELECT item_id,row_sha256,decoration_index FROM native_item_catalog ORDER BY item_id').all()
    assert.equal(items.length, nativeItems.size)
    for (const row of items) {
      assert.equal(row.row_sha256, nativeItems.get(row.item_id)?.rowSha256, `Item record changed ${row.item_id}`)
      bindings[`item:${row.item_id}`] = { kind: 'item', name: textKey(1, row.item_id), description: textKey(2, row.item_id), ...(decorationIds.has(row.item_id) && row.decoration_index > 0 ? { naming: 'native-decoration' } : {}) }
    }
    for (const row of db.prepare('SELECT r.*,d.text_table,d.text_index FROM records r JOIN equipment_descriptions d ON d.equipment_key=r.record_key ORDER BY record_key').all()) {
      const table = equipmentTables[row.native_table]
      assert(table != null, `Unknown equipment table ${row.native_table}`)
      bindings[row.record_key] = { kind: row.native_table.startsWith('weapon') ? 'weapon' : 'armor', name: textKey(table, row.native_index), description: textKey(row.text_table, row.text_index) }
    }
    assert.equal(Object.keys(bindings).length, 1261 + 3600, 'Incomplete equipment descriptions')
    for (const row of db.prepare('SELECT * FROM skill_name_crosswalk ORDER BY skill_id').all()) bindings[`skill_tree:${row.skill_id}`] = { kind: 'skill_tree', name: textKey(row.text_table, row.text_index) }
    for (const row of db.prepare('SELECT * FROM activated_skill_names ORDER BY ordinal').all()) bindings[`skill:${row.ordinal}`] = { kind: 'skill', name: textKey(row.text_table, row.text_index) }
    const official = []
    for (const term of gu.prepare("SELECT * FROM terms WHERE kind IN ('item','weapon','armor','skill_tree','skill') ORDER BY id").all()) {
      const chosen = audit.state.chosen[term.id]?.zhHans, evidence = audit.state.evidence[chosen?.evidenceKey]
      // Nonofficial names stay in the review queue, never become authoritative.
      if (chosen?.sourceClass !== 'gu_official') continue
      assert.equal(evidence?.value, term.zhHans, `Official value mismatch ${term.id}`)
      assert.equal(evidence?.termId, term.id, `Official identity mismatch ${term.id}`)
      official.push({ ...term, chineseSource: chosen.sourceClass })
    }
    const reviewed = reviews ? JSON.parse(fs.readFileSync(reviews, 'utf8')) : { schema: 'mhp2g-localization-review-v1', entries: [] }
    assert.equal(reviewed.schema, 'mhp2g-localization-review-v1', 'Unsupported translation review schema')
    assert(Array.isArray(reviewed.entries), 'Translation review must contain an entries array')
    result = createLocalization({ tables: native.tables, bindings, official, reviews: reviewed.entries })
  } finally { db.close(); gu.close() }
  const files = [source, japanese, path.join(guSnapshot, 'terminology.sqlite'), path.join(guSnapshot, 'audit.json'), ...(reviews ? [reviews] : [])]
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temporary = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-localization-'))
  try {
    fs.writeFileSync(path.join(temporary, 'localization.json'), JSON.stringify(result, null, 2) + '\n')
    const pending = Object.entries(result.units).filter(([, unit]) => unit.status === 'pending').map(([key, unit]) => ({ key, ...unit }))
    fs.writeFileSync(path.join(temporary, 'review-queue.json'), JSON.stringify(pending, null, 2) + '\n')
    const outputs = Object.fromEntries(fs.readdirSync(temporary).map(name => [name, sha256(path.join(temporary, name))]))
    fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify({ schema: result.schema, sourceSha256: R9_SHA256, inputs: files.map(file => ({ path: file, sha256: sha256(file) })), outputs, counts: result.counts }, null, 2) + '\n')
    const lock = `${output}.lock`
    fs.mkdirSync(lock)
    try { assert(!fs.existsSync(output), 'Output already exists'); fs.renameSync(temporary, output) } finally { fs.rmdirSync(lock) }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
  return result.counts
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, japanese, guSnapshot, output, reviews] = process.argv.slice(2).map(value => path.resolve(value))
  if (!output) throw new Error('Usage: prepare_mhp2g_localization.mjs <pilot.sqlite> <japanese-texts.json> <gu-snapshot-dir> <new-output-dir> [review.json]')
  console.log(JSON.stringify(prepareLocalization({ source, japanese, guSnapshot, output, reviews }), null, 2))
}
