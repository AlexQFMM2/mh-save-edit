#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { collectItemJapaneseEvidence } from './mhp2g/itemJapaneseEvidence.mjs'

const [pilotPath, catalogPath, wikiPath, reviewPath, outputPath] = process.argv.slice(2).map(value => path.resolve(value))
if (!outputPath) throw new Error('Usage: node tools/prepare_mhp2g_item_japanese.mjs <native-pilot.sqlite> <frozen-catalog.sqlite> <wiki-readable.json> <review.json> <new-evidence.json>')
if (fs.existsSync(outputPath)) throw new Error('Refusing to overwrite Japanese evidence')
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const inputs = [pilotPath, catalogPath, wikiPath, reviewPath].map(file => ({ path: file, sha256: hash(file) }))
const wiki = JSON.parse(fs.readFileSync(wikiPath, 'utf8')), reviewed = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
const wikiRoot = path.dirname(wikiPath), capture = path.join(wikiRoot, 'japanese-item-evidence-v1/48')
for (const [relative, sha256] of Object.entries(wiki.inputs)) {
  const file = path.join(wikiRoot, relative)
  if (hash(file) !== sha256) throw new Error(`Wiki input changed: ${relative}`)
  inputs.push({ path: file, sha256 })
}
for (const [name, expected] of Object.entries(wiki.source.files)) {
  const file = path.join(capture, name)
  if (hash(file) !== expected.sha256 || fs.statSync(file).size !== expected.bytes) throw new Error(`Wiki capture changed: ${name}`)
  inputs.push({ path: file, sha256: expected.sha256 })
}
const tables = JSON.parse(fs.readFileSync(path.join(capture, 'structure.json'), 'utf8')).tables
for (const row of wiki.items) {
  const [page, table] = row.key.split(':').map(Number)
  if (page !== 48 || row.fields[0].text !== row.name_ja) throw new Error(`Wiki row identity mismatch: ${row.key}`)
  for (const field of row.fields) {
    const [r, c] = field.origin
    if (tables[table]?.rows[r]?.cells[c]?.text !== field.text) throw new Error(`Wiki field differs from captured table: ${row.key}`)
  }
}
const native = new Database(pilotPath, { readonly: true }), catalog = new Database(catalogPath, { readonly: true })
let evidence
try {
  const rows = catalog.prepare('SELECT * FROM catalog_items ORDER BY item_id').all()
  for (const row of rows) {
    const source = native.prepare('SELECT * FROM native_item_catalog WHERE item_id=?').get(row.item_id)
    if (!source || source.name !== row.name_cn || source.description.replaceAll('\\n', '\n') !== row.description || source.stack_limit !== row.max_stack || source.buy_price !== row.buy_price || source.sell_price !== row.sell_price) throw new Error(`Catalog differs from native evidence: ${row.item_id}`)
  }
  const rewards = reviewed.some(review => review.monster) ? native.prepare(`SELECT m.link_id,m.monster_id,n.name,m.rank_slot,m.kind,m.pool_key,i.ordinal,i.item_id,i.chance,i.amount
    FROM monster_rewards m JOIN monster_names n ON n.native_monster_id=m.monster_id JOIN reward_items i USING(pool_key)
    ORDER BY m.link_id,i.ordinal`).all() : []
  evidence = collectItemJapaneseEvidence(rows, wiki.items, reviewed, rewards)
  for (const entry of evidence.entries) entry.nativeRecordSha256 = native.prepare('SELECT row_sha256 FROM native_item_catalog WHERE item_id=?').get(entry.itemId).row_sha256
} finally { native.close(); catalog.close() }
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify({ ...evidence, inputs, wikiSource: wiki.source.retrieved_url, prepared: new Date().toISOString() }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ entries: evidence.entries.length, corrections: evidence.entries.filter(entry => entry.previousJapanese).length, output: outputPath }))
