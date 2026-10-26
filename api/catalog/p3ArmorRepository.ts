import type Database from 'better-sqlite3'
import type { ArmorCatalogFacets, PageResult } from './types'
import type { P3ArmorDetail, P3ArmorFilters, P3ArmorIdentity, P3ArmorRecipe, P3ArmorSetFilters, P3ArmorSetSummary, P3ArmorSummary } from './p3ArmorTypes'
import type { P3SkillPoint } from './p3SkillTypes'
import { p3ArmorFiltersSchema, p3ArmorIdentitySchema, p3ArmorSetFiltersSchema } from './p3ArmorSchemas'
import { normalizeCatalogSearch as normalize } from './questRepository'

type StoredArmor = Omit<P3ArmorDetail, 'recipes' | 'skills'> & { aliases: string[]; skills: P3SkillPoint[] }
type Armor = Omit<P3ArmorDetail, 'recipes'> & { aliases: string[] }
type Member = { set_key: string; combat: P3ArmorSummary['combat']; part: P3ArmorSummary['part']; armor_key: string }
const partOrder = ['head', 'chest', 'arms', 'waist', 'legs']
const order = (a: P3ArmorSummary, b: P3ArmorSummary) => partOrder.indexOf(a.part)-partOrder.indexOf(b.part) || a.nativeId-b.nativeId
const paginate = <T,>(items: T[], filters: { page?: number; pageSize?: number }): PageResult<T> => {
  const page = filters.page ?? 1, pageSize = filters.pageSize ?? 100
  return { items: items.slice((page-1)*pageSize, page*pageSize), total: items.length, page, pageSize, hasNext: page*pageSize < items.length }
}
export const hasP3Armors = (db: Database.Database) => (db.prepare("SELECT value FROM meta WHERE key='armor_schema'").get() as { value: string } | undefined)?.value === 'mhp3-armors-v1'

/** Full armor and skill previews read the same native-keyed fact table. */
export class P3ArmorCatalogRepository {
  private readonly armors: Map<string, Armor>
  private readonly recipes: P3ArmorRecipe[]
  private readonly itemAliases: Map<number, string>

  constructor(private readonly db: Database.Database) {
    if (!hasP3Armors(db)) throw new Error('P3 防具资料尚未安装，请构建并安装防具资料后重启应用；技能最小预览仍可使用。')
    const skills = new Map((db.prepare('SELECT skill_id,detail_json FROM p3_skills').all() as { skill_id: number; detail_json: string }[])
      .map(r => [r.skill_id, JSON.parse(r.detail_json) as { nameCn: string; nameJp: string; nameEn: string }]))
    this.armors = new Map((db.prepare('SELECT detail_json FROM p3_skill_armors').all() as { detail_json: string }[]).map(r => {
      const a = JSON.parse(r.detail_json) as StoredArmor
      return [a.armorKey, { ...a, skills: a.skills.map(p => {
        const s = skills.get(p.skillId)
        if (!s) throw new Error(`P3 防具技能端点缺失：${p.skillId}`)
        return { ...p, nameCn: s.nameCn, nameJp: s.nameJp, nameEn: s.nameEn, activeSkillNameCn: null, activeSkillNameEn: null }
      }) }]
    }))
    const materials = new Map<string, P3ArmorRecipe['materials']>()
    this.itemAliases = new Map()
    for (const m of db.prepare('SELECT m.*,i.name_cn,i.name_jp,i.name_en,i.aliases_json FROM p3_armor_materials m JOIN catalog_items i USING(item_id) ORDER BY recipe_key,position').all() as {
      recipe_key: string; position: number; item_id: number; quantity: number; name_cn: string; name_jp: string; name_en: string; aliases_json: string
    }[]) {
      materials.set(m.recipe_key, [...(materials.get(m.recipe_key) ?? []), { gameId: 'mhp3', itemId: m.item_id, position: m.position, quantity: m.quantity, nameCn: m.name_cn, nameJp: m.name_jp, nameEn: m.name_en }])
      this.itemAliases.set(m.item_id, (JSON.parse(m.aliases_json) as string[]).join(' '))
    }
    this.recipes = (db.prepare('SELECT * FROM p3_armor_recipes ORDER BY armor_key,route_order').all() as { recipe_key: string; armor_key: string; cost: number | null }[]).map(r => {
      const a = this.armors.get(r.armor_key)
      if (!a) throw new Error(`P3 防具配方端点缺失：${r.armor_key}`)
      return { recipeKey: r.recipe_key, cost: r.cost, materials: materials.get(r.recipe_key) ?? [], armor: { gameId: 'mhp3', armorKey: a.armorKey, part: a.part, nameCn: a.nameCn, nameJp: a.nameJp, nameEn: a.nameEn } }
    })
  }

