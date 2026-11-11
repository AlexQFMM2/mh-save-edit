import type Database from 'better-sqlite3'
import type { ItemRelation, MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterDrop, MonsterIdentity, MonsterSummary } from './types'
import { monsterCatalogFiltersSchema, monsterIdentitySchema } from './schemas'
import { normalizeCatalogSearch as normalize } from './questRepository'

type Stored = Omit<MonsterDetail, 'drops' | 'quests'> & { aliases: string[]; bookIndex: number | null; recordScope: 'normal' | 'extended' }
type DropRow = { id: number; monster_id: number; item_id: number; rank_id: number; method_id: number; quantity: number | null; probability: number | null; detail_json: string }
type ItemRow = { item_id: number; name_cn: string; name_jp: string; aliases_json: string }
type LinkedDrop = { monsterId: number; itemId: number; detail: MonsterDrop }
const names = (m: Stored) => normalize([m.nameCn, m.nameJp, m.nameEn, ...m.aliases].join(' '))
const summary = (m: Stored): MonsterSummary => ({ gameId: 'mhp3', monsterId: m.monsterId, nameCn: m.nameCn, nameJp: m.nameJp,
  nameEn: m.nameEn, iconSmallPath: m.iconSmallPath, iconLargePath: m.iconLargePath, isPlaceholder: false, recordScope: m.recordScope, sizeClass: m.sizeClass })

export function hasP3Monsters(db: Database.Database): boolean {
  const version = db.prepare("SELECT value FROM meta WHERE key='monster_schema'").get() as { value: string } | undefined
  if (!version) return false
  if (version.value !== 'mhp3-monsters-v1') throw new Error('P3 怪物资料版本不匹配，请更新本地资料并重启应用。')
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('p3_monsters','p3_monster_drops')").all()
  if (tables.length !== 2) throw new Error('P3 怪物资料不完整，请恢复完整资料库。')
  return true
}

/** All forward/reverse links come from the same drop table. No item repository dependency. */
export class P3MonsterCatalogRepository {
  private readonly monsters: Map<number, Stored>
  private readonly drops: LinkedDrop[]
  private readonly itemText: Map<number, string>
  private readonly sourceItems: Set<number>

  constructor(db: Database.Database) {
    if (!hasP3Monsters(db)) throw new Error('P3 怪物资料尚未安装，请安装完整怪物资料后重启应用；已有图鉴仍可使用。')
    this.monsters = new Map((db.prepare('SELECT monster_id,detail_json FROM p3_monsters ORDER BY monster_id').all() as { monster_id: number; detail_json: string }[])
      .map(r => [r.monster_id, JSON.parse(r.detail_json) as Stored]))
    const items = new Map((db.prepare('SELECT item_id,name_cn,name_jp,aliases_json FROM catalog_items WHERE is_placeholder=0').all() as ItemRow[]).map(i => [i.item_id, i]))
    this.itemText = new Map([...items.values()].map(i => [i.item_id, normalize([i.name_cn, i.name_jp, ...JSON.parse(i.aliases_json) as string[]].join(' '))]))
    this.drops = (db.prepare('SELECT * FROM p3_monster_drops ORDER BY id').all() as DropRow[]).map(r => {
      const item = items.get(r.item_id)
      if (!item || !this.monsters.has(r.monster_id)) throw new Error(`P3 怪物掉落关系端点缺失：${r.id}`)
      const stored = JSON.parse(r.detail_json) as Pick<MonsterDrop, 'rankNameCn' | 'rankNameEn' | 'methodNameCn' | 'methodNameEn' | 'p3'>
      return { monsterId: r.monster_id, itemId: r.item_id, detail: { ...stored, id: r.id, rankId: r.rank_id, methodId: r.method_id,
        quantity: r.quantity, probability: r.probability, item: { gameId: 'mhp3', itemId: r.item_id, nameCn: item.name_cn, nameEn: '' } } }
    })
    this.sourceItems = new Set(this.drops.map(d => d.itemId))
  }

