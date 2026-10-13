import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { P2gLoadoutCatalogRepository } from '../api/loadout/p2gRepository'
import { readP2gProfile } from '../api/save/p2g/profile'
import { p2gEquipmentKey, p2gSaveIdentity } from '../api/save/p2g/identity'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'

// These integration checks use only the public runtime ZIP, never research inputs
// or a user's save. A release must include these assets; missing files must fail.
const dataDir = path.resolve(process.env.RUNTIME_DATA_DIR ?? 'data')
const assetRoot = path.dirname(dataDir)
const games = ['mh3g', 'mh4g', 'mhgu', 'mhp2g'] as const
const open = (name: string) => new Database(path.join(dataDir, `${name}.sqlite`), { readonly: true, fileMustExist: true })

describe('public runtime assets', () => {
  it('loads the P2G save format profile and inverse substitution tables', () => {
    const profile = readP2gProfile(dataDir)
    expect(profile.encode).toHaveLength(256)
    expect(profile.rankGates).toHaveLength(8)
    for (let i = 0; i < 256; i++) expect(profile.decode[profile.encode[i]]).toBe(i)
  })

  it('binds the terminology dictionary to the exact identities of all four catalogs', () => {
    const dictionary = open('item-terminology')
    try {
      expect(dictionary.pragma('integrity_check', { simple: true })).toBe('ok')
      const terms = new ItemTermRepository(dictionary)
      for (const game of games) {
        const db = open(game)
        try {
          expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
          terms.bindCatalog(db, game)
          const result = terms.search({ gameId: game, pageSize: 1 })
          expect(result.available).toBe(true)
          expect(result.total).toBeGreaterThan(0)
          expect(result.items[0].members.some(member => member.gameId === game)).toBe(true)
        } finally { db.close() }
      }
    } finally { dictionary.close() }
  })

  it('loads the complete P2G loadout and resolves equipment identities and icons', () => {
    const db = open('mhp2g')
    try {
      expect(db.pragma('foreign_key_check')).toEqual([])
      const snapshot = new P2gLoadoutCatalogRepository(db).getSnapshot()
      expect(snapshot.weapons).toHaveLength(1501)
      expect(snapshot.armors).toHaveLength(2081)
      expect(snapshot.decorations).toHaveLength(168)
      expect(snapshot.skills).toHaveLength(99)
      expect(snapshot.charmClasses).toEqual([])
      for (const equipment of [...snapshot.weapons, ...snapshot.armors]) {
        const key = 'weaponKey' in equipment ? equipment.weaponKey : equipment.armorKey
        expect(key).toBeTruthy()
        const identity = p2gSaveIdentity(key!)
        expect(p2gEquipmentKey(identity.saveType, identity.saveId)).toBe(key)
      }
      const icons = new Set([...snapshot.weapons, ...snapshot.armors, ...snapshot.decorations].map(row => row.iconPath))
      for (const icon of icons) {
        expect(icon).toMatch(/^catalog\/icons\/[a-f0-9]{64}\.png$/)
        expect(existsSync(path.join(assetRoot, 'ui/public/assets', icon!))).toBe(true)
      }
    } finally { db.close() }
  })
})
