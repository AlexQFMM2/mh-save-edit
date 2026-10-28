import { hasP3Weapons, P3WeaponCatalogRepository } from './p3WeaponRepository'
import { hasP3Armors, P3ArmorCatalogRepository } from './p3ArmorRepository'
import type Database from 'better-sqlite3'
import type { ItemTermRepository } from '../terminology/itemTermRepository'
import { normalizeTerm } from '../terminology/catalogIdentity.mjs'
import { itemCatalogFiltersSchema, itemIdentitySchema } from './schemas'
import type { ItemCatalogFacets, ItemCatalogFilters, ItemRelation, P3ItemDetail, P3ItemSummary, PageResult } from './types'
import type { P3ItemDecoration, P3ItemIdentity, P3ItemLink, P3ItemRecipe } from './p3ItemTypes'

type Row = Record<string, any>
type Combination = { recipe_index: number; first_id: number; other_id: number; output_id: number; chance: number; minimum: number; maximum: number }

/** P3 item IDs belong only to this read-only catalog; no save codec is involved. */
export class P3ItemCatalogRepository {
  private readonly items = new Map<number, Row>()
  private readonly combinations: Combination[]
  private readonly recipes: P3ItemRecipe[]
  private readonly shops: Row[]
  private readonly weapons?: P3WeaponCatalogRepository
  private readonly armors?: P3ArmorCatalogRepository

  constructor(private readonly db: Database.Database, private readonly terminology?: ItemTermRepository) {
    const meta = db.prepare("SELECT value FROM meta WHERE key='catalog_schema'").get() as Row | undefined
    if (meta?.value !== 'mhp3-items-v1') throw new Error('P3 道具资料库版本不匹配，请重新构建本地资料。')
    for (const row of db.prepare('SELECT * FROM catalog_items JOIN catalog_item_localization USING(item_id) ORDER BY item_id').all() as Row[]) {
      this.items.set(row.item_id, { ...row, aliases: JSON.parse(row.aliases_json), decoration: row.decoration_json ? JSON.parse(row.decoration_json) : null })
    }
    this.combinations = db.prepare('SELECT * FROM p3_combinations ORDER BY display_order').all() as Combination[]
    this.recipes = (db.prepare('SELECT * FROM p3_forge_recipes ORDER BY recipe_index').all() as Row[]).map(row => ({
      index: row.recipe_index, output: this.link(row.output_id),
      materials: (db.prepare('SELECT * FROM p3_forge_materials WHERE recipe_index=? ORDER BY position').all(row.recipe_index) as Row[]).map(material => ({ ...this.link(material.item_id), quantity: material.quantity })),
    }))
    this.shops = db.prepare('SELECT * FROM p3_shops ORDER BY list_key,item_id').all() as Row[]
    this.weapons = hasP3Weapons(db) ? new P3WeaponCatalogRepository(db) : undefined
    this.armors = hasP3Armors(db) ? new P3ArmorCatalogRepository(db) : undefined
    terminology?.bindCatalog(db, 'mhp3')
  }

