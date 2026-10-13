import type Database from 'better-sqlite3'
import type { P2gWeaponDetail, P2gWeaponFacets, P2gWeaponFilters, P2gWeaponIdentity, P2gWeaponLink, P2gWeaponMaterial, P2gWeaponPage, P2gWeaponRecipe, P2gWeaponSummary, P2gWeaponTree, P2gWeaponType } from './p2gWeaponTypes'
import { p2gSpecialSummary, p2gWeaponItemResolver } from './p2gWeaponPresentation'
import { normalizeCatalogSearch } from './questRepository'

type StoredWeapon = Omit<P2gWeaponDetail, 'recipes' | 'parents' | 'children'>
type Edge = { parent_weapon_key: string; child_weapon_key: string; branch_order: number }
const normalize = normalizeCatalogSearch
const nativeOrder = (a: P2gWeaponSummary, b: P2gWeaponSummary) => a.nativeTable.localeCompare(b.nativeTable) || a.nativeIndex - b.nativeIndex
const link = (w: P2gWeaponSummary): P2gWeaponLink => ({ gameId: 'mhp2g', weaponKey: w.weaponKey, typeId: w.typeId, nameCn: w.nameCn, nameJp: w.nameJp, nameEn: w.nameEn })
function summary(w: StoredWeapon): P2gWeaponSummary {
  const { nameSource: _source, nativeRowSha256: _hash, raw: _raw, special: _special, ...value } = w
  return { ...value, specialSummary: p2gSpecialSummary(w.special) }
}

export function hasP2gWeapons(db: Database.Database): boolean {
  return (db.prepare("SELECT value FROM meta WHERE key='weapon_schema'").get() as { value: string } | undefined)?.value === 'mhp2g-weapons-v1'
}

/** Read-only native catalog. All graph decisions use the complete graph, including cycles. */
export class P2gWeaponCatalogRepository {
  private readonly presentSpecial: ReturnType<typeof p2gWeaponItemResolver>
  private weapons?: Map<string, StoredWeapon>
  private recipes?: Map<string, P2gWeaponRecipe>
  private edges?: Edge[]
  constructor(private readonly db: Database.Database) {
    this.presentSpecial = p2gWeaponItemResolver(db)
    if (!hasP2gWeapons(db)) throw new Error('P2G 武器资料尚未安装，请构建并安装武器资料库后重启应用；其他已安装图鉴仍可使用。')
  }

  private all(): Map<string, StoredWeapon> {
    if (!this.weapons) this.weapons = new Map((this.db.prepare('SELECT weapon_key,detail_json FROM p2g_weapons ORDER BY native_table,native_index').all() as { weapon_key: string; detail_json: string }[]).map(r => [r.weapon_key, JSON.parse(r.detail_json) as StoredWeapon]))
    return this.weapons
  }

  private graph(): Edge[] {
    return this.edges ??= this.db.prepare('SELECT * FROM p2g_weapon_edges ORDER BY parent_weapon_key,branch_order').all() as Edge[]
  }

  private allRecipes(): Map<string, P2gWeaponRecipe> {
    if (this.recipes) return this.recipes
    const materials = new Map<string, P2gWeaponMaterial[]>()
    for (const r of this.db.prepare(`SELECT m.*,i.name_cn,i.name_jp,i.name_en FROM p2g_weapon_materials m JOIN catalog_items i USING(item_id) ORDER BY recipe_key,position`).all() as { recipe_key: string; position: number; item_id: number; quantity: number; name_cn: string; name_jp: string; name_en: string }[]) {
      materials.set(r.recipe_key, [...(materials.get(r.recipe_key) ?? []), { gameId: 'mhp2g', itemId: r.item_id, quantity: r.quantity, position: r.position, nameCn: r.name_cn, nameJp: r.name_jp, nameEn: r.name_en }])
    }
    const outputs = new Map<string, P2gWeaponRecipe['outputs']>()
    for (const r of this.db.prepare('SELECT * FROM p2g_weapon_outputs ORDER BY recipe_key,position').all() as { recipe_key: string; weapon_key: string; rng_min: number | null; rng_max: number | null }[]) {
      const weapon = this.all().get(r.weapon_key)
      if (!weapon) throw new Error(`武器配方端点缺失：${r.weapon_key}`)
      outputs.set(r.recipe_key, [...(outputs.get(r.recipe_key) ?? []), { ...link(weapon), rngModulo100Range: r.rng_min === null || r.rng_max === null ? null : [r.rng_min, r.rng_max] }])
    }
    this.recipes = new Map((this.db.prepare('SELECT * FROM p2g_weapon_recipes ORDER BY recipe_key').all() as { recipe_key: string; kind: P2gWeaponRecipe['kind']; cost: number }[]).map(r => [r.recipe_key, { recipeKey: r.recipe_key, kind: r.kind, cost: r.cost, materials: materials.get(r.recipe_key) ?? [], outputs: outputs.get(r.recipe_key) ?? [] }]))
    return this.recipes
  }

