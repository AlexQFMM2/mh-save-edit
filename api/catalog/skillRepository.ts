import type Database from 'better-sqlite3'
import type { SkillActivation, SkillArmorRelation, SkillDecorationRelation, SkillDetail, SkillIdentity } from './types'

type Row = Record<string, unknown>
const int = (value: unknown) => Number(value)
const text = (value: unknown) => String(value ?? '')

export class SkillCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  getSkill(identity: SkillIdentity): SkillDetail | null {
    const skill = this.db.prepare('SELECT name_cn,name_en FROM catalog_skills WHERE game_id=? AND skill_id=?').get(identity.gameId, identity.skillId) as Row | undefined
    if (!skill) return null
    const activations = this.db.prepare(`SELECT active_skill_name_cn name_cn,active_skill_name_en name_en FROM catalog_decoration_skills WHERE game_id=? AND skill_id=? AND active_skill_name_cn IS NOT NULL AND active_skill_name_cn<>'' UNION SELECT active_skill_name_cn,active_skill_name_en FROM catalog_armor_skills WHERE game_id=? AND skill_id=? AND active_skill_name_cn IS NOT NULL AND active_skill_name_cn<>'' ORDER BY name_cn`).all(identity.gameId, identity.skillId, identity.gameId, identity.skillId) as Row[]
    const decorations = this.db.prepare(`SELECT d.save_id,d.name_cn,d.name_en,d.slots,d.icon_path,sk.points FROM catalog_decoration_skills sk JOIN catalog_decorations d ON d.game_id=sk.game_id AND d.save_id=sk.decoration_save_id WHERE sk.game_id=? AND sk.skill_id=? AND d.is_placeholder=0 ORDER BY sk.points DESC,d.slots ASC,d.save_id ASC`).all(identity.gameId, identity.skillId) as Row[]
    const armors = this.db.prepare(`SELECT a.dex_id,a.name_cn,a.name_en,a.part,a.icon_path,sk.points FROM catalog_armor_skills sk JOIN catalog_armors a ON a.game_id=sk.game_id AND a.dex_id=sk.armor_dex_id WHERE sk.game_id=? AND sk.skill_id=? AND a.is_placeholder=0 ORDER BY sk.points DESC,a.part,a.dex_id`).all(identity.gameId, identity.skillId) as Row[]
    return {
      ...identity,
      nameCn: text(skill.name_cn),
      nameEn: text(skill.name_en),
      activations: activations.map((row): SkillActivation => ({ nameCn: text(row.name_cn), nameEn: text(row.name_en) })),
      decorations: decorations.map((row): SkillDecorationRelation => ({ gameId: identity.gameId, saveId: int(row.save_id), nameCn: text(row.name_cn), nameEn: text(row.name_en), points: int(row.points), slots: int(row.slots), iconPath: row.icon_path ? text(row.icon_path) : null })),
      armors: armors.map((row): SkillArmorRelation => ({ gameId: identity.gameId, dexId: int(row.dex_id), nameCn: text(row.name_cn), nameEn: text(row.name_en), points: int(row.points), part: row.part as SkillArmorRelation['part'], iconPath: row.icon_path ? text(row.icon_path) : null })),
    }
  }
}
