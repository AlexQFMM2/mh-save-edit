import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { p3ItemFixture } from './fixtures/p3ItemCatalog'
import { P3ItemCatalogRepository } from '../api/catalog/p3ItemRepository'
import { P3DecorationCatalogRepository } from '../api/catalog/p3DecorationRepository'
import { decorationCatalogFiltersSchema, decorationIdentitySchema, skillCatalogFiltersSchema } from '../api/catalog/schemas'

let db: ReturnType<typeof p3ItemFixture>, items: P3ItemCatalogRepository, repo: P3DecorationCatalogRepository
beforeEach(() => {
  db = p3ItemFixture()
  db.prepare('UPDATE catalog_items SET aliases_json=? WHERE item_id=10').run(JSON.stringify(['旧材料名']))
  items = new P3ItemCatalogRepository(db); repo = new P3DecorationCatalogRepository(db, items)
})
afterEach(() => db.close())

describe('P3 decoration projection', () => {
  it('shares reviewed item names, IDs, signed points, icon and all alternative recipes', () => {
    const result = repo.searchDecorations({ gameId: 'mhp3' })
    expect(result.items.map(row => row.itemId)).toEqual([825, 826])
    for (const row of result.items) {
      const item = items.getItem({ gameId: 'mhp3', itemId: row.itemId! })!
      const decoration = repo.getDecoration({ gameId: 'mhp3', itemId: row.itemId! })!
      expect(decoration).toMatchObject({ nameCn: item.nameCn, nameJp: item.nameJp, iconPath: item.iconPath,
        slots: item.p3.decoration!.slots, itemSaveId: null, price: null, p3: { sellPrice: item.sellPrice } })
      expect(decoration).not.toHaveProperty('saveId')
      expect(decoration.skills.map(skill => [skill.skillId, skill.points])).toEqual(item.p3.decoration!.skills.map(skill => [skill.id, skill.points]))
      expect(decoration.materials.map(m => [m.recipeIndex, m.itemId, m.quantity])).toEqual(item.p3.recipes.flatMap((r, i) => r.materials.map(m => [i + 1, m.itemId, m.quantity])))
    }
    expect(result.items[0].nameCn).toBe(result.items[1].nameCn)
    expect(repo.getDecoration({ gameId: 'mhp3', itemId: 10 })).toBeNull()
  })

  it('searches Japanese, aliases, native numbers, bilingual skills and material aliases with reasons', () => {
    for (const query of ['テスト珠甲', '审定旧称', '825', '0x339'])
      expect(repo.searchDecorations({ gameId: 'mhp3', query }).items.map(row => row.itemId)).toEqual([825])
    expect(repo.searchDecorations({ gameId: 'mhp3', query: 'Negative' }).items[0]).toMatchObject({ itemId: 825, matchReason: '命中：技能·负向技能' })
    expect(repo.searchDecorations({ gameId: 'mhp3', query: '旧材料名' }).items.map(row => row.matchReason)).toEqual(['命中：制作材料·测试材料', '命中：制作材料·测试材料'])
    expect(repo.searchDecorations({ gameId: 'mhp3', query: '%' }).total).toBe(0)
  })

  it('filters signed skills and slots, sorts by points, paginates and locates exact targets', () => {
    expect(repo.searchDecorations({ gameId: 'mhp3', skillId: 1, sort: 'skillPoints' }).items.map(row => row.itemId)).toEqual([826, 825])
    expect(repo.searchDecorations({ gameId: 'mhp3', skillId: 2 }).items.map(row => row.itemId)).toEqual([825])
    expect(repo.searchDecorations({ gameId: 'mhp3', slots: 2 }).total).toBe(0)
    expect(repo.searchDecorations({ gameId: 'mhp3', page: 2, pageSize: 1 }).items[0].itemId).toBe(826)
    expect(repo.searchDecorations({ gameId: 'mhp3', targetItemId: 826, query: '无结果', slots: 3 }).items[0].itemId).toBe(826)
    expect(repo.getDecorationFacets()).toMatchObject({ slots: [1], skills: expect.arrayContaining([expect.objectContaining({ skillId: 2, nameJp: 'テスト負', nameEn: 'Negative' })]) })
  })

  it('rejects cross-game/save identities while allowing the independent skill service', () => {
    for (const identity of [{ gameId: 'mhp3', saveId: 825 }, { gameId: 'mhp3', itemId: 825, saveId: 825 }, { gameId: 'mhp3', itemId: 979 }, { gameId: 'mhgu', itemId: 825 }])
      expect(decorationIdentitySchema.safeParse(identity).success).toBe(false)
    expect(() => repo.searchDecorations({ gameId: 'mhp2g' })).toThrow(/身份/)
    expect(decorationCatalogFiltersSchema.safeParse({ gameId: 'mhp3', targetSaveId: 825 }).success).toBe(false)
    expect(decorationCatalogFiltersSchema.safeParse({ gameId: 'mhp3', targetItemId: 979 }).success).toBe(false)
    expect(skillCatalogFiltersSchema.safeParse({ gameId: 'mhp3' }).success).toBe(true)
  })
})