  searchWeapons(filters: P2gWeaponFilters): P2gWeaponPage {
    const query = normalize(filters.query ?? '')
    const numeric = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
    const materialHits = new Map<string, string>()
    if (query) for (const recipe of this.allRecipes().values()) {
      const material = recipe.materials.find(m => normalize(`${m.nameCn} ${m.nameJp} ${m.nameEn}`).includes(query))
      if (material) for (const output of recipe.outputs) if (!materialHits.has(output.weaponKey)) materialHits.set(output.weaponKey, `命中：${recipe.kind === 'upgrade' ? '强化' : recipe.kind === 'shard' ? '锈块鉴定' : '制作'}材料·${material.nameCn || material.nameJp}`)
    }
    let items = [...this.all().values()].filter(w => {
      if (filters.targetWeaponKey) return w.weaponKey === filters.targetWeaponKey
      return (filters.weaponTypeId == null || w.typeId === filters.weaponTypeId)
        && (filters.rarity == null || w.rarity === filters.rarity)
        && (filters.slots == null || w.slots === filters.slots)
        && (filters.directlyProducible == null || w.isDirectlyProducible === filters.directlyProducible)
        && (!filters.finalOnly || w.isFinalForm)
        && (filters.attributeId == null || (filters.attributeId === 'none' ? !w.attributes.length : w.attributes.some(a => a.attributeId === filters.attributeId)))
        && (!query || w.nativeIndex === numeric || normalize(`${w.nameCn} ${w.nameJp} ${w.nameEn} ${w.weaponKey}`).includes(query) || materialHits.has(w.weaponKey))
    }).map(w => ({ ...summary(w), ...(query && materialHits.has(w.weaponKey) && !normalize(`${w.nameCn} ${w.nameJp} ${w.nameEn}`).includes(query) && w.nativeIndex !== numeric && normalize(w.weaponKey) !== query ? { matchReason: materialHits.get(w.weaponKey) } : {}) }))
    const direction = filters.direction === 'desc' ? -1 : 1
    const sharpness = (w: P2gWeaponSummary) => {
      const segments = w.sharpness?.[filters.sharpnessStage === 'handicraft1' ? 'handicraft' : 'base']
      if (!segments) return -1
      const color = segments.reduce((last, length, index) => length > 0 ? index : last, -1)
      return color * 1000000 + (segments[color] ?? 0)
    }
    const value = (w: P2gWeaponSummary): number => filters.sort === 'rarity' ? w.rarity : filters.sort === 'attack' ? w.displayAttack : filters.sort === 'slots' ? w.slots : filters.sort === 'affinity' ? w.affinity : sharpness(w)
    items.sort((a, b) => {
      const primary = filters.sort === 'name' ? (a.nameCn || a.nameJp).localeCompare(b.nameCn || b.nameJp, 'zh-CN') : !filters.sort || filters.sort === 'nativeId' ? nativeOrder(a, b) : value(a) - value(b)
      return primary * direction || nativeOrder(a, b)
    })
    const total = items.length, page = Math.max(1, filters.page ?? 1), pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 100))
    items = items.slice((page - 1) * pageSize, page * pageSize)
    return { items, total, page, pageSize, hasNext: page * pageSize < total }
  }

  getWeapon(identity: P2gWeaponIdentity): P2gWeaponDetail | null {
    if (identity.gameId !== 'mhp2g') return null
    const w = this.all().get(identity.weaponKey)
    if (!w) return null
    const graph = this.graph()
    return { ...w, special: this.presentSpecial(w.special), recipes: [...this.allRecipes().values()].filter(r => r.outputs.some(o => o.weaponKey === w.weaponKey)), parents: graph.filter(e => e.child_weapon_key === w.weaponKey).map(e => link(this.all().get(e.parent_weapon_key)!)), children: graph.filter(e => e.parent_weapon_key === w.weaponKey).map(e => link(this.all().get(e.child_weapon_key)!)) }
  }

  getWeaponFacets(): P2gWeaponFacets {
    const weapons = [...this.all().values()]
    const numbers = (key: 'rarity' | 'slots') => [...new Set(weapons.map(w => w[key]))].sort((a, b) => a - b)
    const attributes = new Map(weapons.flatMap(w => w.attributes.map(({ value: _value, ...a }) => [a.attributeId, a] as const)))
    return { weaponTypes: (this.db.prepare('SELECT detail_json FROM p2g_weapon_types ORDER BY json_extract(detail_json,\'$.sortOrder\')').all() as { detail_json: string }[]).map(r => JSON.parse(r.detail_json) as P2gWeaponType), attributes: [...attributes.values()].sort((a, b) => a.attributeId - b.attributeId), rarities: numbers('rarity'), slots: numbers('slots'), sharpnessStages: ['base', 'handicraft1'] }
  }

  getWeaponTree(weaponTypeId: number): P2gWeaponTree {
    const own = new Set([...this.all().values()].filter(w => w.typeId === weaponTypeId).map(w => w.weaponKey))
    const edges = this.graph().filter(e => own.has(e.parent_weapon_key) || own.has(e.child_weapon_key))
    const keys = new Set([...own, ...edges.flatMap(e => [e.parent_weapon_key, e.child_weapon_key])])
    const sources = this.db.prepare("SELECT source_sha256,builder_sha256 FROM catalog_build_metadata WHERE domain IN ('weapons','weapons_horn') ORDER BY domain").all() as { source_sha256: string; builder_sha256: string }[]
    return {
      gameId: 'mhp2g', weaponTypeId, dataVersion: sources.map(source => `${source.source_sha256}:${source.builder_sha256}`).join(':'),
      nodes: [...keys].map(key => ({ ...summary(this.all().get(key)!), isCrossType: !own.has(key) })).sort(nativeOrder),
      edges: edges.map(e => ({ parentWeaponKey: e.parent_weapon_key, childWeaponKey: e.child_weapon_key, branchOrder: e.branch_order, isCrossType: this.all().get(e.parent_weapon_key)!.typeId !== this.all().get(e.child_weapon_key)!.typeId })),
    }
  }

  getMaterialItemMatches(queryText?: string): Map<number, string> {
    const query = normalize(queryText ?? ''), matches = new Map<number, string>()
    if (!query) return matches
    const weapons = new Map([...this.all().values()].filter(w => normalize(`${w.nameCn} ${w.nameJp} ${w.nameEn} ${w.weaponKey}`).includes(query)).map(w => [w.weaponKey, w]))
    for (const recipe of this.allRecipes().values()) {
      const output = recipe.outputs.find(o => weapons.has(o.weaponKey))
      if (!output) continue
      for (const material of recipe.materials) if (!matches.has(material.itemId)) matches.set(material.itemId, `命中：武器材料·${output.nameCn || output.nameJp}`)
    }
    return matches
  }

  /** Exact native material links, including all shard outcomes and alternative recipes. */
  getItemWeaponUsages(itemId: number): P2gWeaponRecipe[] {
    return [...this.allRecipes().values()].filter(r => r.materials.some(m => m.itemId === itemId))
  }
}
