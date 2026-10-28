import type Database from 'better-sqlite3'
import type { P3ItemLink } from './p3ItemTypes'
import type { P3ItemWeaponUsage, P3WeaponDetail, P3WeaponFacets, P3WeaponFilters, P3WeaponIdentity, P3WeaponLink, P3WeaponMaterial, P3WeaponPage, P3WeaponRecipe, P3WeaponSpecial, P3WeaponSummary, P3WeaponTree, P3WeaponType } from './p3WeaponTypes'
import { p3WeaponFiltersSchema, p3WeaponIdentitySchema, p3WeaponTypeIdSchema } from './p3WeaponSchemas'
import { normalizeCatalogSearch as normalize } from './questRepository'

type Stored = Omit<P3WeaponDetail, 'recipes' | 'parents' | 'children'>
type Edge = { parent_weapon_key: string; child_weapon_key: string; branch_order: number }
type ItemUsage = { weapon_key: string; item_id: number; role: P3ItemWeaponUsage['role']; requires_skill: number }
const nativeOrder = (a: P3WeaponSummary, b: P3WeaponSummary) => a.nativeType - b.nativeType || a.nativeId - b.nativeId
const link = (w: P3WeaponSummary): P3WeaponLink => ({ gameId: 'mhp3', weaponKey: w.weaponKey, typeId: w.typeId, nameCn: w.nameCn, nameJp: w.nameJp, nameEn: w.nameEn })
const text = (w: Stored) => normalize([w.nameCn, w.nameJp, w.weaponKey, ...w.aliases].join(' '))
function specialSummary(s: P3WeaponSpecial): string[] {
  switch (s.kind) {
    case 'switchAxe': return [s.phialName+(s.phialValue == null ? '' : ` ${s.phialValue}`)]
    case 'gunlance': return [`${s.shellingType} Lv.${s.level}`]
    case 'huntingHorn': return [s.notes.join(' · ')]
    case 'bowgun': return [`装填${s.reload}`, `反动${s.recoil}`, `偏移${s.deviation}`]
    case 'bow': return [s.arcType, ...s.charges.filter(c => c.available).map(c => `${c.typeCode}${c.shotLevel}`)]
    default: return []
  }
}
function summary(w: Stored): P3WeaponSummary {
  const { nameSource: _name, aliases: _aliases, acquisition: _acq, acquisitionSource: _source, nativeRowSha256: _hash, boost: _boost, fieldSources: _fields, special, ...value } = w
  return { ...value, specialSummary: specialSummary(special) }
}
export function hasP3Weapons(db: Database.Database): boolean {
  return (db.prepare("SELECT value FROM meta WHERE key='weapon_schema'").get() as { value: string } | undefined)?.value === 'mhp3-weapons-v1'
}

