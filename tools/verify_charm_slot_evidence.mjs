import path from 'node:path'
import { parseArgs } from 'node:util'
import Database from 'better-sqlite3'
import { prepareGuCharmEvidence } from './runtime/prepareGuCharmEvidence.mjs'

const { values } = parseArgs({ options: { 'romfs-root': { type: 'string' }, database: { type: 'string' } }, strict: true, allowPositionals: false })
if (!values['romfs-root']?.trim()) throw new Error('Pass --romfs-root pointing to the fixed private directory containing mhgu-table and mhxx-table')
if (values.database !== undefined && !values.database.trim()) throw new Error('--database must name an existing SQLite file')
const source = path.resolve(values['romfs-root'])
const database = values.database ? path.resolve(values.database) : path.resolve(import.meta.dirname, '../data/mhgu.sqlite')
const db = new Database(database, { fileMustExist: true })
try {
  db.pragma('foreign_keys=ON')
  const report = prepareGuCharmEvidence(db, source)
  console.log(JSON.stringify({ database, ...report }, null, 2))
} finally { db.close() }
