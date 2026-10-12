import { itemNumber } from '../api/catalog/itemIdentity'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { MonsterCatalogRepository } from '../api/catalog/monsterRepository'
import type { GameId } from '../api/core/loadout'

const databases: Database.Database[] = []
function repository(gameId: GameId) {
  const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
  databases.push(db)
  return new MonsterCatalogRepository(db)
}
afterEach(() => databases.splice(0).forEach((db) => db.close()))

describe('MonsterCatalogRepository', () => {
  it.each([['mh3g', 73], ['mh4g', 106], ['mhgu', 129]] as const)('returns the audited visible %s monster count', (gameId, expected) => {
    expect(repository(gameId).searchMonsters({ gameId })).toHaveLength(expected)
  })

  it('searches Chinese, English, Japanese and hexadecimal identities', () => {
    const repo = repository('mhgu')
    const sample = repo.searchMonsters({ gameId: 'mhgu' }).find((monster) => monster.nameEn && monster.nameJp)!
    expect(repo.searchMonsters({ gameId: 'mhgu', query: sample.nameCn }).some((monster) => monster.monsterId === sample.monsterId)).toBe(true)
    expect(repo.searchMonsters({ gameId: 'mhgu', query: sample.nameEn }).some((monster) => monster.monsterId === sample.monsterId)).toBe(true)
    expect(repo.searchMonsters({ gameId: 'mhgu', query: sample.nameJp }).some((monster) => monster.monsterId === sample.monsterId)).toBe(true)
    expect(repo.searchMonsters({ gameId: 'mhgu', query: `0x${sample.monsterId.toString(16)}` }).map((monster) => monster.monsterId)).toContain(sample.monsterId)
  })

  it('hides placeholders normally and resolves an exact target', () => {
    const repo = repository('mh4g')
    expect(repo.searchMonsters({ gameId: 'mh4g' }).some((monster) => monster.isPlaceholder)).toBe(false)
    expect(repo.searchMonsters({ gameId: 'mh4g', includePlaceholders: true }).filter((monster) => monster.isPlaceholder)).toHaveLength(3)
    expect(repo.searchMonsters({ gameId: 'mh4g', targetMonsterId: 107, query: '不存在' })[0]?.monsterId).toBe(107)
  })

  it('returns all detail groups in one result and hides status 12', () => {
    const repo = repository('mhgu')
    const monster = repo.searchMonsters({ gameId: 'mhgu' }).find((entry) => {
      const detail = repo.getMonster(entry)
      return detail && detail.weakness.length && detail.ailments.length && detail.traps.length && detail.drops.length && detail.quests.length
    })!
    const detail = repo.getMonster(monster)!
    expect(detail.ailments.some((ailment) => ailment.statusId === 12)).toBe(false)
    expect(detail.drops.every((drop) => drop.probability >= 0 && drop.probability <= 100 && itemNumber(drop.item) >= 0)).toBe(true)
  })

  it('preserves null ailment values and invalid trap states', () => {
    const repo = repository('mh4g')
    const details = repo.searchMonsters({ gameId: 'mh4g' }).map((monster) => repo.getMonster(monster)!)
    expect(details.some((detail) => detail.ailments.some((ailment) => Object.values(ailment).includes(null)))).toBe(true)
    expect(details.some((detail) => detail.traps.some((trap) => !trap.isEffective))).toBe(true)
  })

  it('stores exactly 49 MHGU-exclusive quests and resolves quest monsters', () => {
    const repo = repository('mhgu')
    const db = databases[databases.length - 1]
    const row = db.prepare("SELECT quest_key FROM catalog_quests WHERE availability='mhgu' LIMIT 1").get() as { quest_key: string }
    expect((db.prepare("SELECT count(*) count FROM catalog_quests WHERE availability='mhgu'").get() as { count: number }).count).toBe(49)
    const quest = repo.getQuest({ gameId: 'mhgu', questKey: row.quest_key })
    expect(quest?.availability).toBe('mhgu')
    expect(quest?.monsters.length).toBeGreaterThan(0)
  })
})
