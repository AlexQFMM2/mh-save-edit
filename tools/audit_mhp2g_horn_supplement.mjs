#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { readHornReview, auditHornSupplement } from './mhp2g/hornPerformance.mjs'

export function auditHornCatalog({ database, base, review, reviewSha256, manifest: manifestFile }) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  assert.equal(manifest.schema, 'mhp2g-horn-supplement-v1')
  assert.equal(sha256(base), manifest.baseSha256, 'Base fingerprint mismatch')
  assert.equal(sha256(database), manifest.databaseSha256, 'Database fingerprint mismatch')
  assert.equal(manifest.sourceManifestSha256, reviewSha256, 'Review fingerprint mismatch')
  const evidence = readHornReview(review, reviewSha256)
  const source = new Database(base, { readonly: true, fileMustExist: true })
  let db
  try {
    db = new Database(database, { readonly: true, fileMustExist: true })
    const audit = auditHornSupplement(source, db, evidence, manifest.builderHash)
    assert.deepEqual(audit, manifest.audit, 'Audit report mismatch')
    return { ...audit, databaseSha256: manifest.databaseSha256, sourceManifestSha256: reviewSha256 }
  } finally { source.close(); db?.close() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
  for (const flag of ['--database', '--base', '--review', '--review-sha256', '--manifest'])
    assert(args.includes(flag) && arg(flag) && !arg(flag).startsWith('--'), `Missing ${flag}`)
  console.log(JSON.stringify(auditHornCatalog({ database: arg('--database'), base: arg('--base'), review: arg('--review'), reviewSha256: arg('--review-sha256'), manifest: arg('--manifest') }), null, 2))
}
