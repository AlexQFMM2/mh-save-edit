import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Synthetic ESM fixture.
import { createWeaponFixture } from './fixtures/p2gWeaponCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildWeaponCatalog } from '../tools/build_mhp2g_weapon_catalog.mjs'
// @ts-expect-error ESM builder.
import { buildHornSupplement } from '../tools/build_mhp2g_horn_supplement.mjs'
// @ts-expect-error ESM auditor.
import { readHornReview, auditHornSupplement } from '../tools/mhp2g/hornPerformance.mjs'
import { P2gWeaponCatalogRepository } from '../api/catalog/p2gWeaponRepository'

// Arbitrary synthetic values, never a copy of game evidence.
const performance = { kind: 'timed', effectCn: '合成初次效果', repeatEffectCn: '合成重奏效果', maestroEffectCn: '合成技能修正', conditions: ['合成覆盖条件'], precedingNoteNot: 1,
  normal: { initialSeconds: 17, repeatSeconds: 5, repeatCapSeconds: 17, repeatMode: 'extend' },
  maestro: { initialSeconds: 23, repeatSeconds: 9, repeatCapSeconds: 23, repeatMode: 'extend' } }
const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).reverse().forEach(f => f()))
const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function open(file: string) { const db = new Database(file); cleanup.push(() => db.close()); return db }
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2g-horn-test-'))
  cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  const f = createWeaponFixture(dir); buildWeaponCatalog(f)
  const base = path.join(f.output, 'mhp2g.sqlite'), db = open(base)
  const weapon = JSON.parse((db.prepare("SELECT detail_json FROM p2g_weapons WHERE weapon_key='weapon_blademaster:4'").get() as { detail_json: string }).detail_json)
  const { duration: _, repeatEffect: __, skillDuration: ___, ...song } = weapon.special.songs[0]
  const document = { schema: 'mhp2g-horn-review-v1', songs: [{ ...song, performance: structuredClone(performance) }] }
  const review = path.join(dir, 'horn-review'); fs.mkdirSync(review)
  const options = { base, baseSha256: hash(base), review, reviewSha256: '', output: path.join(dir, 'supplement'), expected: { weapons: 10, horns: 1, associations: 1, patterns: 1, effects: 1 } }
  const save = () => {
    const file = path.join(review, 'performance-review.json'); fs.writeFileSync(file, JSON.stringify(document))
    const manifest = path.join(review, 'manifest.json')
    fs.writeFileSync(manifest, JSON.stringify({ schema: 'mhp2g-horn-evidence-v1', files: { 'performance-review.json': { bytes: fs.statSync(file).size, sha256: hash(file) } } }))
    options.reviewSha256 = hash(manifest)
  }
  save(); return { options, document, save }
}

describe('P2G reviewed horn supplement', () => {
  it('adds exact reviewed performance, changes the data version and preserves every previous field/table', () => {
    const { options } = setup(), originalHash = hash(options.base)
    const manifest = buildHornSupplement(options)
    expect(manifest.audit).toMatchObject({ status: 'passed', ...options.expected })
    const source = open(options.base), output = open(path.join(options.output, 'mhp2g.sqlite'))
    const oldRepo = new P2gWeaponCatalogRepository(source), repo = new P2gWeaponCatalogRepository(output)
    const detail = repo.getWeapon({ gameId: 'mhp2g', weaponKey: 'weapon_blademaster:4' })!
    expect(detail.special).toMatchObject({ songs: [{ performance }] })
    expect(repo.getWeaponTree(detail.typeId).dataVersion).not.toBe(oldRepo.getWeaponTree(detail.typeId).dataVersion)
    expect(hash(options.base)).toBe(originalHash)
    expect(() => buildHornSupplement(options)).toThrow(/Output exists/)
  })
  it.each(['identity', 'notes', 'duplicate', 'unused', 'constraint', 'time', 'instant', 'hash', 'baseHash'])('rejects %s errors without publishing partial output', kind => {
    const { options, document, save } = setup(), song = document.songs[0]
    if (kind === 'identity') song.effectNameJp = 'stale synthetic label'
    if (kind === 'notes') song.notes.reverse().push(7)
    if (kind === 'duplicate') document.songs.push(structuredClone(song))
    if (kind === 'unused') document.songs.push({ ...structuredClone(song), patternIndex: 999 })
    if (kind === 'constraint') song.performance.precedingNoteNot = 3
    if (kind === 'time') song.performance.normal.initialSeconds = -1
    if (kind === 'instant') song.performance.kind = 'instant'
    save()
    if (kind === 'hash') fs.appendFileSync(path.join(options.review, 'performance-review.json'), ' ')
    if (kind === 'baseHash') options.baseSha256 = '0'.repeat(64)
    expect(() => buildHornSupplement(options)).toThrow()
    expect(fs.existsSync(options.output)).toBe(false)
  })
  it.each(['performance', 'weapon', 'priorTable', 'metadata'])('detects post-build %s corruption', kind => {
    const { options } = setup(), manifest = buildHornSupplement(options)
    const base = open(options.base), db = open(path.join(options.output, 'mhp2g.sqlite'))
    if (kind === 'performance') db.exec("UPDATE p2g_weapons SET detail_json=json_set(detail_json,'$.special.songs[0].performance.normal.initialSeconds',99) WHERE weapon_key='weapon_blademaster:4'")
    if (kind === 'weapon') db.exec("UPDATE p2g_weapons SET detail_json=json_set(detail_json,'$.nameCn','changed') WHERE weapon_key='weapon_blademaster:1'")
    if (kind === 'priorTable') db.exec('UPDATE p2g_weapon_recipes SET cost=1')
    if (kind === 'metadata') db.exec("UPDATE catalog_build_metadata SET source_sha256='changed' WHERE domain='weapons'")
    expect(() => auditHornSupplement(base, db, readHornReview(options.review, options.reviewSha256), manifest.builderHash)).toThrow()
  })
})
