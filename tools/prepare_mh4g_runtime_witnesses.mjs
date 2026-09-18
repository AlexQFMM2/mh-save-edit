import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import Database from 'better-sqlite3'
import { build } from 'vite'
import { assertPreparedMh4gRuntime, assertNoMh4gReportBytes } from './runtime/mh4gRuntimePrivacy.mjs'
import { repairMh4gCharms } from './runtime/repairMh4gCharms.mjs'
import { sha256 } from './runtime/mh4gCharmNative.mjs'
import { validateMh4gWitnessData, installMh4gWitnessData, readStoredMh4gWitnessData } from './runtime/mh4gCharmWitnessData.mjs'

const { values } = parseArgs({ options: Object.fromEntries(['database', 'input', 'execution', 'backup'].map(name => [name, { type: 'string' }])), strict: true, allowPositionals: false })
for (const name of ['database', 'input', 'execution', 'backup']) if (!values[name]?.trim()) throw new Error(`Pass --${name}; an explicit new private backup is required`)
const database = path.resolve(values.database), backup = path.resolve(values.backup)
if (fs.existsSync(backup)) throw new Error('Refusing to overwrite a backup')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mh4g-producer-code-'))
let db
try {
  // Use the project's existing Vite compiler, not a new loader/dependency or an
  // application bundle. This temporary directory contains our code only.
  await build({ configFile: false, logLevel: 'error', build: { ssr: fileURLToPath(new URL('./runtime/projectMh4gWitnesses.ts', import.meta.url)), outDir: temporary, emptyOutDir: true, rollupOptions: { output: { format: 'es', entryFileNames: 'project.mjs' } } } })
  const compiled = path.join(temporary, 'project.mjs')
  const { projectMh4gWitnesses } = await import(pathToFileURL(compiled).href)
  const projection = projectMh4gWitnesses(fs.readFileSync(path.resolve(values.input), 'utf8'), JSON.parse(fs.readFileSync(path.resolve(values.execution), 'utf8')))
  validateMh4gWitnessData(projection.payload, projection.native)
  db = new Database(database, { fileMustExist: true })
  fs.mkdirSync(path.dirname(backup), { recursive: true })
  fs.closeSync(fs.openSync(backup, 'wx', 0o600))
  await db.backup(backup)
  const check = new Database(backup, { readonly: true, fileMustExist: true })
  try { if (check.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Backup integrity failure') }
  finally { check.close() }
  db.pragma('foreign_keys=ON')
  db.pragma('secure_delete=ON')
  const builderHash = sha256([fs.readFileSync(import.meta.filename, 'utf8'), fs.readFileSync(compiled, 'utf8'), fs.readFileSync(new URL('./runtime/mh4gCharmWitnessData.mjs', import.meta.url), 'utf8'), fs.readFileSync(new URL('./runtime/repairMh4gCharms.mjs', import.meta.url), 'utf8')].join('\n'))
  const report = db.transaction(() => {
    const ranges = repairMh4gCharms(db, projection.native)
    const witnesses = installMh4gWitnessData(db, projection.native, projection.payload, builderHash)
    if (db.pragma('foreign_key_check').length) throw new Error('Foreign key failure')
    return { ranges, witnesses }
  })()
  // DROP alone leaves retired report bytes in freelist pages.
  db.exec('VACUUM')
  readStoredMh4gWitnessData(db, projection.native)
  assertPreparedMh4gRuntime(db)
  if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Prepared database integrity failure')
  db.close(); db = undefined
  const bytes = fs.readFileSync(database)
  assertNoMh4gReportBytes(bytes)
  console.log(JSON.stringify({ database, backup, ...report, retiredReportScrubbed: true }, null, 2))
} finally {
  db?.close()
  fs.rmSync(temporary, { recursive: true, force: true })
}
