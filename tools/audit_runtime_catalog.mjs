import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { auditCatalogSkillReferences } from './runtime/armorSkillMigration.mjs'

for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
  const db = new Database(fileURLToPath(new URL(`../data/${gameId}.sqlite`, import.meta.url)), { readonly: true, fileMustExist: true })
  try { auditCatalogSkillReferences(db, gameId); console.log(`${gameId}: runtime skill references verified`) }
  finally { db.close() }
}
