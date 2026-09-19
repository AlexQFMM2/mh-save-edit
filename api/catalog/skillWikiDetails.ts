import type Database from 'better-sqlite3'
import type { SkillActivation } from './types'

export const wikiIdentityJoin = `w.game_id=a.game_id AND w.activation_key=a.activation_key
  AND w.skill_id=a.skill_id AND w.dex_activation_id=a.dex_activation_id
  AND w.threshold=a.threshold AND w.name_jp=a.name_jp`

export function hasSkillWikiDetails(db: Database.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_skill_effect_details'").get())
}

export function readSkillWikiDetails(db: Database.Database, gameId: string, skillId: number): Map<string, NonNullable<SkillActivation['wikiDetail']>> {
  if (!hasSkillWikiDetails(db)) return new Map()
  const rows = db.prepare(`SELECT w.* FROM catalog_skill_effect_details w
    JOIN catalog_skill_activations a ON ${wikiIdentityJoin}
    WHERE a.game_id=? AND a.skill_id=?`).all(gameId, skillId) as {
      activation_key: string; description_cn: string; source_url: string; source_version: string; review_note: string
    }[]
  return new Map(rows.map(row => [row.activation_key, {
    descriptionCn: row.description_cn, sourceUrl: row.source_url,
    sourceVersion: row.source_version, reviewNote: row.review_note,
  }]))
}
