import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import { compareNativeSlotAvailability, hashCharmSlotRows, readCharmSlotEvidenceRows } from './runtime/charmSlotEvidence.mjs'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const sourceIndex = args.indexOf('--romfs-root')
if (sourceIndex < 0 || !args[sourceIndex + 1]) throw new Error('Pass --romfs-root pointing to the fixed private directory containing mhgu-table and mhxx-table')
const source = path.resolve(args[sourceIndex + 1])
const db = new Database(path.join(root, 'data/mhgu.sqlite'), { fileMustExist: true })
try {
  const hashes = []
  const emptyRows = []
  let differences = 0
  // Explicit correspondence from the pinned generation reference; cross-check every row, not filename order alone.
  for (const [file, rarity] of [['amuletSlotData00.amslt', 97], ['amuletSlotData01.amslt', 98], ['amuletSlotData02.amslt', 99], ['amuletSlotData03.amslt', 100]]) {
    const gu = fs.readFileSync(path.join(source, 'mhgu-table', file))
    const xx = fs.readFileSync(path.join(source, 'mhxx-table', file))
    if (!gu.equals(xx)) throw new Error(`GU/XX native slot table differs: ${file}`)
    const hash = createHash('sha256').update(gu).digest('hex')
    hashes.push([file, hash])
    const rows = db.prepare('SELECT fulfillment,slot1_threshold,slot2_threshold,slot3_threshold FROM cn__talisman_slot_thresholds WHERE rarity_marker=? AND fulfillment>0 ORDER BY fulfillment').all(rarity)
    const mismatch = compareNativeSlotAvailability(gu, rows)
    differences += mismatch.length
    console.log(`${file}: 20 slot-availability rows verified; ${mismatch.length} cumulative probability differences (not used as drop rates)`)
    const weights = [...gu.subarray(8, 12)]
    if (weights.reduce((sum, value) => sum + value, 0) !== 100) throw new Error('Invalid empty-charm weights')
    emptyRows.push({ rarity, thresholds: [weights[0], weights[0] + weights[1], weights[0] + weights[1] + weights[2]], source: `native-gu+xx:${file}:sha256:${hash}` })
  }
  db.transaction(() => {
    const clear = db.prepare('DELETE FROM cn__talisman_slot_thresholds WHERE fulfillment=0')
    clear.run()
    const insert = db.prepare('INSERT INTO cn__talisman_slot_thresholds(id,rarity_marker,fulfillment,slot1_threshold,slot2_threshold,slot3_threshold,source) VALUES (?,?,0,?,?,?,?)')
    for (const row of emptyRows) insert.run(1000 + row.rarity, row.rarity, ...row.thresholds, row.source)
    db.prepare('INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES (?,?,?,?)').run('charm-slot-native-audit', 'mhgu', hashCharmSlotRows(readCharmSlotEvidenceRows(db)), createHash('sha256').update(JSON.stringify(['slot-availability-fulfillment-reference-v1', hashes])).digest('hex'))
  })()
  console.log(`Verified slot availability against both native versions; ${differences} probability differences retained as reference-only. Fulfillment calculation follows the separately tested generation reference, not an inferred native executable formula.`)
} finally { db.close() }
