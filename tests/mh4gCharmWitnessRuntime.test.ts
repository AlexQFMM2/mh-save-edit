import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { validateCharm } from '../api/loadout/charm'
import { searchCharms } from '../api/loadout/searchCharms'
import type { SearchControl } from '../api/loadout/searchControl'

const file = process.env.MH4G_RUNTIME_DATABASE || fileURLToPath(new URL('../data/mh4g.sqlite', import.meta.url))

describe.skipIf(!existsSync(file))('private real-catalog witnessed 4G candidates', () => {
  it('produces only hand-revalidated outcomes while explicitly reporting bounded coverage', async () => {
    const db = new Database(file, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mh4g').getSnapshot()
      expect(snapshot.mh4gCharmRulesIssue).toBeUndefined()
      expect(snapshot.mh4gCharmWitnessIssue).toBeUndefined()
      expect(snapshot.mh4gCharmWitnessSource).toContain('mh4g-reviewed-outcomes:')
      expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_mh4g_charm_execution'").get()).toBeUndefined()
      const witnesses = snapshot.mh4gCharmWitnesses!
      expect(witnesses.length).toBeGreaterThan(0)
      const relevant = new Set(witnesses.slice(0, 3).flatMap(row => [row[2], row[4]]).filter(Boolean))
      let ticks = 0
      const result = await searchCharms(snapshot, relevant, { tick: async () => { ticks++ } } as unknown as SearchControl)
      expect(ticks).toBe(witnesses.length)
      expect(result.candidates.length).toBeGreaterThan(0)
      expect(result.warnings.some(message => message.includes('未穷举'))).toBe(true)
      const outcomes = new Set(witnesses.map(row => row.slice(0, 6).join(':')))
      for (const charm of result.candidates) {
        expect(charm.skill1).not.toBeNull()
        expect(charm.legality).toBe('confirmed')
        expect(validateCharm(snapshot, charm).legality).toBe('confirmed')
        expect(charm.issues.some(issue => issue.message.includes('正常游玩初态可达性'))).toBe(true)
        expect(outcomes.has([charm.classId, charm.slots, charm.skill1?.skillId ?? 0, charm.skill1?.points ?? 0, charm.skill2?.skillId ?? 0, charm.skill2?.points ?? 0].join(':'))).toBe(true)
      }
      console.info(`Private witnessed candidates: ${witnesses.length} unique outcomes, ${result.candidates.length} candidates for ${relevant.size} skills; bounded coverage preserved.`)
    } finally { db.close() }
  })
})
