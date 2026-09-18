import fs from 'node:fs'
import { mh4gTalismanRows, readStoredMh4gNative, replaceMh4gTalismanRanges, sha256, validateMh4gNativeInput } from './mh4gCharmNative.mjs'

/** Transactional and idempotent; native data is optional for older private assets. */
export function repairMh4gCharms(db, input) {
  const native = input === undefined ? readStoredMh4gNative(db) : validateMh4gNativeInput(input)
  const skills = db.prepare("SELECT skill_id FROM catalog_skills WHERE game_id='mh4g' AND is_placeholder=0").all()
  const rows = mh4gTalismanRows(db, skills, native)
  const payload = native ? JSON.stringify(native) : null
  const fingerprint = sha256(JSON.stringify({ rows, native: payload ? sha256(payload) : null }))
  const builder = sha256(fs.readFileSync(new URL('./mh4gCharmNative.mjs', import.meta.url)).toString() + fs.readFileSync(new URL('./repairMh4gCharms.mjs', import.meta.url)).toString())
  db.transaction(() => {
    if (native) {
      db.exec('CREATE TABLE IF NOT EXISTS catalog_mh4g_charm_native(id INTEGER PRIMARY KEY CHECK(id=1),payload_json TEXT NOT NULL,payload_sha256 TEXT NOT NULL)')
      db.prepare('INSERT OR REPLACE INTO catalog_mh4g_charm_native(id,payload_json,payload_sha256) VALUES(1,?,?)').run(payload, sha256(payload))
    }
    replaceMh4gTalismanRanges(db, rows)
    db.prepare("INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES('mh4g-charm-source-crosswalk','mh4g',?,?)").run(fingerprint, builder)
  })()
  return { rows: rows.length, native: Boolean(native), evidence: native ? native.evidence : { kind: 'reference' }, fingerprint }
}
