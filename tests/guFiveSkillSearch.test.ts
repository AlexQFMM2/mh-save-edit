import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { calculateLoadout } from '../api/loadout/calculator'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { searchCharms } from '../api/loadout/searchCharms'
import { SearchControl } from '../api/loadout/searchControl'
import { getGameLoadoutRules } from '../api/loadout/rules'
import { validateCharm } from '../api/loadout/charm'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type AutoLoadoutProgress } from '../api/loadout/types'
import { GU_SAMPLE_TOTALS, guFiveSkillFixture } from './fixtures/guFiveSkill'

const dbFile = process.env.GU_FIVE_SKILL_DATABASE ?? fileURLToPath(new URL('../data/mhgu.sqlite', import.meta.url))
const context = { checkpoint: async () => { await new Promise<void>(resolve => setImmediate(resolve)) }, progress: (_value: AutoLoadoutProgress) => {} }
const key = (charm: { classId: number; slots: number; skill1: { skillId: number; points: number } | null; skill2: { skillId: number; points: number } | null }) => JSON.stringify([charm.classId, charm.slots, charm.skill1?.skillId, charm.skill1?.points, charm.skill2?.skillId, charm.skill2?.points])

describe('GU user five-skill regression with private real catalog', () => {
  it('recalculates the exact manual sample and includes its charm in automatic candidates', async () => {
    const db = new Database(dbFile, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mhgu').getSnapshot()
      const { loadout, targets } = guFiveSkillFixture(snapshot)
      const calculation = calculateLoadout(snapshot, loadout)
      for (const [name, total] of GU_SAMPLE_TOTALS) expect(calculation.skills.find(row => row.nameCn === name)?.total).toBe(total)
      expect(calculation.encoding).toBe('encodable')
      expect(validateCharm(snapshot, loadout.charm!).legality).toBe('confirmed')
      const request: AutoLoadoutRequest = { requestId: 'gu-five-candidates', gameId: 'mhgu', dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets, resultLimit: 1, timeoutMs: 30000 }
      const control = new SearchControl(request, context)
      const generated = await searchCharms(snapshot, new Set([...targets.map(row => row.skillId), getGameLoadoutRules('mhgu').torsoSkillId, 204, 205]), control)
      console.info('GU_CANDIDATE_BASELINE', JSON.stringify({ candidates: generated.candidates.length, elapsedMs: control.elapsedMs, warnings: generated.warnings, samplePresent: generated.candidates.some(row => key(row) === key(loadout.charm!)) }))
      expect(generated.candidates.some(row => key(row) === key(loadout.charm!))).toBe(true)
    } finally { db.close() }
  }, 35000)

  it.each(['decorations-only', 'fixed-charm', 'fully-open', 'fixed-charm-ui', 'fully-open-ui'] as const)('finds five skills within the original 30-second budget: %s', async mode => {
    const db = new Database(dbFile, { readonly: true, fileMustExist: true })
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mhgu').getSnapshot()
      const { loadout, targets, strictTargets } = guFiveSkillFixture(snapshot)
      const stage = mode.replace(/-ui$/, '')
      const requestedTargets = mode.endsWith('-ui') ? targets : strictTargets
      loadout.charm!.decorations = []
      loadout.charm!.lock = stage === 'fully-open' ? 'unlocked' : 'equipment'
      for (const part of ARMOR_LOADOUT_SLOTS) {
        loadout.armor[part]!.decorations = []
        loadout.armor[part]!.lock = stage === 'decorations-only' ? 'equipment' : 'unlocked'
      }
      const request: AutoLoadoutRequest = { requestId: `gu-five-${mode}`, gameId: 'mhgu', dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets: requestedTargets, resultLimit: 1, timeoutMs: 30000 }
      const before = structuredClone(request)
      let firstResultMs: number | null = null
      const stages: { stage: string; elapsedMs: number; checked: number; verified: number }[] = []
      const report = await runAutoLoadout(snapshot, request, { ...context, progress: value => {
        if (value.results > 0 && firstResultMs == null) firstResultMs = value.elapsedMs
        if (stages.at(-1)?.stage !== value.stage && stages.length < 100) stages.push({ stage: value.stage, elapsedMs: value.elapsedMs, checked: value.checked, verified: value.verified ?? 0 })
      } })
      console.info('GU_FIVE_SKILL_BASELINE', JSON.stringify({ mode, firstResultMs, progress: report.progress, stages }))
      expect(request).toEqual(before)
      expect(report.results.length).toBeGreaterThan(0)
      for (const result of report.results) {
        const verified = calculateLoadout(snapshot, result.loadout)
        expect(verified.encoding).toBe('encodable')
        for (const target of requestedTargets) expect(verified.skills.find(row => row.skillId === target.skillId)?.total ?? 0).toBeGreaterThanOrEqual(target.threshold)
        if (result.loadout.charm) expect(validateCharm(snapshot, result.loadout.charm).legality).toBe('confirmed')
      }
    } finally { db.close() }
  }, 35000)
})