  private link(id: number): P3ItemLink {
    const row = this.items.get(id)
    if (!row) throw new Error(`P3 关联道具缺失：${id}`)
    return { gameId: 'mhp3', itemId: id, nameCn: row.name_cn, nameEn: '', nameJp: row.name_jp, ...(row.decoration ? { p3Decoration: row.decoration as P3ItemDecoration } : {}) }
  }
  private summary(row: Row): P3ItemSummary {
    return { gameId: 'mhp3', itemId: row.item_id, dexId: null, nameCn: row.name_cn, nameEn: '', nameJp: row.name_jp,
      rarity: row.rarity, maxStack: row.max_stack, iconPath: row.icon_path, isPlaceholder: Boolean(row.is_placeholder),
      p3: { category: row.category, quantityKind: row.quantity_kind, decoration: row.decoration } }
  }
  searchItems(request: ItemCatalogFilters): PageResult<P3ItemSummary> {
    const filters = itemCatalogFiltersSchema.parse(request)
    if (filters.gameId !== 'mhp3') throw new Error('P3 道具身份与游戏不匹配')
    const query = normalizeTerm(filters.query), aliases = this.terminology?.matchItems('mhp3', query) ?? new Map<number, string>()
    const direct = new Set<number>(), reasons = new Map<number, string>()
    if (query) {
      for (const row of this.items.values()) {
        if (String(row.item_id) === query || [row.name_cn, row.name_jp, ...row.aliases].some(name => normalizeTerm(name).includes(query)) || aliases.has(row.item_id)) direct.add(row.item_id)
      }
      const reason = (id: number, text: string) => { if (!direct.has(id) && !reasons.has(id)) reasons.set(id, text) }
      for (const r of this.combinations) {
        for (const id of [r.first_id, r.other_id]) if (direct.has(id)) reason(r.output_id, `命中：调合材料·${this.link(id).nameCn}`)
        if (direct.has(r.output_id)) for (const id of [r.first_id, r.other_id]) reason(id, `命中：调合产物·${this.link(r.output_id).nameCn}`)
      }
      for (const recipe of this.recipes) {
        for (const m of recipe.materials) {
          if (direct.has(m.itemId)) reason(recipe.output.itemId, `命中：制作材料·${m.nameCn}`)
          if (direct.has(recipe.output.itemId)) reason(m.itemId, `命中：装饰品用途·${recipe.output.nameCn}`)
        }
      }
    }
    for (const [id, reason] of this.armors?.getMaterialItemMatches(filters.query) ?? []) if (!direct.has(id)) reasons.set(id, reason)
    for (const [id, reason] of this.weapons?.getMaterialItemMatches(filters.query) ?? []) if (!direct.has(id)) reasons.set(id, reason)
    const hasSource = (id: number, kind: string) => kind === 'combination' ? this.combinations.some(r => r.output_id === id)
      : kind === 'shop' ? this.shops.some(r => r.item_id === id) : false
    const hasUsage = (id: number, kind: string) => kind === 'combination' ? this.combinations.some(r => r.first_id === id || r.other_id === id)
      : kind === 'decoration' ? this.recipes.some(r => r.materials.some(m => m.itemId === id)) : kind === 'weapon' ? Boolean(this.weapons?.getItemWeaponRecipes(id).length || this.weapons?.getItemWeaponUsages(id).length) : kind === 'armor' ? Boolean(this.armors?.getItemArmorUsages(id).length) : false
    const rows = [...this.items.values()].filter(row =>
      (filters.includePlaceholders || !row.is_placeholder) && (filters.targetItemId == null || filters.targetItemId === row.item_id)
      && (!query || direct.has(row.item_id) || reasons.has(row.item_id))
      && (filters.rarity == null || row.rarity === filters.rarity) && (filters.maxStack == null || row.max_stack === filters.maxStack)
      && (!filters.category || filters.category === row.category) && (!filters.quantityKind || filters.quantityKind === row.quantity_kind)
      && (!filters.sourceKinds?.length || filters.sourceKinds.some(kind => hasSource(row.item_id, kind)))
      && (!filters.usageKinds?.length || filters.usageKinds.some(kind => hasUsage(row.item_id, kind))))
    rows.sort((a,b) => (filters.sort === 'name' ? a.name_cn.localeCompare(b.name_cn, 'zh-Hans') : filters.sort === 'rarity' ? (a.rarity ?? 99)-(b.rarity ?? 99) : 0) || a.item_id-b.item_id)
    const page = filters.page ?? 1, pageSize = filters.pageSize ?? 100, total = rows.length
    return { total, page, pageSize, hasNext: page*pageSize < total, items: rows.slice((page-1)*pageSize, page*pageSize).map(row => ({
      ...(this.terminology?.project(this.summary(row), query, aliases.get(row.item_id)) ?? this.summary(row)),
      ...(reasons.has(row.item_id) ? { matchReason: reasons.get(row.item_id) } : {}),
    })) }
  }
  getItem(request: P3ItemIdentity): P3ItemDetail | null {
    const identity = itemIdentitySchema.parse(request)
    if (identity.gameId !== 'mhp3') throw new Error('P3 道具身份与游戏不匹配')
    const row = this.items.get(identity.itemId)
    if (!row) return null
    const relations: ItemRelation[] = []
    const add = (value: Omit<ItemRelation, 'id' | 'targetId' | 'quantity' | 'probability' | 'rank'>) => relations.push({ id: relations.length+1, targetId: null, quantity: null, probability: null, rank: null, ...value })
    for (const r of this.combinations) {
      const metadata = { '基础成功率': `${r.chance}%`, '产量': r.minimum === r.maximum ? String(r.minimum) : `${r.minimum}～${r.maximum}`, '说明': '未计入调和书、技能等加成；特殊出现条件尚未收录' }
      if (r.output_id === identity.itemId) add({ sourceKind: 'combination', usageKind: null, targetName: '调合制作', metadata, relatedItems: [this.link(r.first_id), this.link(r.other_id)] })
      if ([r.first_id,r.other_id].includes(identity.itemId)) add({ sourceKind: 'combination', usageKind: 'combination', targetName: '可调合产物', metadata, relatedItems: [this.link(r.output_id)] })
    }
    for (const s of this.shops.filter(s => s.item_id === identity.itemId)) {
      add({ sourceKind: 'shop', usageKind: null, targetName: s.label, metadata: { '售价': `${s.price} z`, '价格类型': s.half_price ? '半价' : '普通价格', ...(s.rotation ? { '轮换': s.rotation === 5 ? '特别货品（启用条件尚未收录）' : `货品组 ${s.rotation}` } : {}), '解锁条件': '尚未收录；列入商店不表示当前必定可购买' }, relatedItems: [] })
    }
    for (const recipe of this.recipes) {
      const material = recipe.materials.find(m => m.itemId === identity.itemId)
      if (material) add({ sourceKind: 'decoration', usageKind: 'decoration', targetName: `制作路线 ${recipe.index+1}`, metadata: { '材料数量': String(material.quantity) }, relatedItems: [recipe.output] })
    }
    return { ...this.summary(row), nameJp: row.name_jp, description: row.description, buyPrice: null, sellPrice: row.sell_price,
      hexId: null, mappingStatus: row.mapping_status, relations,
      localization: { nameSource: row.name_source, namePending: false, descriptionSource: row.description_source, descriptionPending: false, descriptionJp: row.description_jp },
      p3: { ...this.summary(row).p3, weaponRecipes: this.weapons?.getItemWeaponRecipes(identity.itemId), weaponUsages: this.weapons?.getItemWeaponUsages(identity.itemId), armorRecipes: this.armors?.getItemArmorUsages(identity.itemId), recipes: this.recipes.filter(r => r.output.itemId === identity.itemId),
        coverage: { combination: 'complete', decoration: 'complete', shop: 'partial', monster: 'not-collected', location: 'not-collected', quest: 'not-collected', exchange: 'not-collected', weapon: this.weapons ? 'complete' : 'not-collected', armor: this.armors ? 'complete' : 'not-collected', 'palico-weapon': 'not-collected', 'palico-armor': 'not-collected', kinsect: 'not-collected' } } }
  }
  getItemFacets(): ItemCatalogFacets {
    const rows = [...this.items.values()].filter(row => !row.is_placeholder)
    const numbers = (column: string) => [...new Set<number>(rows.map(r => r[column]).filter(v => v != null))].sort((a,b) => a-b)
    return { rarities: numbers('rarity'), maxStacks: numbers('max_stack'), categories: ['general','ammo','coating','decoration'], quantityKinds: ['count','infinite','reusable-cooldown','internal'],
      relations: [...(this.weapons ? [{sourceKind: 'weapon' as const, usageKind: 'weapon' as const}] : []), ...(this.armors ? [{sourceKind: 'armor' as const, usageKind: 'armor' as const}] : []), { sourceKind: 'combination', usageKind: null }, { sourceKind: 'shop', usageKind: null }, { sourceKind: 'combination', usageKind: 'combination' }, { sourceKind: 'decoration', usageKind: 'decoration' }] }
  }
}
