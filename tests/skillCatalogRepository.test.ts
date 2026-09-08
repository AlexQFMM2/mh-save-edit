import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { SkillCatalogRepository } from '../api/catalog/skillRepository'
import type { GameId } from '../api/core/loadout'

const databases: Database.Database[] = []
function repository(gameId: GameId) {
  const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
  databases.push(db)
  return { db, repository: new SkillCatalogRepository(db) }
}
afterEach(() => databases.splice(0).forEach(db => db.close()))

describe('SkillCatalogRepository', () => {
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('returns linked catalog information for %s skills', gameId => {
    const { db, repository: repo } = repository(gameId)
    const row = db.prepare('SELECT skill_id FROM catalog_skills WHERE game_id=? ORDER BY skill_id LIMIT 1').get(gameId) as { skill_id: number }
    const detail = repo.getSkill({ gameId, skillId: row.skill_id })
    expect(detail?.nameCn).toBeTruthy()
    expect(detail?.decorations.every(value => value.gameId === gameId)).toBe(true)
    expect(detail?.armors.every(value => value.gameId === gameId)).toBe(true)
  })

  it('returns null for an unknown skill', () => {
    expect(repository('mh3g').repository.getSkill({ gameId: 'mh3g', skillId: 65535 })).toBeNull()
  })
})
