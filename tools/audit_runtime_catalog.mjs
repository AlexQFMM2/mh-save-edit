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
    auditP3CharmGeneration(mhp3)
    console.log(`mhp3: runtime catalog, icons, charm rules and terminology verified (${armorIdentities} armor identities)`)
  } finally { mhp3.close() }

/** Native charm identification rules (overlay104:0x09dbb23c). The fully
 * enumerated 1,561,429-row table stays private; these compact tables are the
 * shipped form and must stay internally consistent. */
function auditP3CharmGeneration(db) {
  if (db.prepare("SELECT value FROM meta WHERE key='charm_generation_schema'").get()?.value !== 'mhp3-charm-generation-v1') {
    throw new Error('P3 charm generation rules are missing; install the rebuilt P3 catalog')
  }
  if (!db.prepare("SELECT value FROM meta WHERE key='charm_generation_data_version'").get()?.value) throw new Error('P3 charm generation version is missing')
  const expected = [
    { source_key: 'ancient', item_id: 810, skill2_pool: 'ancient2', second_skill_threshold: 25 },
    { source_key: 'mystery', item_id: 808, skill2_pool: null, second_skill_threshold: 100 },
    { source_key: 'shining', item_id: 809, skill2_pool: 'shining2', second_skill_threshold: 35 },
  ]
  const sources = db.prepare('SELECT source_key,item_id,skill1_pool,skill2_pool,second_skill_threshold,slot_table_key,evidence FROM p3_charm_generation_sources ORDER BY source_key').all()
  if (JSON.stringify(sources.map(({ source_key, item_id, skill2_pool, second_skill_threshold }) => ({ source_key, item_id, skill2_pool, second_skill_threshold }))) !== JSON.stringify(expected)) {
    throw new Error('P3 charm generation sources changed')
  }
  for (const source of sources) {
    if (source.slot_table_key !== source.source_key || !source.evidence.includes('0x09dbb23c')) throw new Error(`P3 charm source evidence is incomplete: ${source.source_key}`)
    for (const pool of [source.skill1_pool, source.skill2_pool].filter(Boolean)) {
      const rows = db.prepare('SELECT COUNT(*) count FROM p3_skill_charm_sources WHERE source_key LIKE ?').get(`mhp3:pool:${pool}:%`).count
      if (!rows) throw new Error(`P3 charm pool has no rows: ${pool}`)
    }
  }
  const slots = db.prepare('SELECT source_key,rank,slot,cumulative,width FROM p3_charm_slot_tables ORDER BY source_key,rank,slot').all()
  if (slots.length !== 3 * 21 * 4) throw new Error(`P3 charm slot rows changed: ${slots.length}`)
  for (const source of sources) {
    for (let rank = 0; rank <= 20; rank += 1) {
      let previous = 0
      for (let slot = 0; slot <= 3; slot += 1) {
        const row = slots.find(value => value.source_key === source.source_key && value.rank === rank && value.slot === slot)
        if (!row || row.width !== row.cumulative - previous || row.width < 0) throw new Error(`P3 charm slot table is inconsistent: ${source.source_key} rank ${rank}`)
        previous = row.cumulative
      }
      if (previous !== 100) throw new Error(`P3 charm slot row does not reach 100: ${source.source_key} rank ${rank}`)
    }
  }
  const grades = db.prepare('SELECT grade,min_f,max_f FROM p3_charm_grade_rules ORDER BY grade').all()
  const expectedGrades = [[0, 0, 7], [1, 8, 26], [2, 0, 7], [3, 8, 26], [4, 0, 7], [5, 8, 12], [6, 13, 26]]
  if (JSON.stringify(grades.map(row => [row.grade, row.min_f, row.max_f])) !== JSON.stringify(expectedGrades)) throw new Error('P3 charm grade rules changed')
}

} finally { dictionary.close() }
