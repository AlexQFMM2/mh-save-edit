#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { tableFingerprint } from './mhp2g/skillCatalog.mjs'
import { readWeaponEvidence } from './mhp2g/weaponEvidence.mjs'
import { appendWeapons, auditWeapons } from './mhp2g/weaponCatalog.mjs'
import { expectedWeaponCounts } from './build_mhp2g_weapon_catalog.mjs'

export function auditWeaponCatalog({ database, base, review, pilot, localization, nameReview, assets, expected = expectedWeaponCounts }) {
  const evidence = readWeaponEvidence({ review, pilot, localization, nameReview })
  const db = new Database(database, { readonly: true, fileMustExist: true })
  const reference = new Database(fs.readFileSync(base))
  try {
    reference.pragma('foreign_keys=ON')
    const original = reference.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r => r.name)
    for (const table of original) assert.equal(tableFingerprint(db, table), tableFingerprint(reference, table), `Existing data changed: ${table}`)
    const boundary = reference.transaction(() => appendWeapons(reference, evidence))()
    for (const { name } of reference.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'p2g_weapon%' ORDER BY name").all()) assert.equal(tableFingerprint(db, name), tableFingerprint(reference, name), `Weapon source mismatch: ${name}`)
    const schema = "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"
    assert.deepEqual(db.prepare(schema).all(), reference.prepare(schema).all(), 'Unexpected schema change')
    const meta = reference.prepare('SELECT * FROM meta ORDER BY key').all()
    const capabilities = meta.find(r => r.key === 'catalog_capabilities')
    assert(capabilities, 'Missing base capabilities')
    capabilities.value += ',weapons'
    meta.push({ key: 'weapon_schema', value: 'mhp2g-weapons-v1' })
    assert.deepEqual(db.prepare('SELECT * FROM meta ORDER BY key').all(), meta.sort((a, b) => a.key.localeCompare(b.key)), 'Unexpected metadata change')
    assert.deepEqual(db.prepare("SELECT * FROM catalog_build_metadata WHERE domain<>'weapons' ORDER BY domain").all(), reference.prepare('SELECT * FROM catalog_build_metadata ORDER BY domain').all(), 'Existing provenance changed')
    assert.equal(db.prepare("SELECT source_sha256 FROM catalog_build_metadata WHERE domain='weapons'").get()?.source_sha256, evidence.sourceHash)
    const audit = auditWeapons(db, expected)
    if (assets) for (const icon of evidence.iconFiles) assert.equal(sha256(path.join(assets, icon.path)), icon.sha256, 'Delivery icon changed')
    return { status: 'passed', databaseSha256: sha256(database), baseSha256: sha256(base), sourceManifestSha256: evidence.sourceHash, nativeReviewSha256: evidence.nativeReviewSha256, nameReviewSha256: evidence.nameReviewSha256, ...audit, preservedTables: original.length, ...boundary, iconsVerified: assets ? evidence.iconFiles.length : 0 }
  } finally { db.close(); reference.close() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
  for (const flag of ['--database', '--base', '--review', '--pilot', '--localization']) assert(args.includes(flag) && arg(flag) && !arg(flag).startsWith('--'), `Missing ${flag}`)
  if (args.includes('--name-review')) assert(arg('--name-review') && !arg('--name-review').startsWith('--'), 'Missing --name-review value')
  const result = auditWeaponCatalog({ database: arg('--database'), base: arg('--base'), review: arg('--review'), pilot: arg('--pilot'), localization: arg('--localization'), nameReview: args.includes('--name-review') ? arg('--name-review') : undefined, assets: args.includes('--assets') ? arg('--assets') : undefined })
  if (args.includes('--output')) { assert(!fs.existsSync(arg('--output')), 'Audit output exists'); fs.writeFileSync(arg('--output'), JSON.stringify(result, null, 2) + '\n') }
  console.log(JSON.stringify(result, null, 2))
}
