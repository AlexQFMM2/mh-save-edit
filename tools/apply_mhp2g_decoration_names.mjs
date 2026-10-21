#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { applyDecorationNameReview } from './mhp2g/decorationNameReview.mjs'
import { auditDecorations } from './mhp2g/decorationCatalog.mjs'

export function buildReviewedDecorationCatalog({ base, reviewFile, output }) {
  assert(!fs.existsSync(output), 'Output exists; use a new directory')
  const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'))
  assert(review.inputs?.length, 'Missing review input fingerprints')
  for (const input of review.inputs) assert.equal(sha256(input.path), input.sha256, `Stale review input: ${input.path}`)
  assert.equal(sha256(base), review.inputs[0].sha256, 'Review/base fingerprint mismatch')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temp = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-names-'))
  let db
  try {
    const file = path.join(temp, 'mhp2g.sqlite'), original = new Database(base, { readonly: true })
    try { original.prepare('VACUUM INTO ?').run(file) } finally { original.close() }
    db = new Database(file); db.pragma('foreign_keys=ON')
    const audit = applyDecorationNameReview(db, review)
    audit.decorations = auditDecorations(db)
    const builderHash = [fileURLToPath(import.meta.url), fileURLToPath(new URL('./mhp2g/decorationNameReview.mjs', import.meta.url))].map(sha256).join(':')
    db.prepare('INSERT OR REPLACE INTO catalog_build_metadata VALUES (?,?,?,?)').run('decoration_names', 'mhp2g', sha256(reviewFile), builderHash)
    db.exec('VACUUM'); db.close(); db = undefined
    const result = { schema: 'mhp2g-decoration-name-build-v1', baseSha256: sha256(base), reviewSha256: sha256(reviewFile), builderHash, databaseSha256: sha256(file), audit }
    fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(result, null, 2) + '\n')
    fs.renameSync(temp, output)
    return result
  } finally { db?.close(); fs.rmSync(temp, { recursive: true, force: true }) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, reviewFile, output] = process.argv.slice(2)
  assert(output, 'Usage: apply_mhp2g_decoration_names.mjs <complete-base.sqlite> <private-name-review.json> <new-output>')
  console.log(JSON.stringify(buildReviewedDecorationCatalog({ base, reviewFile, output }), null, 2))
}
