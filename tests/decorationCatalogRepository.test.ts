import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { DecorationCatalogRepository } from '../api/catalog/decorationRepository'
import type { GameId } from '../api/core/loadout'

const databases: Database.Database[] = []
function repository(gameId: GameId) { const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true }); databases.push(db); return new DecorationCatalogRepository(db) }
afterEach(() => databases.splice(0).forEach((db) => db.close()))

describe('DecorationCatalogRepository', () => {
  it.each([['mh3g', 196], ['mh4g', 289], ['mhgu', 242]] as const)('returns visible decorations for %s', (gameId, total) => { const result = repository(gameId).searchDecorations({ gameId, pageSize: 100 }); expect(result.total).toBe(total); expect(result.items.length).toBe(100) })
  it('hides placeholders unless debug is enabled', () => { const repo = repository('mh4g'); expect(repo.searchDecorations({ gameId: 'mh4g' }).total).toBe(289); expect(repo.searchDecorations({ gameId: 'mh4g', includePlaceholders: true }).total).toBe(290) })
  it('searches decimal and hexadecimal IDs and filters positive skill points', () => { const repo = repository('mh3g'); expect(repo.searchDecorations({ gameId: 'mh3g', query: '0x0001' }).items[0]?.saveId).toBe(1); const skill = repo.getDecorationFacets('mh3g').skills[0]; const result = repo.searchDecorations({ gameId: 'mh3g', skillId: skill.skillId, sort: 'skillPoints' }); expect(result.items.every((item) => item.skills.some((value) => value.skillId === skill.skillId && value.points > 0))).toBe(true) })
  it('returns negative points and clickable material identities in detail', () => { const item = repository('mhgu').getDecoration({ gameId: 'mhgu', saveId: 2638 }); expect(item?.skills.some((skill) => skill.points < 0)).toBe(true); expect(item?.materials.every((material) => material.saveId > 0 && material.recipeIndex > 0)).toBe(true) })
  it('preserves every Dex recipe source when save IDs are deduplicated', () => { const item = repository('mh3g').getDecoration({ gameId: 'mh3g', saveId: 2 }); expect(item?.dexIds).toEqual([2, 3]) })
  it('filters an exact save target for drawer navigation', () => { const result = repository('mh3g').searchDecorations({ gameId: 'mh3g', targetSaveId: 86 }); expect(result.items.map((item) => item.saveId)).toEqual([86]) })
})
