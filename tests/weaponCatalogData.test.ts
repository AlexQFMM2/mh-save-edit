import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '..')

const expected = {
  mh3g: { formal: 1421, nodes: 1421, edges: 1238, roots: 183, remoteStart: 10 },
  mh4g: { formal: 2324, nodes: 2331, edges: 1930, roots: 401, remoteStart: 12 },
  mhgu: { formal: 10911, nodes: 10911, edges: 10117, roots: 794, remoteStart: 12 },
} as const

function audit(gameId: keyof typeof expected) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, 'data/manifests', `${gameId}-weapons-audit.json`), 'utf8'))
}

function database(gameId: keyof typeof expected) {
  return new Database(path.join(projectRoot, 'data', `${gameId}.sqlite`), { readonly: true })
}

describe('generated weapon catalog data', () => {
  for (const [gameId, gameExpected] of Object.entries(expected) as [keyof typeof expected, (typeof expected)[keyof typeof expected]][]) {
    it(`${gameId} preserves the audited identities and derivation graph`, () => {
      const report = audit(gameId)
      expect(report.derivation).toMatchObject({
        nodes: gameExpected.nodes,
        edges: gameExpected.edges,
        roots: gameExpected.roots,
      })
      expect(report.crosswalk.includedFormal).toBe(gameExpected.formal)
      expect(report.integrity.missingIcons).toEqual([])
      expect(report.integrity.missingSharpness).toEqual([])
      expect(report.integrity.materialForeignKeyMisses).toEqual([])
      expect(report.integrity.unknownEnums).toEqual([])
      expect(report.integrity.productionPriceMismatches).toEqual([])
    })

    it(`${gameId} stores sharpness only for melee weapons`, () => {
      const db = database(gameId)
      const missingMelee = db.prepare(`SELECT count(*) count FROM catalog_weapons w
        WHERE game_id = ? AND is_placeholder = 0 AND type_id < ?
        AND NOT EXISTS (SELECT 1 FROM catalog_weapon_sharpness s WHERE s.game_id=w.game_id AND s.weapon_key=w.weapon_key)`).get(gameId, gameExpected.remoteStart) as { count: number }
      const remoteSharpness = db.prepare(`SELECT count(*) count FROM catalog_weapon_sharpness s JOIN catalog_weapons w
        ON w.game_id=s.game_id AND w.weapon_key=s.weapon_key WHERE w.game_id=? AND w.type_id>=?`).get(gameId, gameExpected.remoteStart) as { count: number }
      const invalidCutoff = db.prepare(`SELECT count(*) count FROM catalog_weapon_sharpness WHERE game_id=?
        AND (base_cutoff < 0 OR handicraft_1_cutoff < base_cutoff
        OR handicraft_2_cutoff IS NOT NULL AND handicraft_2_cutoff < handicraft_1_cutoff)`).get(gameId) as { count: number }
      expect(missingMelee.count).toBe(0)
      expect(remoteSharpness.count).toBe(0)
      expect(invalidCutoff.count).toBe(0)
      db.close()
    })
  }

  it('keeps MH4G relics out and records every exceptional identity class', () => {
    const report = audit('mh4g')
    expect(report.crosswalk.excludedRelics).toBe(435)
    expect(report.crosswalk.placeholders).toBe(62)
    expect(report.crosswalk.excluded).toBe(28)
    expect(report.crosswalk.ignoredDexNodes).toHaveLength(7)
  })

  it('stores separate MHGU and MHXX model references for Glavenus great sword family 60', () => {
    const db = database('mhgu')
    const rows = db.prepare(`SELECT weapon_key,variant_id,integer_value FROM catalog_weapon_content_variants
      WHERE game_id='mhgu' AND weapon_key='7:60:0' ORDER BY variant_id`).all()
    expect(rows).toEqual([
      { weapon_key: '7:60:0', variant_id: 'mhgu-switch', integer_value: 134 },
      { weapon_key: '7:60:0', variant_id: 'mhxx-3ds', integer_value: 112 },
    ])
    db.close()
  })
})
