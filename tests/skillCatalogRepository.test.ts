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

  it('searches skill systems by activation names and supports direction/source filters', () => {
    const repo = repository('mhgu').repository
    const weakness = repo.searchSkills({ gameId: 'mhgu', query: '弱点特效' })
    expect(weakness.items.some(skill => skill.nameCn === '痛击')).toBe(true)
    expect(repo.searchSkills({ gameId: 'mhgu', direction: 'negative' }).items.every(skill => skill.negativeActivationCount > 0)).toBe(true)
    expect(repo.searchSkills({ gameId: 'mhgu', source: 'talisman' }).items.every(skill => skill.talismanCount > 0)).toBe(true)
  })

  it('keeps composite effects and authoritative talisman positions separate', () => {
    const repo = repository('mh4g').repository
    const edgemaster = repo.searchSkills({ gameId: 'mh4g', query: '真打' }).items.find(skill => skill.nameCn === '刀匠')
    expect(edgemaster).toBeTruthy()
    expect(repo.getSkill({ gameId: 'mh4g', skillId: edgemaster!.skillId })?.activations[0].components.length).toBeGreaterThan(0)

    const gu = repository('mhgu').repository
    const tenderizer = gu.searchSkills({ gameId: 'mhgu', query: '痛击' }).items[0]
    const detail = gu.getSkill({ gameId: 'mhgu', skillId: tenderizer.skillId })!
    const creator = detail.talismans.filter(row => row.talismanNameCn === '天之护石')
    expect(creator.some(row => row.position === 'A' && row.minPoints === 2 && row.maxPoints === 6)).toBe(true)
    expect(creator.some(row => row.position === 'B' && row.minPoints === -3 && row.maxPoints === 5)).toBe(true)
  })
})
