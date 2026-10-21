import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Synthetic fixture.
import { createDecorationFixture } from './fixtures/p2gDecorationCatalog.mjs'
// @ts-expect-error ESM builder.
import { buildDecorationCatalog } from '../tools/build_mhp2g_decoration_catalog.mjs'
// @ts-expect-error ESM review applier.
import { applyDecorationNameReview } from '../tools/mhp2g/decorationNameReview.mjs'
// @ts-expect-error ESM dictionary builder.
import { createItemDictionary } from '../tools/terminology/itemDictionary.mjs'
import { catalogIdentityRows } from '../api/terminology/catalogIdentity.mjs'
import { P2gDecorationCatalogRepository } from '../api/catalog/p2gDecorationRepository'
import { P2gSkillCatalogRepository } from '../api/catalog/p2gSkillRepository'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()))
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2g-names-'))
  cleanup.push(() => fs.rmSync(dir, { recursive: true, force: true }))
  const f = createDecorationFixture(dir); buildDecorationCatalog(f)
  const db = new Database(path.join(f.output, 'mhp2g.sqlite'))
  cleanup.push(() => db.close())
  db.exec('CREATE TABLE catalog_item_localization(item_id INTEGER PRIMARY KEY,original_name TEXT,name_source TEXT,name_status TEXT)')
  const entries = (db.prepare("SELECT detail_json FROM p2g_skill_equipment WHERE kind='decoration'").all() as { detail_json: string }[]).map(row => {
    const e = JSON.parse(row.detail_json)
    db.prepare('INSERT INTO catalog_item_localization VALUES(?,?,?,?)').run(e.itemId, `历史译名${e.itemId}`, 'synthetic', 'reviewed')
    return { itemId: e.itemId, equipmentKey: e.equipmentKey, japanese: e.nameJp, previousChinese: e.nameCn, chinese: `新名珠【${e.slots}】`, slots: e.slots, skills: e.skills, basis: 'Synthetic reviewed naming', decision: 'matched' }
  })
  return { db, review: { schema: 'mhp2g-decoration-name-review-v1', entries } }
}
describe('identity-bound decoration naming', () => {
  it('updates every endpoint, preserves signed points/recipes, and finds old aliases in decoration, skill and item searches', () => {
    const { db, review } = fixture()
    const oldEquipment = new P2gSkillCatalogRepository(db).getEquipment('item:1')!
    const oldStored = JSON.parse((db.prepare("SELECT detail_json FROM p2g_skill_equipment WHERE equipment_key='item:1'").get() as { detail_json: string }).detail_json)
    const oldOriginal = db.prepare('SELECT * FROM catalog_item_localization WHERE item_id=1').get() as { original_name: string }
    expect(applyDecorationNameReview(db, review)).toMatchObject({ reviewed: 2, changed: 2, searchRows: 3, materialLabels: 3 })
    const skill = new P2gSkillCatalogRepository(db), equipment = skill.getEquipment('item:1')!
    expect(equipment).toMatchObject({ nameCn: '新名珠【1】', nameJp: oldEquipment.nameJp, slots: oldEquipment.slots, skills: oldEquipment.skills, nameAliases: ['测试珠', oldOriginal.original_name] })
    const stored = JSON.parse((db.prepare("SELECT detail_json FROM p2g_skill_equipment WHERE equipment_key='item:1'").get() as { detail_json: string }).detail_json)
    expect(stored.recipes).toEqual(oldStored.recipes)
    expect(equipment.recipes[1].materials[0].item.nameCn).toBe('新名珠【1】')
    const decorations = new P2gDecorationCatalogRepository(db)
    for (const query of ['测试珠', oldOriginal.original_name]) expect(decorations.searchDecorations({ gameId: 'mhp2g', query })).toMatchObject({ total: 1, items: [{ itemId: 1, nameCn: '新名珠【1】', matchReason: `命中：装饰品旧名·${query}` }] })
    expect(skill.searchSkills({ gameId: 'mhp2g', query: '测试珠' }).items.map(s => s.match)).toEqual(['命中：相关装饰品·新名珠【1】', '命中：相关装饰品·新名珠【1】'])
    const links = db.prepare("SELECT target_name,pending_target FROM catalog_item_relations WHERE target_name='新名珠【1】'").all() as { pending_target: string }[]
    expect(links).toHaveLength(2)
    expect(links.map(r => JSON.parse(r.pending_target))).toEqual(Array(2).fill({ kind: 'decoration', name: '新名珠【1】' }))
    const dictionary = new Database(':memory:'); cleanup.push(() => dictionary.close())
    createItemDictionary(dictionary, [], [{ gameId: 'mhp2g', rows: catalogIdentityRows(db, 'mhp2g'), itemAliases: new Map([[1, equipment.nameAliases]]) }])
    const terms = new ItemTermRepository(dictionary); terms.bindCatalog(db, 'mhp2g')
    expect(terms.name('mhp2g', 1, 'fallback')).toBe('新名珠【1】')
    expect(terms.matchItems('mhp2g', '测试珠').get(1)).toBe('测试珠')
    expect(new P2gItemCatalogRepository(db, terms).searchItems({ gameId: 'mhp2g', query: '测试珠' }).items).toContainEqual(expect.objectContaining({ itemId: 2, matchReason: '命中：装饰品材料·新名珠【1】' }))
    expect((db.prepare('SELECT original_name FROM catalog_item_localization WHERE item_id=1').get() as { original_name: string }).original_name).toBe(oldOriginal.original_name)
  })
  it.each(['negative-points', 'slots', 'japanese', 'previous-name', 'missing', 'duplicate-name', 'duplicate-id', 'usage'])('rejects %s before making any changes', kind => {
    const { db, review } = fixture(), first = review.entries[0]
    if (kind === 'negative-points') first.skills[1].points = 1
    if (kind === 'slots') first.slots = 2
    if (kind === 'japanese') first.japanese = '別物'
    if (kind === 'previous-name') first.previousChinese = 'stale'
    if (kind === 'missing') review.entries.pop()
    if (kind === 'duplicate-name') review.entries[1].chinese = first.chinese
    if (kind === 'duplicate-id') review.entries.push(first)
    if (kind === 'usage') db.exec("UPDATE catalog_item_relations SET target_name='stale' WHERE usage_kind='decoration'")
    const before = db.serialize()
    expect(() => applyDecorationNameReview(db, review)).toThrow()
    expect(db.serialize()).toEqual(before)
  })
})
