import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createLocalization, translationSource } from '../tools/mhp2g/localization.mjs'
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
import { auditCatalog } from '../tools/audit_mhp2g_catalog.mjs'
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
import { sha256 } from '../tools/mhp2g/sources.mjs'
import { createItemDictionary } from '../tools/terminology/itemDictionary.mjs'
import { catalogIdentityRows } from '../api/terminology/catalogIdentity.mjs'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'

const dirs = [], cleanup = []
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); dirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })) })
const official = [{ id: 'test-item', kind: 'item', ja: 'テストＧ', zhHans: '测试定名G', chineseSource: 'gu_official' }]
function input() {
  return {
    tables: [
      { tableId: 1, rows: ['－－－','テストG','素材甲','素材乙'].map((text, index) => ({ index, text })) },
      { tableId: 2, rows: ['','固有説明~A01','説明甲','説明乙'].map((text, index) => ({ index, text })) },
      { tableId: 3, rows: [{ index: 1, text: 'テスト武器' }] },
    ],
    bindings: Object.fromEntries([...[0,1,2,3].map(id => [`item:${id}`, { kind: 'item', name: `1:${id}`, description: `2:${id}` }]), ['weapon:1', { kind: 'weapon', name: '3:1' }]]),
    official,
  }
}
function fixture(reviews = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2g-localization-')); dirs.push(dir)
  const source = path.join(dir,'source.sqlite'); createP2gSource(source)
  const expectedSha256 = sha256(source), localization = path.join(dir,'localization.json'), output = path.join(dir,'output')
  fs.writeFileSync(localization, JSON.stringify(createLocalization({ ...input(), reviews })))
  fs.writeFileSync(path.join(dir,'manifest.json'), JSON.stringify({ sourceSha256: expectedSha256, outputs: { 'localization.json': sha256(localization) } }))
  return { dir, source, expectedSha256, localization, output }
}
describe('original-Japanese P2G catalog localization', () => {
  it('reuses consistent GU decoration wording without merging slot variants or normal items', () => {
    const variants = [1,2].map(n => ({ id:`test-jewel-${n}`,kind:'item',ja:`試験珠【${n}】`,zhHans:`测试珠【${n}】`,chineseSource:'gu_official' }))
    const build = (terms = variants, naming = 'native-decoration') => createLocalization({
      tables:[{tableId:1,rows:[{index:1,text:'試験珠'}]}],
      bindings:{'item:1':{kind:'item',name:'1:1',naming}},official:terms,
    })
    const result = build(), unit = result.units['1:1']
    expect(unit).toMatchObject({ chinese:'测试珠',status:'official',nameMatch:'decoration-without-slots',officialTermIds:['test-jewel-1','test-jewel-2'] })
    expect(translationSource(unit)).toBe('GU 官方用词（省略孔位后缀）')
    expect(Object.keys(result.bindings)).toEqual(['item:1'])
    expect(build(variants, 'ordinary-item').units['1:1'].status).toBe('pending')
    expect(build([variants[0],{...variants[1],zhHans:'其他珠【2】'}]).units['1:1'].status).toBe('pending')
    expect(build([variants[0],{...variants[1],zhHans:'测试珠【1】'}]).units['1:1'].status).toBe('pending')
    expect(build(variants.map(term => ({...term,kind:'weapon'}))).units['1:1'].status).toBe('pending')
  })
  it('uses official names by kind, preserves native identities and leaves own descriptions pending', () => {
    const result = createLocalization(input())
    expect(result.units['1:1']).toMatchObject({ japanese: 'テストG', chinese: '测试定名G', status: 'official' })
    expect(result.units['2:1']).toMatchObject({ japanese: '固有説明~A01', chinese: null, status: 'pending' })
    expect(result.bindings['item:1']).toEqual({ kind: 'item', name: '1:1', description: '2:1' })
    const ambiguous = createLocalization({ ...input(), official: [...official, { ...official[0], id: 'different', zhHans: '不同含义' }] })
    expect(ambiguous.units['1:1'].status).toBe('pending')
    expect(createLocalization({ ...input(), official: [{ ...official[0], kind: 'weapon' }] }).units['1:1'].chinese).toBeNull()
  })
  it('rejects stale reviews, changed control codes, guessed pointers and contradicted official names', () => {
    const review = { key: '2:1', japanese: '固有説明~A01', chinese: '测试说明~A01', basis: 'Synthetic review' }
    expect(createLocalization({ ...input(), reviews: [review] }).units['2:1'].status).toBe('reviewed')
    expect(() => createLocalization({ ...input(), reviews: [{ ...review, japanese: 'stale' }] })).toThrow(/Stale/)
    expect(() => createLocalization({ ...input(), reviews: [{ ...review, chinese: 'missing code' }] })).toThrow(/control codes/)
    expect(() => createLocalization({ ...input(), reviews: [{ key:'1:1', japanese:'テストG', chinese:'冲突', basis:'review' }] })).toThrow(/contradicts/)
    expect(() => createLocalization({ ...input(), bindings: { bad: { kind:'item', name:'1:999' } } })).toThrow(/Missing/)
    expect(() => createLocalization({ ...input(), official: [{ ...official[0], chineseSource:'unknown' }] })).toThrow(/Unverified/)
  })
  it('installs translated catalog values and original descriptions even without the optional dictionary', () => {
    const f = fixture(); buildCatalog(f)
    expect(auditCatalog({ ...f, delivery:f.output }).status).toBe('passed')
    const db = new Database(path.join(f.output,'mhp2g.sqlite')); cleanup.push(() => db.close())
    const repo = new P2gItemCatalogRepository(db)
    expect(repo.getItem({ gameId:'mhp2g', itemId:1 })).toMatchObject({ nameCn:'测试定名G', nameJp:'テストG', description:'固有説明~A01', localization:{ descriptionPending:true } })
    expect(repo.searchItems({ gameId:'mhp2g', query:'测试成品' }).items[0]).toMatchObject({ itemId:1, nameCn:'测试定名G' })
    expect(repo.getItem({ gameId:'mhp2g', itemId:2 }).relations.find(r => r.sourceKind === 'weapon').targetName).toBe('テスト武器')
    const item = db.prepare('SELECT * FROM catalog_items WHERE item_id=1').get()
    expect(item).toMatchObject({ save_id:null,dex_id:null,max_stack:10,buy_price:100,sell_price:10 })
    expect(sha256(f.source)).toBe(f.expectedSha256)
  })
  it('keeps translated descriptions, source tokens and original Japanese independently available', () => {
    const f = fixture([{ key:'2:1',japanese:'固有説明~A01',chinese:'测试译文~A01',basis:'Synthetic contextual review' }]); buildCatalog(f)
    expect(auditCatalog({ ...f,delivery:f.output }).status).toBe('passed')
    const db = new Database(path.join(f.output,'mhp2g.sqlite')); cleanup.push(() => db.close())
    const detail = new P2gItemCatalogRepository(db).getItem({gameId:'mhp2g',itemId:1})
    expect(detail).toMatchObject({description:'测试译文~A01',localization:{descriptionPending:false,descriptionJp:'固有説明~A01',descriptionSource:'项目译文（待验收）'}})
    expect(db.prepare('SELECT description FROM catalog_items WHERE item_id=1').get().description).toBe('测试译文~A01')
  })
  it('keeps old names as search aliases without falling back to them or requiring a shared identity', () => {
    const f = fixture(); buildCatalog(f)
    const db = new Database(path.join(f.output,'mhp2g.sqlite')), dict = new Database(':memory:'); cleanup.push(() => db.close(), () => dict.close())
    createItemDictionary(dict, official, [{ gameId:'mhp2g', rows:catalogIdentityRows(db,'mhp2g') }])
    const translator = new ItemTermRepository(dict), repo = new P2gItemCatalogRepository(db, translator)
    expect(repo.searchItems({ gameId:'mhp2g', query:'测试材料甲' }).items[0]).toMatchObject({ itemId:2, nameCn:'素材甲', terminology:{ status:'translation-pending' } })
    expect(translator.search({ query:'测试材料甲' }).items[0]).toMatchObject({ name:'素材甲', source:'日版原文（中文待审校）' })
    db.exec("UPDATE catalog_item_localization SET original_name='changed' WHERE item_id=2")
    expect(() => translator.bindCatalog(db,'mhp2g')).toThrow(/不匹配/)
  })
  it('retains P2G identity and official-wording provenance in the dictionary', () => {
    const db = new Database(':memory:'); cleanup.push(() => db.close())
    createItemDictionary(db, [], [{gameId:'mhp2g',rows:[{id:23,dex_id:null,name_cn:'测试珠',name_en:'',name_jp:'試験珠',is_placeholder:0,original_name:'测试旧珠',name_source:'GU 官方用词（省略孔位后缀）',name_status:'official'}]}])
    const repo = new ItemTermRepository(db), term = repo.search({query:'测试旧珠'}).items[0]
    expect(term).toMatchObject({id:'local:mhp2g:item:23',name:'测试珠',source:'GU 官方用词（省略孔位后缀）',members:[{gameId:'mhp2g',itemId:23,status:'official-wording'}]})
  })
  it('rejects tampered localization and catalog translations without weakening numerical audits', () => {
    const f = fixture(); fs.appendFileSync(f.localization,' ')
    expect(() => buildCatalog(f)).toThrow(/fingerprint/)
    expect(fs.existsSync(f.output)).toBe(false)
    const g = fixture(); buildCatalog(g)
    const file = path.join(g.output,'mhp2g.sqlite'), db = new Database(file)
    db.exec("UPDATE catalog_items SET name_cn='旧错译' WHERE item_id=1"); db.close()
    const manifestFile = path.join(g.output,'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'))
    manifest.databaseSha256 = sha256(file); fs.writeFileSync(manifestFile,JSON.stringify(manifest))
    expect(() => auditCatalog({ ...g, delivery:g.output })).toThrow()
  })
})