  private matching(f: P3ArmorFilters): P3ArmorSummary[] {
    const q = normalize(f.query ?? ''), materialHits = new Map<string, string>()
    if (q) for (const r of this.recipes) {
      const m = r.materials.find(m => normalize(`${m.nameCn} ${m.nameJp} ${m.nameEn} ${m.itemId} ${this.itemAliases.get(m.itemId) ?? ''}`).includes(q))
      if (m) materialHits.set(r.armor.armorKey, `命中：制作材料·${m.nameCn}`)
    }
    return [...this.armors.values()].flatMap(a => {
      if (f.targetArmorKey) return a.armorKey === f.targetArmorKey ? [a] : []
      if ((f.scope ?? 'obtainable') !== 'all' && a.acquisitionStatus !== (f.scope ?? 'obtainable')) return []
      if ((f.part && a.part !== f.part) || (f.combat && a.combat !== f.combat && a.combat !== 'both') || (f.gender && a.gender !== f.gender && a.gender !== 'both') || (f.rarity != null && a.rarity !== f.rarity) || (f.slots != null && a.slots !== f.slots) || (f.skillId != null && !a.skills.some(s => s.skillId === f.skillId))) return []
      const own = normalize(`${a.nameCn} ${a.nameJp} ${a.nameEn} ${a.armorKey} ${a.nativeId} ${a.aliases.join(' ')}`).includes(q)
      const skill = q ? a.skills.find(s => normalize(`${s.nameCn} ${s.nameJp} ${s.nameEn}`).includes(q)) : undefined
      const reason = materialHits.get(a.armorKey) ?? (skill ? `命中：技能·${skill.nameCn}` : undefined)
      return !q || own || reason ? [{ ...a, ...(!own && reason ? { matchReason: reason } : {}) }] : []
    })
  }

