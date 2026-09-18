import Database from 'better-sqlite3'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { calculateLoadout } from '../api/loadout/calculator'
import { validateCharm } from '../api/loadout/charm'
import { guFiveSkillFixture } from './fixtures/guFiveSkill'
import type { AutoLoadoutProgress, AutoLoadoutRequest, AutoLoadoutResult } from '../api/loadout/types'

const workerFile = process.env.GU_BUILT_WORKER
const oldPrepared = process.env.GU_FIVE_SKILL_DATABASE
const canonical = process.env.GU_CANONICAL_DATABASE
const runtime = fileURLToPath(new URL('../data/mhgu.sqlite', import.meta.url))

describe.skipIf(!workerFile)('compiled GU worker with prepared private catalogs', () => {
  for (const [label, file] of [['runtime', runtime], ['upgraded-old-asset', oldPrepared], ['canonical', canonical]]) {
  it.skipIf(!file)(`finds five results from a blank armor/charm draft: ${label}`, async () => {
    const db = new Database(file!, { readonly: true, fileMustExist: true })
    let worker: Worker | undefined
    try {
      const snapshot = new LoadoutCatalogRepository(db, 'mhgu').getSnapshot()
      const { loadout, targets } = guFiveSkillFixture(snapshot)
      loadout.armor = {}
      loadout.charm = null
      const request: AutoLoadoutRequest = { requestId: `built-${label}`, gameId: 'mhgu', dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets, resultLimit: 5, timeoutMs: 30000 }
      worker = new Worker(path.resolve(workerFile!))
      const active = worker
      const report = await new Promise<{ results: AutoLoadoutResult[]; progress: AutoLoadoutProgress }>((resolve, reject) => {
        let settled = false, started = false
        const timer = setTimeout(() => finish(new Error('Compiled GU worker exceeded its 30-second budget plus IPC allowance')), 35000)
        const finish = (error?: Error, value?: { results: AutoLoadoutResult[]; progress: AutoLoadoutProgress }) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          if (error) reject(error); else resolve(value!)
        }
        active.on('error', error => finish(error))
        active.on('exit', code => { if (!settled) finish(new Error(`Worker exited before completion: ${code}`)) })
        active.on('message', (message: { type: string; error?: string; results?: AutoLoadoutResult[]; value?: AutoLoadoutProgress }) => {
          if (message.type === 'ready' && !started) { started = true; active.postMessage({ type: 'start', snapshot, request }) }
          if (message.type === 'error') finish(new Error(message.error))
          if (message.type === 'cancelled') finish(new Error('Unexpected worker cancellation'))
          if (message.type === 'finished') {
            if (!message.results || !message.value) finish(new Error('Incomplete worker result protocol'))
            else finish(undefined, { results: message.results, progress: message.value })
          }
        })
      })
      console.info('GU_BUILT_WORKER', JSON.stringify({ label, dataVersion: snapshot.dataVersion, count: report.results.length, elapsedMs: report.progress.elapsedMs, reason: report.progress.incompleteReason }))
      expect(report.results).toHaveLength(5)
      expect(new Set(report.results.map(row => row.fingerprint)).size).toBe(5)
      expect(report.progress.elapsedMs).toBeLessThan(30000)
      expect(report.progress.incompleteReason).toBe('candidate-bound')
      expect(report.progress.coverageWarnings).toEqual([])
      for (const result of report.results) {
        const calculation = calculateLoadout(snapshot, result.loadout)
        expect(calculation.encoding).toBe('encodable')
        for (const target of targets) expect(calculation.skills.find(row => row.skillId === target.skillId)?.total ?? 0).toBeGreaterThanOrEqual(target.threshold)
        if (result.loadout.charm) expect(validateCharm(snapshot, result.loadout.charm).legality).toBe('confirmed')
      }
      expect(request.baseLoadout.armor).toEqual({})
      expect(request.baseLoadout.charm).toBeNull()
    } finally { await worker?.terminate(); db.close() }
  }, 40000)
  }
})
