import { sha256 } from './mh4gCharmNative.mjs'

// Reviewed compact projection, not a raw report or list of game data in source.
// Changing this commitment requires a new local independent-execution review.
export const MH4G_RUNTIME_WITNESS_SHA256 = 'd2d68e9cf5955a7760d3e64adf511738b56a8d0118c9d0399a10ae4c9c63abd9'
const requireValue = (ok, message) => { if (!ok) throw new Error(`MH4G runtime witnesses: ${message}`) }

/** expectedHash is a code-owned trust root (synthetic tests inject their own),
 * never read from the database, an API request, or a user configuration. */
export function validateMh4gWitnessData(input, native, expectedHash = MH4G_RUNTIME_WITNESS_SHA256) {
  requireValue(input && Object.keys(input).length === 3 && input.format === 'mh4g-charm-witnesses-v1', 'unexpected fields or format')
  requireValue(input.nativeSha256 === sha256(JSON.stringify(native)), 'native snapshot changed')
  requireValue(Array.isArray(input.outcomes) && input.outcomes.length > 0 && input.outcomes.length <= 6144, 'invalid outcome count')
  const seen = new Set()
  for (const row of input.outcomes) {
    requireValue(Array.isArray(row) && row.length === 6 && row.every(Number.isInteger), 'outcome must contain exactly six integer fields')
    const [cls, slots, a, ap, b, bp] = row
    requireValue(cls >= 1 && cls <= 14 && slots >= 0 && slots <= 3 && a > 0 && a <= 255 && ap > 0 && ap <= 127 && b >= 0 && b <= 255 && bp >= -128 && bp <= 127 && (b === 0) === (bp === 0) && a !== b, 'invalid outcome fields')
    const key = row.join(':')
    requireValue(!seen.has(key), 'duplicate outcome')
    seen.add(key)
  }
  requireValue(sha256(JSON.stringify(input)) === expectedHash, 'unreviewed outcome set; recomputing database checksums is insufficient')
  return input
}

export function readStoredMh4gWitnessData(db, native, expectedHash = MH4G_RUNTIME_WITNESS_SHA256) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_mh4g_charm_witnesses'").get()) return null
  const row = db.prepare('SELECT payload_json,payload_sha256 FROM catalog_mh4g_charm_witnesses WHERE id=1').get()
  requireValue(row && row.payload_sha256 === sha256(row.payload_json), 'missing payload or digest mismatch')
  return validateMh4gWitnessData(JSON.parse(row.payload_json), native, expectedHash)
}

export function installMh4gWitnessData(db, native, input, builderHash, expectedHash = MH4G_RUNTIME_WITNESS_SHA256) {
  validateMh4gWitnessData(input, native, expectedHash)
  const payload = JSON.stringify(input), digest = sha256(payload)
  db.transaction(() => {
    db.exec('CREATE TABLE IF NOT EXISTS catalog_mh4g_charm_witnesses(id INTEGER PRIMARY KEY CHECK(id=1),payload_json TEXT NOT NULL,payload_sha256 TEXT NOT NULL)')
    db.prepare('INSERT OR REPLACE INTO catalog_mh4g_charm_witnesses VALUES(1,?,?)').run(payload, digest)
    db.prepare("INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES('mh4g-charm-witnesses','mh4g',?,?)").run(digest, builderHash)
    db.exec('DROP TABLE IF EXISTS catalog_mh4g_charm_execution')
    db.prepare("DELETE FROM catalog_build_metadata WHERE domain='mh4g-charm-execution' AND game_id='mh4g'").run()
  })()
  return { outcomes: input.outcomes.length, payloadSha256: digest }
}
