import type Database from 'better-sqlite3'
import type { GameId } from '../core/loadout'
import type {
  MonsterAilment, MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterDrop,
  MonsterIdentity, MonsterQuestAppearance, MonsterSummary, MonsterTrap, MonsterWeakness,
  QuestAvailability, QuestIdentity, QuestModifier, QuestMonsterTarget,
} from './types'

type Row = Record<string, unknown>
const int = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0
const nullableInt = (value: unknown): number | null => value == null ? null : int(value)
const bool = (value: unknown): boolean => value === 1 || value === true || value === '1'

export class MonsterCatalogRepository {
  constructor(private readonly db: Database.Database) {}

  searchMonsters(filters: MonsterCatalogFilters): MonsterSummary[] {
    const where = ['game_id=?']
    const values: unknown[] = [filters.gameId]
    if (filters.targetMonsterId != null) {
      where.push('monster_id=?')
      values.push(filters.targetMonsterId)
    } else {
      if (!filters.includePlaceholders) where.push('is_placeholder=0')
      const query = filters.query?.trim()
      if (query) {
        const numeric = /^0x[0-9a-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
        const clauses = ['name_cn LIKE ?', 'name_en LIKE ?', 'name_jp LIKE ?']
        const like = `%${query}%`
        values.push(like, like, like)
        if (numeric != null) { clauses.push('monster_id=?'); values.push(numeric) }
        where.push(`(${clauses.join(' OR ')})`)
      }
    }
    const rows = this.db.prepare(`SELECT * FROM catalog_monsters WHERE ${where.join(' AND ')} ORDER BY monster_id LIMIT 200`).all(...values) as Row[]
    return rows.map(toMonsterSummary)
  }

  getMonster(identity: MonsterIdentity): MonsterDetail | null {
    if (identity.gameId === 'mhp2g') throw new Error('P2G requires its native monster repository')
    const gameId = identity.gameId
    const monster = this.db.prepare('SELECT * FROM catalog_monsters WHERE game_id=? AND monster_id=?').get(identity.gameId, identity.monsterId) as Row | undefined
    if (!monster) return null
    const weakness = (this.db.prepare('SELECT * FROM catalog_monster_weakness WHERE game_id=? AND monster_id=? ORDER BY part_order,row_id').all(identity.gameId, identity.monsterId) as Row[]).map(toWeakness)
    const ailments = (this.db.prepare('SELECT * FROM catalog_monster_ailments WHERE game_id=? AND monster_id=? AND is_hidden=0 ORDER BY status_id,row_id').all(identity.gameId, identity.monsterId) as Row[]).map(toAilment)
    const traps = (this.db.prepare('SELECT * FROM catalog_monster_traps WHERE game_id=? AND monster_id=? ORDER BY trap_id,row_id').all(identity.gameId, identity.monsterId) as Row[]).map(toTrap)
    const drops = (this.db.prepare('SELECT * FROM catalog_monster_drops WHERE game_id=? AND monster_id=? ORDER BY rank_id,drop_type_id,probability DESC,row_id').all(identity.gameId, identity.monsterId) as Row[]).map((row): MonsterDrop => ({
      id: int(row.row_id), rankId: int(row.rank_id), rankNameCn: String(row.rank_name_cn), rankNameEn: String(row.rank_name_en),
      methodId: int(row.drop_type_id), methodNameCn: String(row.method_name_cn), methodNameEn: String(row.method_name_en),
      item: { gameId, saveId: int(row.item_save_id), nameCn: String(row.item_name_cn), nameEn: String(row.item_name_en) },
      quantity: int(row.quantity), probability: Number(row.probability) * 100,
    }))
    const questRows = this.db.prepare(`SELECT DISTINCT q.* FROM catalog_quests q JOIN catalog_quest_targets t ON t.game_id=q.game_id AND t.quest_key=q.quest_key WHERE t.game_id=? AND t.monster_id=? ORDER BY q.level_id,q.dex_id,q.quest_key`).all(identity.gameId, identity.monsterId) as Row[]
    return { ...toMonsterSummary(monster), weakness, ailments, traps, drops, quests: this.decorateQuests(identity.gameId, questRows) }
  }

  getMonsterFacets(gameId: GameId): MonsterCatalogFacets {
    const monsterCount = int((this.db.prepare('SELECT count(*) count FROM catalog_monsters WHERE game_id=? AND is_placeholder=0').get(gameId) as Row).count)
    const statusNames = (this.db.prepare('SELECT status_id,status_name_cn,status_name_en FROM catalog_monster_ailments WHERE game_id=? AND is_hidden=0 GROUP BY status_id,status_name_cn,status_name_en ORDER BY status_id').all(gameId) as Row[]).map((row) => ({ statusId: int(row.status_id), nameCn: String(row.status_name_cn), nameEn: String(row.status_name_en) }))
    const trapNames = (this.db.prepare('SELECT trap_id,trap_name_cn,trap_name_en FROM catalog_monster_traps WHERE game_id=? GROUP BY trap_id,trap_name_cn,trap_name_en ORDER BY trap_id').all(gameId) as Row[]).map((row) => ({ trapId: int(row.trap_id), nameCn: String(row.trap_name_cn), nameEn: String(row.trap_name_en) }))
    const questAvailabilities = (this.db.prepare('SELECT DISTINCT availability FROM catalog_quests WHERE game_id=? ORDER BY availability').all(gameId) as Row[]).map((row) => String(row.availability) as QuestAvailability)
    return { monsterCount, statusNames, trapNames, questAvailabilities }
  }

  getQuest(identity: QuestIdentity): MonsterQuestAppearance | null {
    if(identity.gameId==='mhp2g')return null
    const row = this.db.prepare('SELECT * FROM catalog_quests WHERE game_id=? AND quest_key=?').get(identity.gameId, identity.questKey) as Row | undefined
    return row ? this.decorateQuests(identity.gameId, [row])[0] : null
  }

  private decorateQuests(gameId: GameId, rows: Row[]): MonsterQuestAppearance[] {
    if (!rows.length) return []
    const keys = rows.map((row) => String(row.quest_key))
    const marks = keys.map(() => '?').join(',')
    const targets = this.db.prepare(`SELECT t.*,m.name_cn,m.name_en,m.icon_small_path FROM catalog_quest_targets t JOIN catalog_monsters m ON m.game_id=t.game_id AND m.monster_id=t.monster_id WHERE t.game_id=? AND t.quest_key IN (${marks}) ORDER BY t.quest_key,t.slot,t.row_id`).all(gameId, ...keys) as Row[]
    const modifiers = this.db.prepare(`SELECT * FROM catalog_quest_modifiers WHERE game_id=? AND quest_key IN (${marks}) ORDER BY quest_key,slot,row_id`).all(gameId, ...keys) as Row[]
    const targetsByQuest = new Map<string, QuestMonsterTarget[]>()
    for (const row of targets) {
      const key = String(row.quest_key)
      targetsByQuest.set(key, [...(targetsByQuest.get(key) ?? []), { gameId, monsterId: int(row.monster_id), nameCn: String(row.name_cn), nameEn: String(row.name_en), iconPath: row.icon_small_path ? String(row.icon_small_path) : null, slot: int(row.slot), sourceKind: String(row.source_kind) }])
    }
    const modifiersByQuest = new Map<string, QuestModifier[]>()
    for (const row of modifiers) {
      const key = String(row.quest_key)
      modifiersByQuest.set(key, [...(modifiersByQuest.get(key) ?? []), { markerId: int(row.marker_id), nameCn: String(row.marker_name_cn), slot: int(row.slot) }])
    }
    return rows.map((row) => {
      const questKey = String(row.quest_key)
      return {
        gameId, questKey, dexId: nullableInt(row.dex_id), nativeId: row.native_id == null ? null : String(row.native_id), availability: String(row.availability) as QuestAvailability,
        nameCn: String(row.name_cn), nameEn: String(row.name_en), nameJp: String(row.name_jp), goalCn: String(row.goal_cn), goalEn: String(row.goal_en), subGoalCn: String(row.sub_goal_cn), subGoalEn: String(row.sub_goal_en),
        levelId: int(row.level_id), levelNameCn: String(row.level_name_cn), levelNameEn: String(row.level_name_en), questTypeId: int(row.quest_type_id), questTypeNameCn: String(row.quest_type_name_cn), questTypeNameEn: String(row.quest_type_name_en),
        locationId: int(row.location_id), locationNameCn: String(row.location_name_cn), locationNameEn: String(row.location_name_en), timeMinutes: nullableInt(row.time_minutes), fee: nullableInt(row.fee), reward: nullableInt(row.reward), reward2: nullableInt(row.reward2), hrp: nullableInt(row.hrp), hrp2: nullableInt(row.hrp2),
        monsters: targetsByQuest.get(questKey) ?? [], modifiers: modifiersByQuest.get(questKey) ?? [],
      }
    })
  }
}

function toMonsterSummary(row: Row): MonsterSummary {
  return { gameId: String(row.game_id) as GameId, monsterId: int(row.monster_id), nameCn: String(row.name_cn), nameEn: String(row.name_en), nameJp: String(row.name_jp), iconSmallPath: row.icon_small_path ? String(row.icon_small_path) : null, iconLargePath: row.icon_large_path ? String(row.icon_large_path) : null, isPlaceholder: bool(row.is_placeholder) }
}
function toWeakness(row: Row): MonsterWeakness {
  return { id: int(row.row_id), partId: int(row.part_id), partOrder: int(row.part_order), partNameCn: String(row.part_name_cn), partNameEn: String(row.part_name_en), conditionCn: String(row.condition_cn), conditionEn: String(row.condition_en), cut: int(row.cut), impact: int(row.impact), shot: int(row.shot), fire: int(row.fire), water: int(row.water), thunder: int(row.thunder), ice: int(row.ice), dragon: int(row.dragon), stun: int(row.stun) }
}
function toAilment(row: Row): MonsterAilment {
  return { id: int(row.row_id), statusId: int(row.status_id), nameCn: String(row.status_name_cn), nameEn: String(row.status_name_en), toleranceInitial: nullableInt(row.tolerance_initial), toleranceIncrease: nullableInt(row.tolerance_increase), toleranceMax: nullableInt(row.tolerance_max), duration: nullableInt(row.duration), damage: nullableInt(row.damage) }
}
function toTrap(row: Row): MonsterTrap {
  return { id: int(row.row_id), trapId: int(row.trap_id), nameCn: String(row.trap_name_cn), nameEn: String(row.trap_name_en), isEffective: bool(row.is_effective), duration: nullableInt(row.duration), durationEnraged: nullableInt(row.duration_enraged), durationFatigued: nullableInt(row.duration_fatigued) }
}