/** Only this P3 repository decodes P3 stored details. Reads never mutate the library. */
export class P3WeaponCatalogRepository {
  private readonly weapons: Map<string, Stored>
  private readonly edges: Edge[]
  private readonly usages: ItemUsage[]
  private readonly items: Map<number, P3ItemLink & { aliases: string[] }>
  private readonly recipes: P3WeaponRecipe[]
  constructor(private readonly db: Database.Database) {
    if (!hasP3Weapons(db)) throw new Error('P3 武器资料尚未安装，请安装完整武器资料后重启应用；已安装的道具、技能与防具图鉴仍可使用。')
    this.weapons = new Map((db.prepare('SELECT weapon_key,detail_json FROM p3_weapons ORDER BY native_type,native_id').all() as { weapon_key: string; detail_json: string }[]).map(r => [r.weapon_key, JSON.parse(r.detail_json) as Stored]))
    this.edges = db.prepare('SELECT * FROM p3_weapon_edges ORDER BY parent_weapon_key,branch_order').all() as Edge[]
    this.usages = db.prepare('SELECT * FROM p3_weapon_item_links ORDER BY weapon_key,item_id,role').all() as ItemUsage[]
    this.items = new Map((db.prepare('SELECT i.item_id,i.name_cn,i.name_jp,i.aliases_json FROM catalog_items i').all() as { item_id: number; name_cn: string; name_jp: string; aliases_json: string }[]).map(r => [r.item_id, { gameId: 'mhp3', itemId: r.item_id, nameCn: r.name_cn, nameJp: r.name_jp, nameEn: '', aliases: JSON.parse(r.aliases_json) as string[] }]))
    const materials = new Map<string, { materials: P3WeaponMaterial[]; byproducts: P3WeaponMaterial[] }>()
    for (const r of db.prepare('SELECT * FROM p3_weapon_materials ORDER BY recipe_key,role,position').all() as { recipe_key: string; role: 'material' | 'byproduct'; item_id: number; quantity: number | null; position: number }[]) {
      const entry = materials.get(r.recipe_key) ?? { materials: [], byproducts: [] }
      entry[r.role === 'material' ? 'materials' : 'byproducts'].push({ ...this.item(r.item_id), quantity: r.quantity, position: r.position })
      materials.set(r.recipe_key, entry)
    }
    this.recipes = (db.prepare('SELECT * FROM p3_weapon_recipes ORDER BY recipe_key').all() as { recipe_key: string; weapon_key: string; kind: P3WeaponRecipe['kind']; cost: number | null; source: string }[]).map(r => ({ recipeKey: r.recipe_key, weapon: link(this.required(r.weapon_key)), kind: r.kind, cost: r.cost, source: r.source, materials: materials.get(r.recipe_key)?.materials ?? [], byproducts: materials.get(r.recipe_key)?.byproducts ?? [] }))
  }
  private required(key: string): Stored {
    const w = this.weapons.get(key)
    if (!w) throw new Error(`P3 武器关系端点缺失：${key}`)
    return w
  }
  private item(id: number): P3ItemLink {
    const value = this.items.get(id)
    if (!value) throw new Error(`P3 武器关联道具缺失：${id}`)
    const { aliases: _aliases, ...item } = value
    return item
  }
  private presentSpecial(s: P3WeaponSpecial): P3WeaponSpecial {
    if (s.kind === 'bowgun') return { ...s, ammo: s.ammo.map(a => ({ ...a, item: this.item(a.itemId) })), rapidFire: s.rapidFire.map(a => ({ ...a, item: this.item(a.itemId) })), crouchFire: s.crouchFire.map(a => ({ ...a, item: this.item(a.itemId) })) }
    if (s.kind === 'bow') return { ...s, coatings: s.coatings.map(a => ({ ...a, item: this.item(a.itemId) })) }
    return s
  }
  searchWeapons(request: P3WeaponFilters): P3WeaponPage {
    const f = p3WeaponFiltersSchema.parse(request), q = normalize(f.query ?? '')
    const numeric = /^0x[\da-f]+$/i.test(q) ? Number.parseInt(q.slice(2), 16) : /^\d+$/.test(q) ? Number(q) : null
    const hits = new Map<string, string>()
    if (q && numeric === null) {
      const matchingItems = new Set([...this.items.values()].filter(i => normalize([i.nameCn, i.nameJp, ...i.aliases].join(' ')).includes(q)).map(i => i.itemId))
      for (const r of this.recipes) for (const m of r.materials) if (matchingItems.has(m.itemId) && !hits.has(r.weapon.weaponKey)) hits.set(r.weapon.weaponKey, `命中：${r.kind === 'upgrade' ? '升级材料' : r.kind === 'appraisal' ? '鉴定道具' : '制作材料'}·${m.nameCn}`)
      for (const u of this.usages) if (matchingItems.has(u.item_id) && !hits.has(u.weapon_key)) hits.set(u.weapon_key, `命中：${u.role === 'boost' ? '攻击强化材料' : u.role === 'ammo' ? '可用弹药' : '可用瓶'}·${this.item(u.item_id).nameCn}${u.requires_skill ? '（需技能）' : ''}`)
    }
    let values = [...this.weapons.values()].filter(w => f.targetWeaponKey ? w.weaponKey === f.targetWeaponKey :
      (f.scope === 'all' || w.acquisitionStatus === (f.scope ?? 'obtainable')) && (f.weaponTypeId == null || f.weaponTypeId === w.typeId)
      && (f.rarity == null || f.rarity === w.rarity) && (f.slots == null || f.slots === w.slots)
      && (f.directlyProducible == null || f.directlyProducible === w.isDirectlyProducible) && (!f.finalOnly || w.isFinalForm)
      && (f.attributeId == null || (f.attributeId === 'none' ? !w.attributes.length : w.attributes.some(a => a.attributeId === f.attributeId)))
      && (!q || w.nativeId === numeric || (numeric === null && (text(w).includes(q) || hits.has(w.weaponKey)))))
      .map(w => ({ ...summary(w), ...(q && hits.has(w.weaponKey) && !text(w).includes(q) && w.nativeId !== numeric ? { matchReason: hits.get(w.weaponKey) } : {}) }))
    const sharpness = (w: P3WeaponSummary) => {
      const segments = w.sharpness?.[f.sharpnessStage === 'handicraft1' ? 'handicraft' : 'base']
      if (!segments) return -1
      const color = segments.reduce((last, length, i) => length > 0 ? i : last, -1)
      return color*1000000+(segments[color] ?? 0)
    }
    const value = (w: P3WeaponSummary) => f.sort === 'attack' ? w.displayAttack : f.sort === 'rarity' ? w.rarity : f.sort === 'affinity' ? w.affinity : f.sort === 'slots' ? w.slots : sharpness(w)
    values.sort((a,b) => (f.sort === 'name' ? a.nameCn.localeCompare(b.nameCn, 'zh-CN') : !f.sort || f.sort === 'nativeId' ? nativeOrder(a,b) : value(a)-value(b))*(f.direction === 'desc' ? -1 : 1) || nativeOrder(a,b))
    const total = values.length, page = f.page ?? 1, pageSize = f.pageSize ?? 100
    values = values.slice((page-1)*pageSize, page*pageSize)
    return { items: values, total, page, pageSize, hasNext: page*pageSize < total }
  }
  getWeapon(request: P3WeaponIdentity): P3WeaponDetail | null {
    const identity = p3WeaponIdentitySchema.parse(request), w = this.weapons.get(identity.weaponKey)
    if (!w) return null
    return { ...w, special: this.presentSpecial(w.special), boost: { ...w.boost, material: { ...w.boost.material, item: this.item(w.boost.material.itemId) } }, recipes: this.recipes.filter(r => r.weapon.weaponKey === w.weaponKey), parents: this.edges.filter(e => e.child_weapon_key === w.weaponKey).map(e => link(this.required(e.parent_weapon_key))), children: this.edges.filter(e => e.parent_weapon_key === w.weaponKey).map(e => link(this.required(e.child_weapon_key))) }
  }
  getWeaponFacets(): P3WeaponFacets {
    const weapons = [...this.weapons.values()]
    const numbers = (key: 'rarity' | 'slots') => [...new Set(weapons.map(w => w[key]))].sort((a,b) => a-b)
    const attributes = new Map(weapons.flatMap(w => w.attributes.map(({ value: _value, ...a }) => [a.attributeId, a] as const)))
    return { weaponTypes: (this.db.prepare("SELECT detail_json FROM p3_weapon_types ORDER BY json_extract(detail_json,'$.sortOrder')").all() as { detail_json: string }[]).map(r => JSON.parse(r.detail_json) as P3WeaponType), attributes: [...attributes.values()].sort((a,b) => a.attributeId-b.attributeId), rarities: numbers('rarity'), slots: numbers('slots'), sharpnessStages: ['base', 'handicraft1'] }
  }
  getWeaponTree(typeId: number): P3WeaponTree {
    p3WeaponTypeIdSchema.parse(typeId)
    const own = new Set([...this.weapons.values()].filter(w => w.typeId === typeId).map(w => w.weaponKey))
    const edges = this.edges.filter(e => own.has(e.parent_weapon_key) || own.has(e.child_weapon_key))
    const keys = new Set([...own, ...edges.flatMap(e => [e.parent_weapon_key, e.child_weapon_key])])
    return { gameId: 'mhp3', weaponTypeId: typeId, dataVersion: (this.db.prepare("SELECT value FROM meta WHERE key='weapon_data_version'").get() as { value: string }).value, nodes: [...keys].map(key => ({ ...summary(this.required(key)), isCrossType: !own.has(key) })).sort(nativeOrder), edges: edges.map(e => ({ parentWeaponKey: e.parent_weapon_key, childWeaponKey: e.child_weapon_key, branchOrder: e.branch_order, isCrossType: this.required(e.parent_weapon_key).typeId !== this.required(e.child_weapon_key).typeId })) }
  }
  getMaterialItemMatches(query?: string): Map<number, string> {
    const q = normalize(query ?? ''), result = new Map<number, string>()
    if (!q) return result
    const matching = new Set([...this.weapons.values()].filter(w => text(w).includes(q)).map(w => w.weaponKey))
    for (const r of this.recipes) if (matching.has(r.weapon.weaponKey)) for (const m of [...r.materials, ...r.byproducts]) result.set(m.itemId, `命中：相关武器·${r.weapon.nameCn}`)
    for (const u of this.usages) if (matching.has(u.weapon_key)) result.set(u.item_id, `命中：相关武器·${this.required(u.weapon_key).nameCn}`)
    return result
  }
  getItemWeaponRecipes(itemId: number): P3WeaponRecipe[] { return this.recipes.filter(r => [...r.materials, ...r.byproducts].some(m => m.itemId === itemId)) }
  getItemWeaponUsages(itemId: number): P3ItemWeaponUsage[] { return this.usages.filter(u => u.item_id === itemId).map(u => ({ weapon: link(this.required(u.weapon_key)), role: u.role, requiresSkill: Boolean(u.requires_skill) })) }
}
