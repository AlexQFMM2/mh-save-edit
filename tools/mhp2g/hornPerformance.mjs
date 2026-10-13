import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { sha256 } from './sources.mjs'
import { tableFingerprint } from './skillCatalog.mjs'

const text = z.string().trim().min(1)
const note = z.number().int().min(1).max(7)
const timing = z.object({
  initialSeconds: z.number().int().positive(),
  repeatSeconds: z.number().int().positive(),
  repeatCapSeconds: z.number().int().positive(),
  repeatMode: z.enum(['extend', 'replace']),
}).strict().superRefine((value, ctx) => {
  if (value.repeatMode === 'replace' && value.repeatSeconds !== value.repeatCapSeconds)
    ctx.addIssue({ code: 'custom', message: 'Replacement must equal its repeat cap' })
})
const common = { effectCn: text, repeatEffectCn: text, maestroEffectCn: text, conditions: z.array(text), precedingNoteNot: note.nullable() }
const performance = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('timed'), normal: timing, maestro: timing }).strict(),
  z.object({ ...common, kind: z.literal('instant'), normal: z.null(), maestro: z.null() }).strict(),
])
const reviewSchema = z.object({ schema: z.literal('mhp2g-horn-review-v1'), songs: z.array(z.object({
  patternIndex: z.number().int().nonnegative(), effectIndex: z.number().int().nonnegative(),
  notes: z.array(note).min(1), nativePatternNewestFirst: z.array(z.number().int().min(0).max(255)).length(4),
  effectNameJp: text, performance,
}).strict()).min(1) }).strict()

/** Only consume a frozen local review with an explicitly pinned manifest. */
export function readHornReview(directory, manifestSha256) {
  assert.match(manifestSha256, /^[a-f0-9]{64}$/)
  const manifestFile = path.join(directory, 'manifest.json')
  assert.equal(sha256(manifestFile), manifestSha256, 'Horn manifest fingerprint mismatch')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  assert.equal(manifest.schema, 'mhp2g-horn-evidence-v1')
  assert(manifest.files?.['performance-review.json'], 'Missing performance review')
  for (const [name, fingerprint] of Object.entries(manifest.files)) {
    assert(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'), 'Invalid evidence path')
    const file = path.join(directory, name)
    assert.equal(fs.statSync(file).size, fingerprint.bytes, `Evidence size: ${name}`)
    assert.equal(sha256(file), fingerprint.sha256, `Evidence fingerprint: ${name}`)
  }
  const review = reviewSchema.parse(JSON.parse(fs.readFileSync(path.join(directory, 'performance-review.json'), 'utf8')))
  const songs = new Map(), effects = new Map()
  for (const song of review.songs) {
    assert(!songs.has(song.patternIndex), 'Duplicate horn pattern')
    const high = song.nativePatternNewestFirst.filter(n => n >= 128)
    assert(high.length <= 1, 'Multiple preceding-note constraints')
    assert.equal(song.performance.precedingNoteNot, high.length ? high[0] & 127 : null, 'Preceding-note mismatch')
    assert.deepEqual(song.notes, song.nativePatternNewestFirst.filter(n => n > 0 && n < 128).reverse(), 'Note order mismatch')
    const { precedingNoteNot: _, ...effect } = song.performance
    if (effects.has(song.effectIndex)) assert.deepEqual(effect, effects.get(song.effectIndex), 'Inconsistent effect review')
    effects.set(song.effectIndex, effect)
    songs.set(song.patternIndex, song)
  }
  return { songs, effects, sourceHash: manifestSha256 }
}

export function supplementHorn(weapon, review, seen) {
  if (weapon.special.kind !== 'huntingHorn') return weapon
  return { ...weapon, special: { ...weapon.special, songs: weapon.special.songs.map(song => {
    const evidence = review.songs.get(song.patternIndex)
    assert(evidence, `Missing horn pattern: ${song.patternIndex}`)
    for (const field of ['patternIndex', 'effectIndex', 'notes', 'nativePatternNewestFirst', 'effectNameJp'])
      assert.deepEqual(song[field], evidence[field], `Horn identity mismatch: ${field}`)
    assert(!song.performance, 'Base already contains horn performance')
    seen.add(song.patternIndex)
    return { ...song, performance: evidence.performance }
  }) } }
}

/** Full comparison: only reviewed song performance and one metadata row may change. */
export function auditHornSupplement(base, result, review, builderHash, expected) {
  assert.equal(result.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(result.pragma('foreign_key_check'), [])
  const schema = db => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all()
  assert.deepEqual(schema(result), schema(base), 'Schema changed')
  const tables = base.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name)
  for (const table of tables.filter(t => !['p2g_weapons', 'catalog_build_metadata'].includes(t)))
    assert.equal(tableFingerprint(result, table), tableFingerprint(base, table), `Existing table changed: ${table}`)
  const metadata = db => db.prepare('SELECT * FROM catalog_build_metadata ORDER BY domain,game_id').all()
  const oldMetadata = metadata(base)
  assert(!oldMetadata.some(r => r.domain === 'weapons_horn'), 'Base already supplemented')
  assert.deepEqual(metadata(result).filter(r => r.domain !== 'weapons_horn'), oldMetadata, 'Previous provenance changed')
  assert.deepEqual(result.prepare("SELECT * FROM catalog_build_metadata WHERE domain='weapons_horn'").all(), [
    { domain: 'weapons_horn', game_id: 'mhp2g', source_sha256: review.sourceHash, builder_sha256: builderHash },
  ])
  const rows = db => db.prepare('SELECT * FROM p2g_weapons ORDER BY weapon_key').all()
  const before = rows(base), after = rows(result), seen = new Set()
  assert.equal(after.length, before.length, 'Weapon count changed')
  let horns = 0, associations = 0
  for (let i = 0; i < before.length; i++) {
    const weapon = JSON.parse(before[i].detail_json)
    const wanted = supplementHorn(weapon, review, seen)
    assert.deepEqual({ ...after[i], detail_json: JSON.parse(after[i].detail_json) }, { ...before[i], detail_json: wanted }, `Weapon changed: ${before[i].weapon_key}`)
    if (weapon.special.kind === 'huntingHorn') { horns++; associations += weapon.special.songs.length }
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...review.songs.keys()].sort((a, b) => a - b), 'Unused horn evidence')
  const counts = { weapons: before.length, horns, associations, patterns: seen.size, effects: review.effects.size }
  if (expected) assert.deepEqual(counts, expected, 'Horn coverage mismatch')
  return { status: 'passed', ...counts, preservedTables: tables.length - 2 }
}
