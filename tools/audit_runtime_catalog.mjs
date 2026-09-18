import Database from 'better-sqlite3'
import { auditCatalogSkillReferences } from './runtime/armorSkillMigration.mjs'

for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
  const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
  try { auditCatalogSkillReferences(db, gameId); console.log(`${gameId}: runtime skill references verified`) }
  finally { db.close() }
}
