#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { repairMh4gCharms } from './runtime/repairMh4gCharms.mjs'
import { installMh4gExecution } from './runtime/mh4gCharmExecution.mjs'
import { sha256 } from './runtime/mh4gCharmNative.mjs'

const args = process.argv.slice(2)
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
const file = option('--database')
const input = option('--input')
const executionFile = option('--execution')
if (!file || executionFile && !input) throw new Error('Usage: node tools/prepare_mh4g_charm_native.mjs --database <existing-private.sqlite> [--input <private-native.json> [--execution <private-execution.json>]]')
const databasePath = path.resolve(file)
const nativeText = input ? fs.readFileSync(path.resolve(input), 'utf8') : undefined
const payload = nativeText ? JSON.parse(nativeText) : undefined
const execution = executionFile ? JSON.parse(fs.readFileSync(path.resolve(executionFile), 'utf8')) : undefined
const db = new Database(databasePath, { fileMustExist: true })
try {
  db.pragma('foreign_keys=ON')
  const result = db.transaction(() => {
    const prepared = repairMh4gCharms(db, payload)
    if (!execution) return prepared
    const builderHash = sha256(fs.readFileSync(import.meta.filename).toString() + fs.readFileSync(new URL('./runtime/mh4gCharmExecution.mjs', import.meta.url)).toString())
    return { ...prepared, execution: installMh4gExecution(db, nativeText, execution, builderHash) }
  })()
  console.log(JSON.stringify(result, null, 2))
} finally { db.close() }
