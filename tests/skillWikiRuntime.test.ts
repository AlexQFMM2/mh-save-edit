import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { SkillCatalogRepository } from '../api/catalog/skillRepository'
import { hasSkillWikiDetails } from '../api/catalog/skillWikiDetails'

describe('optional Wiki details in injected runtime catalogs', () => {
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('reads and searches every prepared detail for %s', gameId => {
    const db = new Database(new URL(`../data/${gameId}.sqlite`, import.meta.url).pathname, { readonly: true, fileMustExist: true })
    try {
      // Older injected runtime assets remain supported; synthetic tests exercise
      // that fallback independently. Real Wiki prose never enters this fixture.
      if (!hasSkillWikiDetails(db)) return
      const repo = new SkillCatalogRepository(db)
      const rows = db.prepare('SELECT activation_key,skill_id,description_cn,source_version FROM catalog_skill_effect_details WHERE game_id=?').all(gameId) as { activation_key: string; skill_id: number; description_cn: string; source_version: string }[]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const detail = repo.getSkill({ gameId, skillId: row.skill_id })
        const activation = detail?.activations.find(a => a.activationKey === row.activation_key)
        expect(activation?.wikiDetail?.descriptionCn).toBe(row.description_cn)
        expect(activation?.wikiDetail?.sourceVersion).toBe(row.source_version)
        const original = db.prepare('SELECT description_cn FROM catalog_skill_activations WHERE game_id=? AND activation_key=?').get(gameId, row.activation_key) as { description_cn: string }
        expect(activation?.descriptionCn).toBe(original.description_cn ?? '')
        const result = repo.searchSkills({ gameId, query: row.description_cn.slice(0, 60), targetSkillId: row.skill_id, includePlaceholders: true })
        expect(result.items.some(s => s.skillId === row.skill_id)).toBe(true)
      }
      console.log(`${gameId}: ${rows.length} Wiki details read and searched through repository`)
    } finally { db.close() }
  }, 60000)
})
