import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Synthetic ESM fixture.
import { createWeaponFixture } from './fixtures/p2gWeaponCatalog.mjs'
// @ts-expect-error Native ESM builder.
import { buildWeaponCatalog } from '../tools/build_mhp2g_weapon_catalog.mjs'
// @ts-expect-error Native ESM audit.
import { auditWeapons } from '../tools/mhp2g/weaponCatalog.mjs'
// @ts-expect-error Native ESM auditor.
import { auditWeaponCatalog } from '../tools/audit_mhp2g_weapons.mjs'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { P2gWeaponCatalogRepository } from '../api/catalog/p2gWeaponRepository'
import { weaponCatalogFiltersSchema, weaponIdentitySchema, weaponTreeRequestSchema, gameIdSchema } from '../api/catalog/schemas'
import { p2gHornEffectLabel, p2gSpecialSummary } from '../api/catalog/p2gWeaponPresentation'
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).reverse().forEach(fn => fn()))
function setup(build = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2g-weapons-'))
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  const fixture = createWeaponFixture(dir)
  if (build) buildWeaponCatalog(fixture)
  return fixture
}
function open(file: string) {
  const db = new Database(file)
  cleanups.push(() => db.close())
  return db
}
const identity = (index: number) => ({ gameId: 'mhp2g' as const, weaponKey: `weapon_blademaster:${index}` })
const ranged = (index: number) => ({ gameId: 'mhp2g' as const, weaponKey: `weapon_ranged:${index}` })
const fingerprint = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function reviewedFixture() {
  const f = setup(false)
  for (const [key, unit] of Object.entries(f.snapshot.translations.units) as [string, { chinese: string | null; status: string }][]) {
    f.snapshot.translations.bindings[key].kind = 'weapon'
    unit.status = unit.chinese === null ? 'pending' : 'official'
  }
  f.save()
  const document = { schema: 'mhp2g-weapon-name-review-v1', localizationSha256: fingerprint(f.localization), nativeReviewSha256: fingerprint(path.join(f.review, 'manifest.json')), entries: f.snapshot.derived.weapons.filter((w: { record_key: string }) => f.snapshot.eligibility.reachable.includes(w.record_key) && f.snapshot.translations.units[w.record_key].status === 'pending').map((w: { record_key: string; row_sha256: string; nameJa: string }) => ({ weaponKey: w.record_key, textKey: w.record_key, nativeRowSha256: w.row_sha256, japanese: w.nameJa, chinese: `合成审阅武器${w.record_key}`, basis: 'Synthetic per-weapon review context.' })) }
  const nameReview = path.join(path.dirname(f.output), 'name-review.json')
  const saveReview = () => fs.writeFileSync(nameReview, JSON.stringify(document))
  saveReview()
  return { ...f, nameReview, document, saveReview }
}
describe('P2G weapon data and read-only contract', () => {
  it('rebuilds reviewed names with provenance while preserving frozen sources, Japanese search and reverse usages', () => {
    const f = reviewedFixture(), original = fs.readFileSync(f.localization)
    buildWeaponCatalog({ ...f, output: f.output + '-original', nameReview: undefined })
    const built = buildWeaponCatalog(f)
    expect(built.nameReviewSha256).toBe(fingerprint(f.nameReview))
    expect(built.sourceManifestSha256).not.toBe(f.document.nativeReviewSha256)
    expect(fs.readFileSync(f.localization)).toEqual(original)
    const database = path.join(f.output, 'mhp2g.sqlite'), db = open(database), repo = new P2gWeaponCatalogRepository(db)
    for (const row of f.document.entries) {
      const w = repo.getWeapon({ gameId: 'mhp2g', weaponKey: row.weaponKey })!
      expect(w).toMatchObject({ nameCn: row.chinese, nameJp: row.japanese, nameSource: 'reviewed' })
      for (const query of [row.chinese, row.japanese]) expect(repo.searchWeapons({ gameId: 'mhp2g', query }).items.map(w => w.weaponKey)).toContain(row.weaponKey)
    }
    const originalDb = open(path.join(f.output + '-original', 'mhp2g.sqlite'))
    for (const row of db.prepare('SELECT weapon_key,detail_json FROM p2g_weapons').all() as { weapon_key: string; detail_json: string }[]) {
      const before = JSON.parse((originalDb.prepare('SELECT detail_json FROM p2g_weapons WHERE weapon_key=?').get(row.weapon_key) as { detail_json: string }).detail_json), after = JSON.parse(row.detail_json)
      for (const value of [before, after]) { delete value.nameCn; delete value.nameSource }
      expect(after).toEqual(before)
    }
    const itemRepo = new P2gItemCatalogRepository(db)
    expect(itemRepo.searchItems({ gameId: 'mhp2g', query: f.document.entries[0].chinese }).items.some(i => i.matchReason?.startsWith('命中：武器材料·'))).toBe(true)
    expect(auditWeaponCatalog({ ...f, database })).toMatchObject({ status: 'passed', nameReviewSha256: built.nameReviewSha256 })
    expect(() => auditWeaponCatalog({ ...f, database, nameReview: undefined })).toThrow(/Weapon source mismatch/)
  })
  it.each(['source', 'nativeReview', 'original', 'binding', 'row', 'duplicate', 'missing', 'official', 'excluded', 'kana', 'basis'])('rejects %s name review errors before publishing output', kind => {
    const f = reviewedFixture(), row = f.document.entries[0]
    if (kind === 'source') f.document.localizationSha256 = 'bad'
    if (kind === 'nativeReview') f.document.nativeReviewSha256 = 'bad'
    if (kind === 'original') row.japanese = 'stale'
    if (kind === 'binding') row.textKey = 'wrong'
    if (kind === 'row') row.nativeRowSha256 = 'bad'
    if (kind === 'duplicate') f.document.entries.push({ ...row })
    if (kind === 'missing') f.document.entries.pop()
    if (kind === 'official') row.weaponKey = 'weapon_blademaster:1'
    if (kind === 'excluded') row.weaponKey = 'weapon_blademaster:464'
    if (kind === 'kana') row.chinese = '中文テスト'
    if (kind === 'basis') row.basis = ''
    f.saveReview()
    expect(() => buildWeaponCatalog(f)).toThrow()
    expect(fs.existsSync(f.output)).toBe(false)
  })
  it('translates horn and shelling labels without inferring unknown mechanics', () => {
    expect(p2gHornEffectLabel('体力回復【中】＆解毒')).toBe('体力回复【中】／解毒')
    expect(p2gHornEffectLabel('寒さ無効＆耐雪')).toBe('寒冷无效／耐雪')
    expect(p2gHornEffectLabel('移動速度UP')).toBe('移动速度提升')
    expect(p2gHornEffectLabel('未确认效果')).toBe('未确认效果')
    expect(p2gHornEffectLabel('未确认\n效果')).toBe('未确认\n效果')
    expect(p2gSpecialSummary({ kind: 'gunlance', shelling: { typeJa: '拡散', level: 3 } })).toEqual(['扩散 Lv.3'])
  })
  it('builds byte-identically, preserves existing domains and refuses overwrite', () => {
    const f = setup(), before = fs.readFileSync(f.base)
    const second = buildWeaponCatalog({ ...f, output: f.output + '-repeat' })
    expect(second.audit).toMatchObject(f.expected)
    expect(fs.readFileSync(path.join(f.output, 'mhp2g.sqlite'))).toEqual(fs.readFileSync(path.join(f.output + '-repeat', 'mhp2g.sqlite')))
    expect(fs.readFileSync(f.base)).toEqual(before)
    expect(() => buildWeaponCatalog(f)).toThrow(/exists/i)
    const db = open(path.join(f.output, 'mhp2g.sqlite'))
    expect(db.prepare('SELECT count(*) n FROM p2g_decorations').get()).toEqual({ n: 2 })
    expect(db.prepare('SELECT count(*) n FROM p2g_quests').get()).toEqual({ n: 3 })
  })
  it.each(['base', 'evidence', 'icon', 'boundary', 'duplicate', 'name', 'endpoint', 'targetMaterials', 'legacyQuantity', 'unmapped', 'shard'])('rejects %s errors without publishing partial output', kind => {
    const f = setup(false)
    if (kind === 'base') f.baseSha256 = 'bad'
    if (kind === 'evidence') fs.appendFileSync(path.join(f.review, 'derived-weapons.json'), ' ')
    if (kind === 'icon') fs.appendFileSync(path.join(f.review, 'icons', f.snapshot.icons.icons[0].pngSha256 + '.png'), ' ')
    if (kind === 'boundary') { f.snapshot.eligibility.reachable.push('weapon_blademaster:0'); f.save() }
    if (kind === 'duplicate') { f.snapshot.derived.weapons.push(f.snapshot.derived.weapons[1]); f.save() }
    if (kind === 'name') { f.snapshot.translations.units['weapon_blademaster:1'].japanese = 'wrong'; f.save() }
    if (kind === 'endpoint') { f.snapshot.specials.upgrades[0].targetKey = 'weapon_blademaster:464'; f.save() }
    if (kind === 'targetMaterials') { f.snapshot.specials.upgrades[0].materials[0].quantity = 999; f.save() }
    if (kind === 'legacyQuantity') { const db = open(f.base); db.exec("UPDATE catalog_item_relations SET quantity=999 WHERE usage_kind='weapon'"); f.baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(f.base)).digest('hex') }
    if (kind === 'unmapped') { const db = open(f.base); db.exec("INSERT INTO catalog_item_relations(source_key,item_id,source_kind,usage_kind,target_name,quantity,metadata) VALUES('unknown',2,'weapon','weapon','Synthetic',1,'{}')"); f.baseSha256 = crypto.createHash('sha256').update(fs.readFileSync(f.base)).digest('hex') }
    if (kind === 'shard') { f.snapshot.specials.shards[0].outputs[0].rngModulo100Range = [0, 5]; f.save() }
    expect(() => buildWeaponCatalog(f)).toThrow()
    expect(fs.existsSync(f.output)).toBe(false)
  })
  it('isolates placeholders and quarantined records without fabricating save identities', () => {
    const f = setup(), repo = new P2gWeaponCatalogRepository(open(path.join(f.output, 'mhp2g.sqlite')))
    expect(repo.searchWeapons({ gameId: 'mhp2g' }).total).toBe(10)
    expect(repo.getWeapon(identity(464))).toBeNull()
    expect(repo.getWeapon(identity(0))).toBeNull()
    const w = repo.getWeapon(identity(1))!
    expect(w).toMatchObject({ nativeIndex: 1, nativeTable: 'weapon_blademaster', affinity: 10, raw: { affinity: 10 } })
    for (const field of ['saveId', 'saveType', 'dexId']) expect(w).not.toHaveProperty(field)
    expect(w.recipes.filter(r => r.kind === 'production').map(r => r.materials[0].quantity).sort()).toEqual([1, 9])
    expect(w.recipes[0].materials[0]).toHaveProperty('itemId')
    expect(w.recipes[0].materials[0]).not.toHaveProperty('saveId')
    expect(repo.getWeapon(identity(6))?.attributes.map(a => [a.kind, a.value])).toEqual([['ice', 120], ['poison', 80]])
  })
  it('retains cycles, cross-class endpoints and complete-graph final decisions', () => {
    const f = setup(), repo = new P2gWeaponCatalogRepository(open(path.join(f.output, 'mhp2g.sqlite')))
    const tree = repo.getWeaponTree(1), keys = new Set(tree.nodes.map(n => n.weaponKey))
    expect(tree.edges).toHaveLength(4)
    for (const edge of tree.edges) { expect(keys.has(edge.parentWeaponKey)).toBe(true); expect(keys.has(edge.childWeaponKey)).toBe(true) }
    expect(tree.nodes.find(n => n.weaponKey === identity(3).weaponKey)?.isCrossType).toBe(true)
    expect(tree.nodes.find(n => n.weaponKey === identity(6).weaponKey)?.isCrossType).toBe(true)
    expect(repo.searchWeapons({ gameId: 'mhp2g', weaponTypeId: 1, finalOnly: true }).total).toBe(0)
    expect(repo.getWeapon(identity(2))?.children[0]).toMatchObject({ weaponKey: identity(3).weaponKey, typeId: 2 })
    expect(repo.getWeapon(identity(2))?.recipes.find(r => r.kind === 'upgrade')?.materials[0].quantity).toBe(4)
    expect(repo.getWeapon(identity(3))?.recipes.find(r => r.kind === 'upgrade')?.materials[0].quantity).toBe(6)
  })
  it('keeps shard intervals separate from probability and resolves reverse material usages', () => {
    const f = setup(), repo = new P2gWeaponCatalogRepository(open(path.join(f.output, 'mhp2g.sqlite')))
    const shard = repo.getItemWeaponUsages(2).find(r => r.kind === 'shard')!
    expect(shard.cost).toBe(1000)
    expect(shard.outputs.map(o => o.rngModulo100Range)).toEqual([[0, 4], [5, 29], [30, 99]])
    expect(shard.outputs[0]).not.toHaveProperty('probability')
    expect(repo.getWeapon(identity(1))?.recipes.some(r => r.recipeKey === shard.recipeKey)).toBe(true)
  })
  it('closes item-to-weapon recipes and reverse-search reasons using native keys', () => {
    const f = setup(), db = open(path.join(f.output, 'mhp2g.sqlite')), repo = new P2gItemCatalogRepository(db)
    const item = repo.getItem({ gameId: 'mhp2g', itemId: 2 })!
    expect(item.gameId).toBe('mhp2g')
    if (item.gameId !== 'mhp2g') throw new Error('Expected native identity')
    expect(item.weaponRecipes?.length).toBeGreaterThan(0)
    expect(item.weaponRecipes?.some(r => r.kind === 'shard')).toBe(true)
    expect(item.relations.some(r => r.pendingTarget?.kind === 'weapon')).toBe(false)
    const page = repo.searchItems({ gameId: 'mhp2g', query: 'テスト武器blademaster3' })
    expect(page.items.map(i => i.gameId === 'mhp2g' ? i.itemId : i.saveId)).toContain(2)
    expect(page.items.find(i => i.gameId === 'mhp2g' && i.itemId === 2)?.matchReason).toMatch(/^命中：武器材料·/)
  })
  it('supports native numbering, Japanese fallback, material reasons, sorting, facets and pagination', () => {
    const f = setup(), repo = new P2gWeaponCatalogRepository(open(path.join(f.output, 'mhp2g.sqlite')))
    expect(repo.searchWeapons({ gameId: 'mhp2g', query: 'テスト武器blademaster3' }).items[0].nameCn).toBe('テスト武器blademaster3')
    expect(repo.searchWeapons({ gameId: 'mhp2g', query: '0x6' }).items.map(w => w.nativeIndex)).toEqual([6])
    expect(repo.searchWeapons({ gameId: 'mhp2g', query: '测试材料甲' }).items[0].matchReason).toMatch(/^命中：.*材料·测试材料甲$/)
    expect(repo.searchWeapons({ gameId: 'mhp2g', slots: 3 }).total).toBe(0)
    expect(repo.searchWeapons({ gameId: 'mhp2g', attributeId: 4 }).items.map(w => w.nativeIndex)).toEqual([6])
    expect(repo.searchWeapons({ gameId: 'mhp2g', sort: 'affinity' }).items[0].affinity).toBe(-10)
    expect(repo.searchWeapons({ gameId: 'mhp2g', page: 2, pageSize: 6 })).toMatchObject({ total: 10, hasNext: false, items: expect.any(Array) })
    expect(repo.searchWeapons({ gameId: 'mhp2g', targetWeaponKey: identity(3).weaponKey, query: 'no match', slots: 3 }).items[0].weaponKey).toBe(identity(3).weaponKey)
    expect(repo.getWeaponFacets()).toMatchObject({ weaponTypes: expect.any(Array), sharpnessStages: ['base', 'handicraft1'], slots: [1] })
  })
  it('preserves P2G bow limits, unavailable ammo templates, raw recoil and unknown horn semantics', () => {
    const f = setup(), repo = new P2gWeaponCatalogRepository(open(path.join(f.output, 'mhp2g.sqlite')))
    expect(repo.getWeapon(ranged(2))?.special).toMatchObject({ kind: 'bow', baseChargeCount: 2, loadUpChargeCount: 3, charges: [expect.objectContaining({ available: true, requiresLoadUp: false }), expect.objectContaining({ available: true, requiresLoadUp: false }), expect.objectContaining({ available: true, requiresLoadUp: true }), expect.objectContaining({ available: false, requiresLoadUp: false })] })
    expect(repo.getWeapon(ranged(3))?.special).toMatchObject({ baseChargeCount: 4, loadUpChargeCount: 4 })
    expect(repo.getWeapon(ranged(1))?.special).toMatchObject({ kind: 'bowgun', reloadRaw: 2, ammo: [expect.objectContaining({ available: false, capacityTemplate: 6, loadQuantity: null }), expect.objectContaining({ available: true, loadQuantity: 2 })], rapidFire: [expect.objectContaining({ shots: 3, damageMultiplier: 0.5 })] })
    expect(repo.getWeapon(identity(4))?.special).toMatchObject({ kind: 'huntingHorn', songs: [expect.objectContaining({ duration: null, repeatEffect: null, skillDuration: null, nativePatternNewestFirst: [1, 1, 129, 0] })] })
  })
  it('rejects incompatible identities and unsupported mechanics while preserving core GameId', () => {
    expect(weaponIdentitySchema.parse(identity(1))).toEqual(identity(1))
    for (const value of [{ gameId: 'mhp2g', weaponKey: '1:2' }, { gameId: 'mhgu', weaponKey: identity(1).weaponKey }, { ...identity(1), saveId: 1 }]) expect(() => weaponIdentitySchema.parse(value)).toThrow()
    for (const extra of [{ sort: 'saveId' }, { includeHiddenAttributes: true }, { sharpnessStage: 'handicraft2' }, { weaponTypeId: 9 }, { includePlaceholders: true }]) expect(() => weaponCatalogFiltersSchema.parse({ gameId: 'mhp2g', ...extra })).toThrow()
    expect(weaponCatalogFiltersSchema.parse({ gameId: 'mhp2g', sort: 'nativeId' })).toMatchObject({ sort: 'nativeId' })
    expect(() => weaponTreeRequestSchema.parse({ gameId: 'mhp2g', weaponTypeId: 9 })).toThrow()
    expect(() => gameIdSchema.parse('mhp2g')).toThrow()
    const f = setup(false)
    expect(() => new P2gWeaponCatalogRepository(open(f.base))).toThrow(/武器资料尚未安装/)
  })
  it('audits final-form corruption', () => {
    const f = setup(), db = open(path.join(f.output, 'mhp2g.sqlite'))
    db.exec("UPDATE p2g_weapons SET detail_json=json_set(detail_json,'$.isFinalForm',json('true')) WHERE weapon_key='weapon_blademaster:1'")
    expect(() => auditWeapons(db)).toThrow(/Final form/)
  })
  it('compares every built field with frozen sources and detects tampered recipes or older domains', () => {
    const f = setup(), database = path.join(f.output, 'mhp2g.sqlite')
    const options = { ...f, database, assets: path.join(f.output, 'assets') }
    expect(auditWeaponCatalog(options)).toMatchObject({ status: 'passed', weapons: 10, iconsVerified: 1 })
    const db = open(database)
    db.exec("UPDATE p2g_weapon_recipes SET cost=1 WHERE kind='shard'")
    expect(() => auditWeaponCatalog(options)).toThrow(/Weapon source mismatch/)
    db.exec("UPDATE p2g_weapon_recipes SET cost=1000 WHERE kind='shard'; UPDATE p2g_quests SET detail_json=json_set(detail_json,'$.nameCn','bad')")
    expect(() => auditWeaponCatalog(options)).toThrow(/Existing data changed/)
  })
})
