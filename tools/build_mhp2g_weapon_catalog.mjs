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

export const expectedWeaponCounts = { weapons: 1501, types: 11, edges: 958, crossTypeEdges: 55, productionRecipes: 806, upgradeRecipes: 940, shardRecipes: 10, shardOutputs: 30, materials: 6033, legacyUsages: 6023 }

export function buildWeaponCatalog({ base, baseSha256, output, review, pilot, localization, nameReview, expected }) {
  assert(!fs.existsSync(output), 'Output exists; refusing to overwrite')
  assert.equal(sha256(base), baseSha256, 'Base fingerprint mismatch')
  const evidence = readWeaponEvidence({ review, pilot, localization, nameReview })
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temp = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-weapons-'))
  let db
  try {
    const file = path.join(temp, 'mhp2g.sqlite')
    fs.copyFileSync(base, file)
    db = new Database(file)
    db.pragma('foreign_keys=ON')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r => r.name)
    const before = new Map(tables.map(t => [t, tableFingerprint(db, t)]))
    const builderHash = ['build_mhp2g_weapon_catalog.mjs', 'mhp2g/weaponCatalog.mjs', 'mhp2g/weaponEvidence.mjs', 'mhp2g/weaponDefinitions.mjs', 'mhp2g/weaponNameReview.mjs'].map(name => sha256(fileURLToPath(new URL(name, import.meta.url)))).join(':')
    let boundary
    db.transaction(() => {
      boundary = appendWeapons(db, evidence)
      db.prepare('INSERT INTO meta VALUES (?,?)').run('weapon_schema', 'mhp2g-weapons-v1')
      const caps = db.prepare("SELECT value FROM meta WHERE key='catalog_capabilities'").get().value
      db.prepare("UPDATE meta SET value=? WHERE key='catalog_capabilities'").run(`${caps},weapons`)
      db.prepare('INSERT INTO catalog_build_metadata VALUES (?,?,?,?)').run('weapons', 'mhp2g', evidence.sourceHash, builderHash)
    })()
    const audit = auditWeapons(db, expected)
    for (const table of tables) assert.equal(tableFingerprint(db, table), before.get(table), `Existing table changed: ${table}`)
    audit.preservedTables = tables.length
    db.exec('VACUUM')
    db.close(); db = null
    for (const icon of evidence.iconFiles) {
      const target = path.join(temp, 'assets', icon.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(icon.file, target)
    }
    const result = { schema: 'mhp2g-weapons-v1', baseSha256, sourceManifestSha256: evidence.sourceHash, nativeReviewSha256: evidence.nativeReviewSha256, nameReviewSha256: evidence.nameReviewSha256, builderHash, databaseSha256: sha256(file), audit, ...boundary, icons: evidence.iconFiles.map(({ path, sha256 }) => ({ path, sha256 })) }
    fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(result, null, 2) + '\n')
    assert(!fs.existsSync(output), 'Output exists')
    fs.renameSync(temp, output)
    return result
  } finally { db?.close(); fs.rmSync(temp, { recursive: true, force: true }) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
  for (const flag of ['--base', '--base-sha256', '--output', '--review', '--pilot', '--localization']) assert(args.includes(flag) && arg(flag) && !arg(flag).startsWith('--'), `Missing ${flag}`)
  if (args.includes('--name-review')) assert(arg('--name-review') && !arg('--name-review').startsWith('--'), 'Missing --name-review value')
  const result = buildWeaponCatalog({ base: arg('--base'), baseSha256: arg('--base-sha256'), output: arg('--output'), review: arg('--review'), pilot: arg('--pilot'), localization: arg('--localization'), nameReview: args.includes('--name-review') ? arg('--name-review') : undefined, expected: expectedWeaponCounts })
  console.log(JSON.stringify({ ...result, icons: result.icons.length }, null, 2))
}
