#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { readHornReview, supplementHorn, auditHornSupplement } from './mhp2g/hornPerformance.mjs'

export function buildHornSupplement({ base, baseSha256, review, reviewSha256, output, expected }) {
  assert(!fs.existsSync(output), 'Output exists; refusing to overwrite')
  assert.equal(sha256(base), baseSha256, 'Base fingerprint mismatch')
  const evidence = readHornReview(review, reviewSha256)
  const builderHash = ['build_mhp2g_horn_supplement.mjs', 'mhp2g/hornPerformance.mjs'].map(name => sha256(fileURLToPath(new URL(name, import.meta.url)))).join(':')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temp = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-horn-'))
  let source, db
  try {
    source = new Database(base, { readonly: true, fileMustExist: true })
    assert.equal(source.pragma('integrity_check', { simple: true }), 'ok')
    assert.deepEqual(source.pragma('foreign_key_check'), [])
    const file = path.join(temp, 'mhp2g.sqlite')
    fs.copyFileSync(base, file)
    db = new Database(file)
    db.pragma('foreign_keys=ON')
    const seen = new Set()
    db.transaction(() => {
      const update = db.prepare('UPDATE p2g_weapons SET detail_json=? WHERE weapon_key=?')
      for (const row of db.prepare('SELECT weapon_key,detail_json FROM p2g_weapons').all()) {
        const weapon = JSON.parse(row.detail_json)
        if (weapon.special.kind === 'huntingHorn') update.run(JSON.stringify(supplementHorn(weapon, evidence, seen)), row.weapon_key)
      }
      db.prepare('INSERT INTO catalog_build_metadata VALUES (?,?,?,?)').run('weapons_horn', 'mhp2g', evidence.sourceHash, builderHash)
    })()
    const audit = auditHornSupplement(source, db, evidence, builderHash, expected)
    db.exec('VACUUM')
    db.close(); db = null
    // Detect a changing runtime source before publishing a result.
    assert.equal(sha256(base), baseSha256, 'Base changed during build')
    const manifest = { schema: 'mhp2g-horn-supplement-v1', baseSha256, sourceManifestSha256: evidence.sourceHash, builderHash, databaseSha256: sha256(file), audit }
    fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    assert(!fs.existsSync(output), 'Output exists')
    fs.renameSync(temp, output)
    return manifest
  } finally { source?.close(); db?.close(); fs.rmSync(temp, { recursive: true, force: true }) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
  for (const flag of ['--base', '--base-sha256', '--review', '--review-sha256', '--output'])
    assert(args.includes(flag) && arg(flag) && !arg(flag).startsWith('--'), `Missing ${flag}`)
  console.log(JSON.stringify(buildHornSupplement({ base: arg('--base'), baseSha256: arg('--base-sha256'), review: arg('--review'), reviewSha256: arg('--review-sha256'), output: arg('--output') }), null, 2))
}
