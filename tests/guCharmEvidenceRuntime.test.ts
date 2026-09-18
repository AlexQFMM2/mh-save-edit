import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { validateCharm } from '../api/loadout/charm'
import { searchCharms } from '../api/loadout/searchCharms'
import { SearchControl } from '../api/loadout/searchControl'
import { getGameLoadoutRules } from '../api/loadout/rules'
import { guFiveSkillFixture } from './fixtures/guFiveSkill'
import type { AutoLoadoutRequest } from '../api/loadout/types'

const legacyFile = process.env.GU_LEGACY_DATABASE
const preparedFile = process.env.GU_FIVE_SKILL_DATABASE
// Explicit private integration inputs; public synthetic migration tests do not
// depend on an archived release or contain copied native data.
describe.skipIf(!legacyFile || !preparedFile)('private GU old-asset evidence boundary', () => {
  it('keeps the unprepared legacy asset unknown and excludes unproven generated charms', async () => {
    const db = new Database(legacyFile!, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mhgu').getSnapshot()
      const { loadout, targets } = guFiveSkillFixture(snapshot)
      expect(snapshot.charmSlotRules!.length).toBeGreaterThan(0)
      expect(snapshot.charmSlotRules!.every(row => row.evidence === 'reference')).toBe(true)
      expect(validateCharm(snapshot, loadout.charm!).legality).toBe('unknown')
      const request: AutoLoadoutRequest = { requestId: 'legacy-unknown', gameId: 'mhgu', dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets, timeoutMs: 30000, resultLimit: 1 }
      const control = new SearchControl(request, { checkpoint: async () => {}, progress: () => {} })
      const result = await searchCharms(snapshot, new Set([...targets.map(row => row.skillId), getGameLoadoutRules('mhgu').torsoSkillId, 204, 205]), control)
      expect(result.candidates).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    } finally { db.close() }
  })
  it('admits the prepared sample but downgrades a changed catalog with a stale audit', () => {
    const source = new Database(preparedFile!, { readonly: true, fileMustExist: true })
    let copy: Database.Database | undefined
    try {
      const snapshot = new LoadoutCatalogRepository(source, 'mhgu').getSnapshot()
      const { loadout } = guFiveSkillFixture(snapshot)
      expect(snapshot.charmSlotRules!.every(row => row.evidence === 'verified')).toBe(true)
      expect(validateCharm(snapshot, loadout.charm!).legality).toBe('confirmed')
      // Mutate only a private in-memory clone, never the prepared source file.
      copy = new Database(source.serialize())
      copy.prepare('UPDATE cn__talisman_slot_thresholds SET slot1_threshold=CASE WHEN slot1_threshold=0 THEN 1 ELSE slot1_threshold-1 END WHERE rarity_marker=100 AND fulfillment=1').run()
      const stale = new LoadoutCatalogRepository(copy, 'mhgu').getSnapshot()
      expect(stale.charmSlotRules!.every(row => row.evidence === 'reference')).toBe(true)
      expect(validateCharm(stale, loadout.charm!).legality).toBe('unknown')
    } finally { copy?.close(); source.close() }
  })
})
