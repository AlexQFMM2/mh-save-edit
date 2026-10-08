import Database from 'better-sqlite3'
import fs from 'node:fs'
import { assertPreparedMh4gRuntime, assertNoMh4gReportBytes } from './runtime/mh4gRuntimePrivacy.mjs'
import { fileURLToPath } from 'node:url'
import { auditCatalogSkillReferences } from './runtime/armorSkillMigration.mjs'
import { assertPreparedGuCharmEvidence } from './runtime/prepareGuCharmEvidence.mjs'
import { auditMh4gArmorIdentities } from './runtime/mh4gArmorIdentities.mjs'

for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
  const db = new Database(fileURLToPath(new URL(`../data/${gameId}.sqlite`, import.meta.url)), { readonly: true, fileMustExist: true })
  try {
    auditCatalogSkillReferences(db, gameId)
    if (gameId === 'mh4g') {
      console.log('4G armor save identities verified', auditMh4gArmorIdentities(db))
      console.log('4G compact runtime evidence verified', assertPreparedMh4gRuntime(db))
      assertNoMh4gReportBytes(fs.readFileSync(fileURLToPath(new URL('../data/mh4g.sqlite', import.meta.url))))
    }
    if (gameId === 'mhgu') console.log('GU prepared slot evidence verified', assertPreparedGuCharmEvidence(db))
    console.log(`${gameId}: runtime skill references verified`)
  }
  finally { db.close() }
}
