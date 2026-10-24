import type Database from 'better-sqlite3'
import { normalizeTerm } from '../terminology/catalogIdentity.mjs'
import type { P3ItemCatalogRepository } from './p3ItemRepository'
import { decorationCatalogFiltersSchema, decorationIdentitySchema } from './schemas'
import type { DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationSummary, PageResult, P3DecorationIdentity } from './types'

type Entry = { detail: DecorationDetail & P3DecorationIdentity; search: { text: string; reason: string }[] }

/** Read-only projection of the already verified item catalog, with no second data store. */
export class P3DecorationCatalogRepository {
  private entries?: Entry[]
  constructor(private readonly db: Database.Database, private readonly items: P3ItemCatalogRepository) {}

  private all(): Entry[] {
    if (this.entries) return this.entries
    const aliases = new Map((this.db.prepare('SELECT item_id,aliases_json FROM catalog_items').all() as { item_id: number; aliases_json: string }[])
      .map(row => [row.item_id, JSON.parse(row.aliases_json) as string[]]))
    const ids = this.db.prepare("SELECT item_id FROM catalog_items WHERE category='decoration' AND is_placeholder=0 ORDER BY item_id").all() as { item_id: number }[]
    this.entries = ids.map(({ item_id: itemId }) => {
      const item = this.items.getItem({ gameId: 'mhp3', itemId })
      if (!item?.p3.decoration) throw new Error(`P3 装饰品资料不完整：${itemId}`)
      const detail: Entry['detail'] = {
        gameId: 'mhp3', itemId, nameCn: item.nameCn, nameJp: item.nameJp, nameEn: '',
        slots: item.p3.decoration.slots, price: null, iconPath: item.iconPath, isPlaceholder: false,
        dexId: null, itemDexId: null, itemSaveId: null, dexIds: [], mappingStatus: item.mappingStatus,
        p3: { rarity: item.rarity, sellPrice: item.sellPrice, nameSource: item.localization!.nameSource,
          description: item.description ?? '', descriptionJp: item.localization!.descriptionJp ?? '' },
        skills: item.p3.decoration.skills.map(skill => ({ skillId: skill.id, nameCn: skill.nameCn, nameJp: skill.nameJp,
          nameEn: skill.nameEn, points: skill.points, activeSkillNameCn: null, activeSkillNameEn: null })),
        materials: item.p3.recipes.flatMap((recipe, index) => recipe.materials.map(material => ({ ...material, recipeIndex: index + 1 }))),
      }
      const search = [{ text: `${item.nameCn} ${item.nameJp}`, reason: `命中：装饰品·${item.nameCn}` }]
      for (const alias of aliases.get(itemId) ?? []) search.push({ text: alias, reason: `命中：装饰品别名·${alias}` })
      for (const skill of detail.skills) search.push({ text: `${skill.nameCn} ${skill.nameJp} ${skill.nameEn}`, reason: `命中：技能·${skill.nameCn}` })
      for (const material of detail.materials) search.push({ text: `${material.nameCn} ${material.nameJp} ${(aliases.get(material.itemId!) ?? []).join(' ')}`, reason: `命中：制作材料·${material.nameCn}` })
      return { detail, search: search.map(hit => ({ ...hit, text: normalizeTerm(hit.text) })) }
    })
    return this.entries
  }

  getDecoration(request: P3DecorationIdentity): DecorationDetail | null {
    const identity = decorationIdentitySchema.parse(request)
    if (identity.gameId !== 'mhp3') throw new Error('P3 装饰品身份与游戏不匹配')
    return this.all().find(entry => entry.detail.itemId === identity.itemId)?.detail ?? null
  }

  searchDecorations(request: DecorationCatalogFilters): PageResult<DecorationSummary> {
    const filters = decorationCatalogFiltersSchema.parse(request)
    if (filters.gameId !== 'mhp3') throw new Error('P3 装饰品身份与游戏不匹配')
    const query = normalizeTerm(filters.query), numeric = /^(?:0x[\da-f]+|\d+)$/i.test(query) ? Number(query) : null
    const rows = this.all().flatMap(({ detail, search }) => {
      const hit = query ? search.find(row => row.text.includes(query)) : undefined
      if (filters.targetItemId != null) {
        if (detail.itemId !== filters.targetItemId) return []
      } else if ((query && !hit && detail.itemId !== numeric)
        || (filters.slots != null && detail.slots !== filters.slots)
        || (filters.skillId != null && !detail.skills.some(skill => skill.skillId === filters.skillId))) return []
      return [{ ...detail, matchReason: hit?.reason ?? (detail.itemId === numeric ? '命中：道具编号' : undefined) }]
    })
    const points = (row: DecorationSummary) => row.skills.find(skill => skill.skillId === filters.skillId)?.points ?? 0
    rows.sort((a, b) => (filters.sort === 'name' ? a.nameCn.localeCompare(b.nameCn, 'zh-Hans')
      : filters.sort === 'slots' ? a.slots - b.slots
      : filters.sort === 'skillPoints' && filters.skillId != null ? points(b) - points(a) || a.slots - b.slots : 0) || a.itemId - b.itemId)
    const page = filters.page ?? 1, pageSize = filters.pageSize ?? 100
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, hasNext: page * pageSize < rows.length }
  }

  getDecorationFacets(): DecorationCatalogFacets {
    const skills = new Map<number, DecorationCatalogFacets['skills'][number]>()
    for (const { detail } of this.all()) for (const skill of detail.skills) skills.set(skill.skillId,
      { skillId: skill.skillId, nameCn: skill.nameCn, nameJp: skill.nameJp, nameEn: skill.nameEn })
    return { slots: [...new Set(this.all().map(entry => entry.detail.slots))].sort((a, b) => a - b),
      skills: [...skills.values()].sort((a, b) => a.nameCn.localeCompare(b.nameCn, 'zh-Hans')) }
  }
}
