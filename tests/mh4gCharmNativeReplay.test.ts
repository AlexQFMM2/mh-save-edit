import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { replayMh4gAppraisal } from '../api/loadout/mh4gCharmReplay'
import { checkMh4gAppraisal } from '../api/loadout/mh4gCharmRules'

const databasePath = fileURLToPath(new URL('../data/mh4g.sqlite', import.meta.url))
function hasNativeInput(): boolean {
  if (!existsSync(databasePath)) return false
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })
  try { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_mh4g_charm_native'").get()) }
  finally { db.close() }
}

// Older private Release assets intentionally skip this native-only integration
// check; synthetic tests separately verify their explicit evidence degradation.
describe.skipIf(!hasNativeInput())('private MH4G native replay consistency', () => {
  it('replays 6144 deterministic inputs without violating the shared native constraints', () => {
    const db = new Database(databasePath, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mh4g').getBootstrap()
      expect(snapshot.mh4gCharmRulesIssue).toBeUndefined()
      const rules = snapshot.mh4gCharmRules!
      expect(rules.groups).toHaveLength(6)
      const digest = createHash('sha256')
      const groups = []
      for (const group of rules.groups) {
        const classes = new Set<number>()
        const rows = new Set<number>()
        const slots = new Set<number>()
        let negativeB = 0, absentB = 0
        for (let seed = 0; seed < 1024; seed++) {
          const result = replayMh4gAppraisal(group, [seed, (seed * 977 + 13) & 65535])
          const check = checkMh4gAppraisal(rules, { classId: result.classId, slots: result.slots, skill1: result.skill1Id ? { skillId: result.skill1Id, points: result.skill1Points, nameCn: '' } : null, skill2: result.skill2Id ? { skillId: result.skill2Id, points: result.skill2Points, nameCn: '' } : null })
          if (check.status !== 'satisfied') throw new Error(`Replay disagrees with static rules: ${JSON.stringify({ result, check })}`)
          expect(check.fulfillment).toBe(result.fulfillment)
          expect(check.row).toBe(result.row)
          digest.update(JSON.stringify(result) + '\n')
          classes.add(result.classId); rows.add(result.row); slots.add(result.slots)
          if (result.skill2Points < 0) negativeB++
          if (!result.skill2Id) absentB++
        }
        expect([...classes].sort((a, b) => a - b)).toEqual(group.classes.map(b => b.classId))
        groups.push({ groupIndex: group.groupIndex, cases: 1024, classes: [...classes].sort((a, b) => a - b), rowCount: rows.size, slots: [...slots].sort(), negativeB, absentB })
      }
      console.info('MH4G_FUNCTIONAL_REPLAY_AUDIT', JSON.stringify({ cases: 6144, digest: digest.digest('hex'), evidence: 'functional-model-consistency-only', groups }))
    } finally { db.close() }
  })
})