  searchMonsters(request: MonsterCatalogFilters): MonsterSummary[] {
    const f = monsterCatalogFiltersSchema.parse(request)
    if (f.gameId !== 'mhp3') throw new Error('P3 怪物身份与游戏不匹配')
    const query = normalize(f.query ?? '')
    const numeric = /^0x[\da-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
    const itemMatches = new Map<number, string>()
    if (query && numeric === null) for (const d of this.drops) {
      if (this.itemText.get(d.itemId)?.includes(query) && !itemMatches.has(d.monsterId)) itemMatches.set(d.monsterId, `命中：掉落道具·${d.detail.item.nameCn}`)
    }
    return [...this.monsters.values()].flatMap(m => {
      if (f.targetMonsterId != null) return m.monsterId === f.targetMonsterId ? [summary(m)] : []
      if ((f.scope ?? 'normal') !== 'all' && m.recordScope !== (f.scope ?? 'normal')) return []
      if (!query || m.monsterId === numeric || numeric === null && names(m).includes(query)) return [summary(m)]
      const appearance = numeric === null && m.p3?.appearances.find(q => normalize([q.nameCn, q.nameJp].join(' ')).includes(query))
      const reason = itemMatches.get(m.monsterId) ?? (appearance ? `命中：出没任务·${appearance.nameCn || appearance.nameJp}` : undefined)
      return reason ? [{ ...summary(m), matchReason: reason }] : []
    })
  }

  getMonster(request: MonsterIdentity): MonsterDetail | null {
    const identity = monsterIdentitySchema.parse(request)
    if (identity.gameId !== 'mhp3') throw new Error('P3 怪物身份与游戏不匹配')
    const m = this.monsters.get(identity.monsterId)
    return m ? { ...summary(m), weakness: m.weakness, ailments: m.ailments, traps: m.traps, p3: m.p3,
      drops: this.drops.filter(d => d.monsterId === m.monsterId).map(d => d.detail), quests: [] } : null
  }

  getMonsterFacets(): MonsterCatalogFacets {
    const all = this.monsters.size, normal = [...this.monsters.values()].filter(m => m.recordScope === 'normal').length
    return { monsterCount: normal, scopeCounts: { normal, extended: all-normal, all }, statusNames: [], trapNames: [], questAvailabilities: [] }
  }

  hasItemSource(itemId: number): boolean { return this.sourceItems.has(itemId) }

  getDropItemMatches(query?: string): Map<number, string> {
    const q = normalize(query ?? ''), matches = new Map<number, string>()
    if (!q) return matches
    const monsters = new Set([...this.monsters.values()].filter(m => names(m).includes(q)).map(m => m.monsterId))
    for (const d of this.drops) if (monsters.has(d.monsterId) && !matches.has(d.itemId)) matches.set(d.itemId, `命中：怪物来源·${this.monsters.get(d.monsterId)!.nameCn}`)
    return matches
  }

  getItemSources(itemId: number): ItemRelation[] {
    return this.drops.filter(d => d.itemId === itemId).map(({ monsterId, detail: d }) => {
      const m = this.monsters.get(monsterId)!
      return { id: d.id, sourceKind: 'monster', usageKind: null, targetId: monsterId, targetName: m.nameCn,
        quantity: d.quantity, probability: d.probability, rank: d.rankId, relatedItems: [],
        relatedMonster: { gameId: 'mhp3', monsterId, nameCn: m.nameCn, nameEn: m.nameEn, iconPath: m.iconSmallPath },
        metadata: { '位阶／任务条件': d.rankNameCn, '取得方式': d.methodNameCn, '每次数量': d.quantity == null ? '未知' : String(d.quantity),
          '尝试次数': d.p3?.attemptCountJp || '未收录', '条件（日文）': d.p3?.conditionJp || '资料未注明', '来源': d.p3?.source.label ?? '未收录' } }
    })
  }
}
