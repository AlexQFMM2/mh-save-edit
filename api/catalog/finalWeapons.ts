import type Database from 'better-sqlite3'
import type { GameId } from '../core/loadout'

/** Alias w: positive Dex leaf evidence, no outgoing upgrade, and no higher native save level.
 * Missing mappings, placeholders and relic templates are not evidence of a final weapon.
 * The level lookup uses the existing (game_id,type_id,save_id,save_level) index.
 */
export const FINAL_WEAPON_SQL = `w.is_placeholder=0 AND w.dex_id IS NOT NULL AND w.is_final_form=1
  AND (w.game_id<>'mhgu' OR w.save_level IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM catalog_weapon_edges e WHERE e.game_id=w.game_id AND e.parent_weapon_key=w.weapon_key)
  AND NOT EXISTS (SELECT 1 FROM catalog_weapons n WHERE n.game_id=w.game_id AND n.type_id=w.type_id
    AND n.save_id=w.save_id AND n.save_type=w.save_type AND n.save_level>w.save_level)`

export function readFinalWeaponKeys(db: Database.Database, gameId: GameId): Set<string> {
  return new Set((db.prepare(`SELECT w.weapon_key FROM catalog_weapons w WHERE w.game_id=? AND ${FINAL_WEAPON_SQL}`).all(gameId) as { weapon_key: string }[]).map(row => row.weapon_key))
}