  searchArmors(request: P3ArmorFilters): PageResult<P3ArmorSummary> {
    const f = p3ArmorFiltersSchema.parse(request), items = this.matching(f), dir = f.direction === 'desc' ? -1 : 1
    const value = (a: P3ArmorSummary) => f.sort === 'skillPoints' ? a.skills.find(s => s.skillId === f.skillId && s.kind === 'signed-points')?.points ?? 0
      : a[(f.sort ?? 'nativeId') as 'nativeId' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense' | 'fireRes' | 'waterRes' | 'thunderRes' | 'iceRes' | 'dragonRes']
    items.sort((a, b) => dir*(f.sort === 'name' ? a.nameCn.localeCompare(b.nameCn, 'zh-CN') : !f.sort || f.sort === 'nativeId' ? order(a, b) : value(a)-value(b)) || order(a, b))
    return paginate(items, f)
  }

  searchArmorSets(request: P3ArmorSetFilters): PageResult<P3ArmorSetSummary> {
    const f = p3ArmorSetFiltersSchema.parse(request), { sort, ...common } = f
    const matches = new Map(this.matching(common).map(a => [a.armorKey, a]))
    const unqueried = new Set(this.matching({ ...common, query: undefined }).map(a => a.armorKey)), q = normalize(f.query ?? '')
    const members = this.db.prepare('SELECT * FROM p3_armor_members ORDER BY set_key,combat,part').all() as Member[]
    const items = (this.db.prepare('SELECT * FROM p3_armor_sets ORDER BY sort_order').all() as { set_key: string; sort_order: number; detail_json: string }[]).flatMap(s => {
      const data = JSON.parse(s.detail_json) as { nameCn: string; nameJp: string; gender: P3ArmorSummary['gender']; standalone?: boolean }
      if (f.gender && data.gender !== f.gender && data.gender !== 'both') return []
      const own = members.filter(m => m.set_key === s.set_key && (!f.combat || m.combat === f.combat || m.combat === 'both'))
      const titleHit = q && normalize(`${data.nameCn} ${data.nameJp}`).includes(q)
      const matched = own.find(m => matches.has(m.armor_key)) ?? (titleHit ? own.find(m => unqueried.has(m.armor_key)) : undefined)
      if (!matched) return []
      const rows = (['both', 'blademaster', 'gunner'] as const).flatMap(combat => {
        const current = own.filter(m => m.combat === combat)
        return current.length ? [{ combat, nameCn: data.nameCn, members: Object.fromEntries(current.map(m => [m.part, this.armors.get(m.armor_key)!])) }] : []
      })
      const armorRows = rows.map(r => Object.values(r.members))
      const total = (k: 'slots' | 'baseDefense' | 'maxDefense') => Math.max(...armorRows.map(row => row.reduce((sum, a) => sum+a[k], 0)))
      return [{ gameId: 'mhp3' as const, setKey: s.set_key, sortOrder: s.sort_order, nameJp: data.nameJp, gender: data.gender, standalone: data.standalone ?? false, rows,
        rarity: Math.max(...armorRows.flat().map(a => a.rarity)), totalSlots: total('slots'), totalBaseDefense: total('baseDefense'), totalMaxDefense: total('maxDefense'), matchReason: matches.get(matched.armor_key)?.matchReason }]
    })
    const points = (s: P3ArmorSetSummary) => Math.max(...s.rows.map(r => Object.values(r.members).reduce((sum, a) => sum+(a?.skills.find(p => p.skillId === f.skillId && p.kind === 'signed-points')?.points ?? 0), 0)))
    const value = (s: P3ArmorSetSummary) => sort === 'rarity' ? s.rarity : sort === 'slots' ? s.totalSlots : sort === 'baseDefense' ? s.totalBaseDefense : sort === 'maxDefense' ? s.totalMaxDefense : sort === 'skillPoints' ? points(s) : s.sortOrder
    const dir = f.direction === 'desc' ? -1 : 1
    items.sort((a, b) => dir*(sort === 'name' ? a.rows[0].nameCn.localeCompare(b.rows[0].nameCn, 'zh-CN') : value(a)-value(b)) || a.sortOrder-b.sortOrder)
    return paginate(items, f)
  }

  getArmor(request: P3ArmorIdentity): P3ArmorDetail | null {
    const identity = p3ArmorIdentitySchema.parse(request), a = this.armors.get(identity.armorKey)
    return a ? { ...a, recipes: this.recipes.filter(r => r.armor.armorKey === a.armorKey) } : null
  }
  getArmorFacets(): ArmorCatalogFacets {
    const all = [...this.armors.values()], numbers = (key: 'rarity' | 'slots') => [...new Set(all.map(a => a[key]))].sort((a, b) => a-b)
    const skills = new Map(all.flatMap(a => a.skills.map(s => [s.skillId, { skillId: s.skillId, nameCn: s.nameCn, nameJp: s.nameJp, nameEn: s.nameEn }] as const)))
    return { rarities: numbers('rarity'), slots: numbers('slots'), skills: [...skills.values()].sort((a, b) => a.skillId-b.skillId) }
  }
  getItemArmorUsages(itemId: number): P3ArmorRecipe[] { return this.recipes.filter(r => r.materials.some(m => m.itemId === itemId)) }
  getMaterialItemMatches(query?: string): Map<number, string> {
    const q = normalize(query ?? ''), hits = new Map<number, string>()
    if (!q) return hits
    const keys = new Set([...this.armors.values()].filter(a => normalize(`${a.nameCn} ${a.nameJp} ${a.armorKey} ${a.aliases.join(' ')}`).includes(q)).map(a => a.armorKey))
    for (const r of this.recipes) if (keys.has(r.armor.armorKey)) for (const m of r.materials) hits.set(m.itemId, `命中：防具材料·${r.armor.nameCn}`)
    return hits
  }
}
