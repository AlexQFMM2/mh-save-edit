import { readStoredMh4gNative, sha256 } from './mh4gCharmNative.mjs'

export const MH4G_WINDOWS_SHA256 = '7982d6ffc11a3d1c2f51f0943e3aa1096b08e487549e0c29b44afff9057f7f95'
const requireValue = (condition, message) => { if (!condition) throw new Error(`MH4G execution evidence: ${message}`) }
const caseFields = ['groupIndex', 'initialState', 'finalState', 'classId', 'slots', 'skill1Id', 'skill1Points', 'skill2Id', 'skill2Points', 'fulfillmentBits', 'row']

/** Validate the bounded independent-execution contract, never a general seed set. */
export function validateMh4gExecution(input) {
  requireValue(input?.format === 'mh4g-charm-execution-v1' && input.engine === 'unicorn-2.1.4-arm1176' && input.fpscr === 0x03000000, 'unreviewed engine or floating-point mode')
  requireValue(input.windowsSha256 === MH4G_WINDOWS_SHA256, 'unreviewed instruction windows')
  requireValue(typeof input.nativeSha256 === 'string' && /^[0-9a-f]{64}$/.test(input.nativeSha256), 'missing native input identity')
  requireValue(JSON.stringify(input.limitations) === JSON.stringify(['chosen-initial-states-not-game-samples', 'other-acquisition-paths', 'runtime-fpscr-state']), 'limitations must be preserved')
  requireValue(Array.isArray(input.cases) && input.cases.length === 6144, 'complete reviewed 6144-case grid required')
  for (const [index, row] of input.cases.entries()) {
    const seed = index % 1024
    requireValue(row && Object.keys(row).length === caseFields.length && caseFields.every(key => Object.hasOwn(row, key)), 'invalid case fields')
    requireValue(row.groupIndex === Math.floor(index / 1024) && Array.isArray(row.initialState) && row.initialState.length === 2 && row.initialState[0] === seed && row.initialState[1] === ((seed * 977 + 13) & 65535), 'case grid order or initial state mismatch')
    requireValue(Array.isArray(row.finalState) && row.finalState.length === 2 && row.finalState.every(n => Number.isInteger(n) && n >= 0 && n <= 65535), 'invalid final state')
    for (const field of caseFields.filter(key => !['initialState', 'finalState'].includes(key))) requireValue(Number.isInteger(row[field]), 'noninteger execution field')
    requireValue(row.classId >= 1 && row.classId <= 14 && row.slots >= 0 && row.slots <= 3 && row.row >= 0 && row.row <= 20 && row.fulfillmentBits >= 0 && row.fulfillmentBits <= 0xffffffff, 'invalid class/slot/float result')
    requireValue(row.skill1Id > 0 && row.skill1Id <= 255 && row.skill1Points > 0 && row.skill1Points <= 127 && row.skill2Id >= 0 && row.skill2Id <= 255 && row.skill2Points >= -128 && row.skill2Points <= 127 && ((row.skill2Id === 0) === (row.skill2Points === 0)) && row.skill1Id !== row.skill2Id, 'invalid skill result')
  }
  return input
}

export function readStoredMh4gExecution(db, native) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_mh4g_charm_execution'").get()) return null
  const row = db.prepare('SELECT native_payload_sha256,payload_json,payload_sha256 FROM catalog_mh4g_charm_execution WHERE id=1').get()
  if (!row) return null
  requireValue(native && row.native_payload_sha256 === sha256(JSON.stringify(native)), 'native snapshot changed; re-audit witnesses')
  requireValue(row.payload_sha256 === sha256(row.payload_json), 'execution payload digest mismatch')
  return validateMh4gExecution(JSON.parse(row.payload_json))
}

/** Import only a report bound to the exact fixed native input and current DB. */
export function installMh4gExecution(db, nativeFileText, execution, builderSha256) {
  const native = readStoredMh4gNative(db)
  requireValue(Boolean(native), 'prepare native input first')
  requireValue(JSON.stringify(JSON.parse(nativeFileText)) === JSON.stringify(native), 'input file and database native snapshot differ')
  validateMh4gExecution(execution)
  requireValue(sha256(nativeFileText) === execution.nativeSha256, 'execution report used a different native file')
  const payload = JSON.stringify(execution)
  const payloadHash = sha256(payload)
  const nativeHash = sha256(JSON.stringify(native))
  db.transaction(() => {
    db.exec('CREATE TABLE IF NOT EXISTS catalog_mh4g_charm_execution(id INTEGER PRIMARY KEY CHECK(id=1),native_payload_sha256 TEXT NOT NULL,payload_json TEXT NOT NULL,payload_sha256 TEXT NOT NULL)')
    db.prepare('INSERT OR REPLACE INTO catalog_mh4g_charm_execution VALUES(1,?,?,?)').run(nativeHash, payload, payloadHash)
    db.prepare("INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES('mh4g-charm-execution','mh4g',?,?)").run(sha256(nativeHash + payloadHash), builderSha256)
  })()
  return { cases: execution.cases.length, nativeHash, payloadHash, scope: 'reviewed-appraisal-function-controlled-inputs' }
}
