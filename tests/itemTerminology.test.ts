import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { ItemCatalogRepository } from '../api/catalog/repository'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'
import { catalogIdentityRows } from '../api/terminology/catalogIdentity.mjs'
import { itemTermFiltersSchema } from '../api/catalog/schemas'
// @ts-expect-error Shared ESM builder.
import { createItemDictionary } from '../tools/terminology/itemDictionary.mjs'
// @ts-expect-error Shared ESM migration.
import { repairItemJapanese } from '../tools/build_item_terminology.mjs'
// @ts-expect-error Synthetic source fixture.
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
// @ts-expect-error Shared ESM builder.
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
// @ts-expect-error Shared ESM source hash.
import { sha256 } from '../tools/mhp2g/sources.mjs'

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()))
const term = { id: 'synthetic-item-a', kind: 'item', ja: 'テスト甲', zhHans: '示例定名甲', zhHant: '示例定名甲繁', en: 'Synthetic A', chineseSource: 'gu_official' }
function fixture(terms = [term]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'term-test-'))
  cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  const source = path.join(dir, 'source.sqlite'), output = path.join(dir, 'output')
  createP2gSource(source); buildCatalog({ source, output, expectedSha256: sha256(source) })
  const p2g = new Database(path.join(output, 'mhp2g.sqlite')), legacy = new Database(':memory:'), dictionary = new Database(':memory:')
  cleanup.push(() => p2g.close(), () => legacy.close(), () => dictionary.close())
  p2g.exec("UPDATE catalog_items SET name_cn='示例舊譯甲',name_jp='テスト甲',icon_path='catalog/icons/example.png' WHERE item_id=1")
  legacy.exec(`CREATE TABLE catalog_items(game_id TEXT,save_id INTEGER,dex_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,is_placeholder INTEGER,rarity INTEGER,max_stack INTEGER,hex_id TEXT,icon_path TEXT);
    INSERT INTO catalog_items VALUES('mh4g',900,50,'示例旧译甲','Synthetic Old A','テスト甲',0,2,10,'0384','catalog/icons/legacy.png');`)
  const report = createItemDictionary(dictionary, terms, [
    { gameId: 'mhp2g', rows: catalogIdentityRows(p2g, 'mhp2g') },
    { gameId: 'mh4g', rows: catalogIdentityRows(legacy, 'mh4g'), dexAliases: new Map([[50, ['测试别名']]]) },
  ])
  const translator = new ItemTermRepository(dictionary)
  return { p2g, legacy, dictionary, translator, report, repo: new P2gItemCatalogRepository(p2g, translator), oldRepo: new ItemCatalogRepository(legacy, translator) }
}
describe('independent item translation dictionary', () => {
  it('finds canonical, old Chinese, Japanese and partial aliases by the current game identity', () => {
    const { repo, oldRepo } = fixture()
    for (const query of ['示例定名甲', '示例旧译甲', '示例舊譯甲', 'テスト甲', '旧译', '测试别名']) {
      expect(repo.searchItems({ gameId: 'mhp2g', query }).items).toEqual([expect.objectContaining({ gameId: 'mhp2g', itemId: 1, nameCn: '示例定名甲', iconPath: 'catalog/icons/example.png' })])
      expect(oldRepo.searchItems({ gameId: 'mh4g', query }).items).toEqual([expect.objectContaining({ gameId: 'mh4g', saveId: 900, nameCn: '示例定名甲' })])
    }
    const result = repo.searchItems({ gameId: 'mhp2g', query: '示例旧译甲' }).items[0]
    expect(result.terminology).toMatchObject({ originalName: '示例舊譯甲', matchedAlias: '示例旧译甲', source: 'GU 官方简中' })
    expect(repo.searchItems({ gameId: 'mhp2g', query: '示例定名甲' }).items[0].terminology?.matchedAlias).toBeUndefined()
    expect(repo.searchItems({ gameId: 'mhp2g', query: '900' }).total).toBe(0)
    expect(oldRepo.searchItems({ gameId: 'mh4g', query: '0x0384' }).total).toBe(1)
  })
  it('keeps filters/pagination and presents the same names on related item endpoints without changing evidence', () => {
    const { repo, p2g } = fixture()
    expect(repo.searchItems({ gameId: 'mhp2g', query: '示例旧译甲', sourceKinds: ['shop'] }).total).toBe(0)
    const pages = [1, 2, 3].flatMap(page => repo.searchItems({ gameId: 'mhp2g', page, pageSize: 1, sort: 'name' }).items)
    expect(new Set(pages.map(item => item.gameId === 'mhp2g' && item.itemId)).size).toBe(3)
    expect(repo.getItem({ gameId: 'mhp2g', itemId: 1 })).toMatchObject({ nameCn: '示例定名甲', nameJp: 'テスト甲', description: '第一行\n第二行' })
    const material = repo.getItem({ gameId: 'mhp2g', itemId: 2 })!
    expect(material.relations.find(r => r.sourceKind === 'combination')).toMatchObject({ targetName: '可调合：示例定名甲', relatedItems: [expect.objectContaining({ itemId: 1, nameCn: '示例定名甲' })] })
    expect(p2g.prepare('SELECT name_cn FROM catalog_items WHERE item_id=1').get()).toEqual({ name_cn: '示例舊譯甲' })
  })
  it('leaves missing, unconfirmed and ambiguous Japanese identities separate, including different kinds', () => {
    const { repo, translator, report } = fixture([term, { ...term, id: 'duplicate', zhHans: '另一个同名对象' }, { ...term, id: 'weapon', kind: 'weapon' }])
    expect(repo.getItem({ gameId: 'mhp2g', itemId: 1 })?.nameCn).toBe('示例舊譯甲')
    expect(repo.searchItems({ gameId: 'mhp2g', query: '另一个同名对象' }).total).toBe(0)
    expect(report.stats.mhp2g.ambiguous).toBe(1)
    expect(repo.getItem({ gameId: 'mhp2g', itemId: 2 })?.terminology?.status).toBe('missing-japanese')
    expect(translator.search({ query: '示例', gameId: 'mhp2g' }).items).toHaveLength(1)
  })
  it('rejects an unverified preferred translation and stale catalog bindings', () => {
    expect(() => fixture([{ ...term, chineseSource: 'unknown' }])).toThrow(/Unverified/)
    const { p2g, translator } = fixture()
    p2g.exec("UPDATE catalog_items SET name_cn='changed' WHERE item_id=1")
    expect(() => new P2gItemCatalogRepository(p2g, translator)).toThrow(/不匹配/)
  })
  it('matches Latin width variants without merging levels, circled numbers or ambiguous names', () => {
    const build = (ja: string, matches: string[]) => {
      const db = new Database(':memory:'); cleanup.push(() => db.close())
      const report = createItemDictionary(db, matches.map((value, index) => ({ ...term, id: `synthetic-${index}`, ja: value })), [
        { gameId: 'mhp2g', rows: [{ id: 1, dex_id: null, name_cn: '测试原名', name_jp: ja, name_en: '', is_placeholder: 0 }] },
      ])
      return report.stats.mhp2g
    }
    expect(build('テストG', ['テストＧ']).matched).toBe(1)
    expect(build('テストＧ', ['テストG']).matched).toBe(1)
    expect(build('テストG', ['テストG', 'テストＧ']).ambiguous).toBe(1)
    expect(build('テスト弾', ['LV1 テスト弾', 'LV2 テスト弾']).absentFromGu).toBe(1)
    expect(build('テスト①', ['テスト1']).absentFromGu).toBe(1)
  })
  it('returns source-labelled dictionary entries and literal, bounded searches', () => {
    const { translator } = fixture()
    const result = translator.search({ query: '旧译', pageSize: 1, gameId: 'mhp2g' })
    expect(result).toMatchObject({ available: true, total: 1, hasNext: false })
    expect(result.items[0].members.map(member => member.gameId)).toEqual(['mh4g', 'mhp2g'])
    expect(result.items[0].aliases).toContainEqual({ gameId: 'mh4g', name: '测试别名', source: 'Dex 译名' })
    expect(translator.search({ query: '%' }).total).toBe(0)
    for (const payload of [{ gameId: 'bad' }, { page: 0 }, { pageSize: 101 }, { query: 'a'.repeat(121) }, { file: '/tmp/file' }]) expect(itemTermFiltersSchema.safeParse(payload).success).toBe(false)
  })
})
describe('Dex Japanese column repair', () => {
  it('uses column 3, keeps identity/data intact and is idempotent', () => {
    const db = new Database(':memory:'); cleanup.push(() => db.close())
    db.exec("CREATE TABLE catalog_items(save_id INTEGER,dex_id INTEGER,name_jp TEXT,icon_path TEXT); INSERT INTO catalog_items VALUES(91,2,'測試繁體','keep.png')")
    const names = [{ Itm_ID: '2', Itm_Name_2: '測試繁體', Itm_Name_3: 'テスト日文' }]
    expect(repairItemJapanese(db, names)).toBe(1)
    expect(db.prepare('SELECT * FROM catalog_items').get()).toEqual({ save_id: 91, dex_id: 2, name_jp: 'テスト日文', icon_path: 'keep.png' })
    expect(repairItemJapanese(db, names)).toBe(0)
    db.exec("UPDATE catalog_items SET name_jp='unexpected'")
    expect(() => repairItemJapanese(db, names)).toThrow(/Unexpected/)
    expect(() => repairItemJapanese(db, [{ Itm_ID: '2' }])).toThrow(/Itm_Name_3/)
  })
})
