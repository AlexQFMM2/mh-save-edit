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
  // P3 keeps item icons as served /assets/... paths and has no shared
  // decoration/skill tables, so it needs its own runtime checks.
  const mhp3 = new Database(fileURLToPath(new URL('../data/mhp3.sqlite', import.meta.url)), { readonly: true, fileMustExist: true })
  try {
    if (mhp3.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('mhp3: integrity check failed')
    if (mhp3.pragma('foreign_key_check').length) throw new Error('P3 catalog has dangling references')
    const expected = dictionary.prepare('SELECT value FROM meta WHERE key=?').get('catalog:mhp3')?.value
    if (!expected) throw new Error('Dictionary has no P3 catalog binding')
    if (expected !== identityFingerprint(catalogIdentityRows(mhp3, 'mhp3'))) throw new Error('mhp3: terminology catalog identity mismatch')
    const schemas = { catalog_schema: 'mhp3-items-v1', armor_schema: 'mhp3-armors-v1', skill_schema: 'mhp3-skills-v1', weapon_schema: 'mhp3-weapons-v1', monster_schema: 'mhp3-monsters-v1', quest_schema: 'mhp3-quests-v1' }
    for (const [key, value] of Object.entries(schemas)) {
      if (mhp3.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value !== value) throw new Error(`P3 ${key} runtime schema missing`)
    }
    const missingIcons = mhp3.prepare('SELECT DISTINCT icon_path FROM catalog_items WHERE icon_path IS NOT NULL').all()
      .map(row => row.icon_path.replace(/^\/assets\//, ''))
      .filter(icon => !fs.existsSync(fileURLToPath(new URL(`../ui/public/assets/${icon}`, import.meta.url))))
    if (missingIcons.length) throw new Error(`P3 catalog icons missing from runtime assets: ${missingIcons.length}`)
    const armorIdentities = mhp3.prepare('SELECT COUNT(*) count FROM p3_armor_members').get().count
    if (armorIdentities !== 1131) throw new Error(`P3 armor identities changed: ${armorIdentities}`)
    console.log(`mhp3: runtime catalog, icons and terminology verified (${armorIdentities} armor identities)`)
  } finally { mhp3.close() }
} finally { dictionary.close() }
