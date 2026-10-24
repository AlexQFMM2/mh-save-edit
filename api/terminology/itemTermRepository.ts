import type Database from 'better-sqlite3'
import type { ItemCatalogGameId, CatalogItemDetail, ItemIdentity } from '../catalog/types'
import { catalogIdentityRows, identityFingerprint, normalizeTerm } from './catalogIdentity.mjs'
import type { ItemTerm, ItemTermFilters, ItemTermLabel, ItemTermPage } from './types'

type Member = { term_id: string; preferred_name: string; original_name: string; source: string; status: string }
export class ItemTermRepository {
  private members = new Map<string, Member>()
  constructor(private readonly db: Database.Database) {
    const meta = db.prepare("SELECT value FROM meta WHERE key='schema'").get() as { value: string } | undefined
    if (meta?.value !== 'item-terminology-v1') throw new Error('译名词典版本不匹配，请重新构建。')
    for (const row of db.prepare('SELECT m.*,t.preferred_name,t.source FROM members m JOIN terms t ON t.id=m.term_id').all() as (Member & { game_id: string; item_id: number })[]) {
      this.members.set(`${row.game_id}:${row.item_id}`, row)
    }
  }
  bindCatalog(db: Database.Database, gameId: ItemCatalogGameId) {
    const expected = this.db.prepare('SELECT value FROM meta WHERE key=?').get(`catalog:${gameId}`) as { value: string } | undefined
    if (expected?.value !== identityFingerprint(catalogIdentityRows(db, gameId))) throw new Error(`${gameId} 道具资料与译名词典不匹配，请重新生成配套资料。`)
    db.function('item_display_name', { deterministic: true }, (game, id, original) => this.name(String(game), Number(id), String(original)))
  }
  name(gameId: string, id: number, original: string) { return this.members.get(`${gameId}:${id}`)?.preferred_name ?? original }
  matchItems(gameId: ItemCatalogGameId, query?: string): Map<number, string> {
    const normalized = normalizeTerm(query)
    if (!normalized) return new Map()
    const rows = this.db.prepare(`SELECT m.item_id,a.name FROM aliases a JOIN members m ON m.term_id=a.term_id
      WHERE m.game_id=? AND instr(a.normalized,?)>0 ORDER BY (a.normalized=?) DESC,a.name,a.source`).all(gameId, normalized, normalized) as { item_id: number; name: string }[]
    const matches = new Map<number, string>()
    for (const row of rows) if (!matches.has(row.item_id)) matches.set(row.item_id, row.name)
    return matches
  }
  project<T extends ItemIdentity & { nameCn: string }>(item: T, query?: string, matchedAlias?: string): T & { terminology?: ItemTermLabel } {
    const member = this.members.get(`${item.gameId}:${(item.gameId === 'mhp2g' || item.gameId === 'mhp3') ? item.itemId : item.saveId}`)
    if (!member) return item
    const alias = query && matchedAlias && !normalizeTerm(member.preferred_name).includes(normalizeTerm(query)) ? matchedAlias : undefined
    return Object.assign({}, item, { nameCn: item.gameId === 'mhp3' ? item.nameCn : member.preferred_name, terminology: { termId: member.term_id, originalName: member.original_name, source: member.source, status: member.status, ...(alias ? { matchedAlias: alias } : {}) } })
  }
  detail<T extends CatalogItemDetail>(item: T): T {
    return { ...this.project(item), relations: item.relations.map(relation => {
      const relatedItems = relation.relatedItems.map(target => this.project(target))
      // Combination labels originate from these exact item endpoints, not a global text replace.
      let targetName = relation.targetName
      if (item.gameId === 'mhp2g' && relation.sourceKind === 'combination') {
        if (relatedItems.length === 2) targetName = relatedItems.map(target => target.nameCn).join(' · ')
        else if (relatedItems.length === 1 && targetName.startsWith('可调合：')) targetName = `可调合：${relatedItems[0].nameCn}`
      }
      return { ...relation, targetName, relatedItems }
    }) }
  }
  search(filters: ItemTermFilters): ItemTermPage {
    const page = filters.page ?? 1, pageSize = Math.min(filters.pageSize ?? 30, 100)
    const where = ['1=1'], values: (string | number)[] = []
    if (filters.gameId) { where.push('EXISTS(SELECT 1 FROM members m WHERE m.term_id=t.id AND m.game_id=?)'); values.push(filters.gameId) }
    if (normalizeTerm(filters.query)) { where.push('EXISTS(SELECT 1 FROM aliases a WHERE a.term_id=t.id AND instr(a.normalized,?)>0)'); values.push(normalizeTerm(filters.query)) }
    const condition = where.join(' AND ')
    const total = (this.db.prepare(`SELECT count(*) n FROM terms t WHERE ${condition}`).get(...values) as { n: number }).n
    const rows = this.db.prepare(`SELECT * FROM terms t WHERE ${condition} ORDER BY t.preferred_name,t.id LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize) as { id: string; ja: string; preferred_name: string; source: string }[]
    const items: ItemTerm[] = rows.map(row => ({ id: row.id, name: row.preferred_name, nameJp: row.ja, source: row.source,
      aliases: this.db.prepare('SELECT name,game_id AS gameId,source FROM aliases WHERE term_id=? ORDER BY game_id,source,name').all(row.id) as ItemTerm['aliases'],
      members: this.db.prepare('SELECT game_id AS gameId,item_id AS itemId,original_name AS originalName,status FROM members WHERE term_id=? ORDER BY game_id,item_id').all(row.id) as ItemTerm['members'],
    }))
    return { available: true, items, total, page, pageSize, hasNext: page * pageSize < total }
  }
}
