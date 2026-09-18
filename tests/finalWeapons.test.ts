import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { readFinalWeaponKeys } from '../api/catalog/finalWeapons'
import { weaponCatalogFiltersSchema } from '../api/catalog/schemas'
import { loadoutWeaponFiltersSchema } from '../api/loadout/schemas'
import type { GameId } from '../api/core/loadout'

const opened: Database.Database[] = []
afterEach(() => opened.splice(0).forEach(db => db.close()))
function fixture() {
  const db = new Database(':memory:'); opened.push(db)
  db.exec(`CREATE TABLE catalog_weapons(game_id TEXT, weapon_key TEXT, type_id INTEGER, save_type INTEGER, save_id INTEGER, save_level INTEGER, dex_id INTEGER, is_placeholder INTEGER, is_final_form INTEGER);
    CREATE TABLE catalog_weapon_edges(game_id TEXT, parent_weapon_key TEXT, child_weapon_key TEXT);`)
  let identity = 0
  const add = (game: GameId, key: string, overrides: Record<string, number | null> = {}) => db.prepare('INSERT INTO catalog_weapons VALUES (@game,@key,@type_id,@save_type,@save_id,@save_level,@dex_id,@is_placeholder,@is_final_form)').run({ game, key, type_id: 1, save_type: 7, save_id: ++identity, save_level: game === 'mhgu' ? 0 : null, dex_id: identity, is_placeholder: 0, is_final_form: 1, ...overrides })
  return { db, add }
}
describe('confirmed final weapon domain', () => {
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('requires positive leaf evidence and rejects unknowns and outgoing edges for %s', game => {
    const { db, add } = fixture()
    add(game, 'leaf'); add(game, 'branch'); add(game, 'unknown', { is_final_form: 0 }); add(game, 'unmapped', { dex_id: null }); add(game, 'placeholder', { is_placeholder: 1 })
    db.prepare('INSERT INTO catalog_weapon_edges VALUES (?,?,?)').run(game, 'branch', 'leaf')
    // An edge in another game's namespace must not affect this leaf.
    db.prepare('INSERT INTO catalog_weapon_edges VALUES (?,?,?)').run(game === 'mhgu' ? 'mh3g' : 'mhgu', 'leaf', 'unrelated')
    expect([...readFinalWeaponKeys(db, game)]).toEqual(['leaf'])
  })
  it('does not treat a GU intermediate level as final even when its Dex flag says leaf', () => {
    const { db, add } = fixture()
    add('mhgu', 'lv1', { save_id: 9, save_level: 0 }); add('mhgu', 'lv2', { save_id: 9, save_level: 1 })
    add('mhgu', 'unknown-level', { save_level: null })
    add('mhgu', 'before-placeholder', { save_id: 10, save_level: 0 }); add('mhgu', 'native-higher', { save_id: 10, save_level: 2, is_placeholder: 1 })
    add('mhgu', 'other-type', { save_id: 9, save_level: 4, type_id: 2, save_type: 8 })
    expect([...readFinalWeaponKeys(db, 'mhgu')]).toEqual(['lv2', 'other-type'])
  })
  it('accepts only boolean final filters on both IPC schemas', () => {
    for (const schema of [weaponCatalogFiltersSchema, loadoutWeaponFiltersSchema]) {
      expect(schema.parse({ gameId: 'mhgu', finalOnly: true }).finalOnly).toBe(true)
      expect(schema.safeParse({ gameId: 'mhgu', finalOnly: 'true' }).success).toBe(false)
    }
  })
})
