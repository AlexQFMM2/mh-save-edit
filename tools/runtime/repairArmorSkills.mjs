import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { migrateArmorSkillIds, auditCatalogSkillReferences } from './armorSkillMigration.mjs'

export function repairRuntimeArmorSkills(dataRoot) {
  for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
    const file = path.join(dataRoot, `${gameId}.sqlite`)
    if (!fs.existsSync(file)) continue
    const db = new Database(file)
    try {
      const report = migrateArmorSkillIds(db, gameId)
      auditCatalogSkillReferences(db, gameId)
      console.log(`${gameId} armor skill crosswalk: ${report.migrated ? `repaired ${report.corrected} IDs` : 'verified'}, ${report.rows} relations`)
    } finally { db.close() }
  }
}
