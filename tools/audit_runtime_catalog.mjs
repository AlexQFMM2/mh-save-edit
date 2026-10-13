import Database from 'better-sqlite3'
import fs from 'node:fs'
import { assertPreparedMh4gRuntime, assertNoMh4gReportBytes } from './runtime/mh4gRuntimePrivacy.mjs'
import { fileURLToPath } from 'node:url'
import { auditCatalogSkillReferences } from './runtime/armorSkillMigration.mjs'
import { assertPreparedGuCharmEvidence } from './runtime/prepareGuCharmEvidence.mjs'
import { auditMh4gArmorIdentities } from './runtime/mh4gArmorIdentities.mjs'
import { catalogIdentityRows, identityFingerprint } from '../api/terminology/catalogIdentity.mjs'

const dictionary = new Database(fileURLToPath(new URL('../data/item-terminology.sqlite', import.meta.url)), { readonly: true, fileMustExist: true })
try {
  if (dictionary.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Terminology database integrity check failed')
  if (dictionary.prepare("SELECT value FROM meta WHERE key='schema'").get()?.value !== 'item-terminology-v1') throw new Error('Unexpected terminology schema')
  for (const gameId of ['mh3g', 'mh4g', 'mhgu', 'mhp2g']) {
    const db = new Database(fileURLToPath(new URL(`../data/${gameId}.sqlite`, import.meta.url)), { readonly: true, fileMustExist: true })
    try {
      if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error(`${gameId}: integrity check failed`)
      const expected = dictionary.prepare('SELECT value FROM meta WHERE key=?').get(`catalog:${gameId}`)?.value
      if (expected !== identityFingerprint(catalogIdentityRows(db, gameId))) throw new Error(`${gameId}: terminology catalog identity mismatch`)
      if (gameId === 'mhp2g') {
        if (db.pragma('foreign_key_check').length) throw new Error('P2G catalog has dangling references')
        const schemas = { catalog: 'items', monster: 'monsters', quest: 'quests', skill: 'skills', decoration: 'decorations', weapon: 'weapons', armor: 'armors' }
        for (const [key, domain] of Object.entries(schemas)) {
          if (db.prepare('SELECT value FROM meta WHERE key=?').get(`${key}_schema`)?.value !== `mhp2g-${domain}-v1`) throw new Error(`P2G ${domain} runtime schema missing`)
        }
      } else auditCatalogSkillReferences(db, gameId)
      if (gameId === 'mh4g') {
        console.log('4G armor save identities verified', auditMh4gArmorIdentities(db))
        console.log('4G compact runtime evidence verified', assertPreparedMh4gRuntime(db))
        assertNoMh4gReportBytes(fs.readFileSync(fileURLToPath(new URL('../data/mh4g.sqlite', import.meta.url))))
      }
      if (gameId === 'mhgu') console.log('GU prepared slot evidence verified', assertPreparedGuCharmEvidence(db))
      console.log(`${gameId}: runtime catalog and terminology verified`)
    }
    finally { db.close() }
  }
} finally { dictionary.close() }
