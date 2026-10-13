import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { AutoLoadoutJobService } from '../api/loadout/jobService'
import { p2gLoadoutFixture } from './fixtures/p2gLoadout'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { createEmptyLogicalLoadout, type AutoLoadoutRequest, type LoadoutCatalogSnapshot } from '../api/loadout/types'

class FakeWorker extends EventEmitter {
  messages: unknown[] = []
  terminated = false
  postMessage(message: unknown) { this.messages.push(message) }
  terminate() { this.terminated = true; return Promise.resolve(0) }
}

const directories: string[] = []
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }) })

const snapshot: LoadoutCatalogSnapshot = { gameId: 'mh3g', dataVersion: 'test', weapons: [], armors: [], decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }
const request = (): AutoLoadoutRequest => ({ requestId: crypto.randomUUID(), gameId: 'mh3g', dataVersion: 'test', baseLoadout: createEmptyLogicalLoadout('mh3g', 'test'), targets: [{ activationKey: 'skill:1', skillId: 1, threshold: 10, nameCn: '测试技能' }], resultLimit: 20, timeoutMs: 30_000 })

function createHarness(path: string) {
  const workers: FakeWorker[] = []
  const service = new AutoLoadoutJobService(path, 'worker.js', value => ({ request: value, snapshot }), () => { const worker = new FakeWorker(); workers.push(worker); return worker as never })
  return { service, workers }
}

describe('AutoLoadoutJobService', () => {
  it('shares the worker queue across P2G and legacy games and restores native result identities', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-p2g-jobs-')); directories.push(directory)
    const path = join(directory, 'jobs.sqlite'), fixture = p2gLoadoutFixture()
    const report = await runAutoLoadout(fixture.snapshot, fixture.request, { checkpoint: async () => {}, progress: () => {} })
    const { service, workers } = createHarness(path)
    const native = service.start(fixture.request), legacy = service.start(request())
    expect(service.list({ gameId: 'mhp2g' }).map(job => job.jobId)).toEqual([native.jobId])
    expect(service.get(legacy.jobId).status).toBe('queued')
    service.control(native.jobId, 'pause'); service.control(native.jobId, 'resume')
    expect(workers[0].messages).toContainEqual({ type: 'pause' })
    expect(workers[0].messages).toContainEqual({ type: 'resume' })
    workers[0].emit('message', { type: 'finished', results: report.results, value: report.progress })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(service.get(legacy.jobId).status).toBe('running')
    service.dispose()
    const restored = createHarness(path)
    try {
      const detail = restored.service.get(native.jobId)
      expect(detail.status).toBe('completed')
      expect(detail.results).toEqual(report.results)
      expect(detail.request.baseLoadout.charm).toBeNull()
      expect(detail.results[0].loadout.weapon).toMatchObject({ gameId: 'mhp2g', weaponKey: 'weapon_blademaster:1', saveId: null })
      expect(restored.service.get(legacy.jobId).status).toBe('interrupted')
      expect(restored.workers).toHaveLength(0)
    } finally { restored.service.dispose() }
  })

  it('runs only one worker and starts queued jobs in creation order', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const { service, workers } = createHarness(join(directory, 'jobs.sqlite'))
    const first = service.start(request())
    const second = service.start(request())
    expect(workers).toHaveLength(1)
    expect(service.get(first.jobId).status).toBe('running')
    expect(service.get(second.jobId).status).toBe('queued')

    workers[0].emit('message', { type: 'ready' })
    workers[0].emit('message', { type: 'finished', results: [] })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(service.get(first.jobId).status).toBe('completed')
    expect(workers).toHaveLength(2)
    expect(service.get(second.jobId).status).toBe('running')
    service.dispose()
  })

  it('persists completed jobs and restores unfinished jobs as interrupted', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const path = join(directory, 'jobs.sqlite')
    const firstRun = createHarness(path)
    const job = firstRun.service.start(request())
    firstRun.service.dispose()

    const secondRun = createHarness(path)
    const restored = secondRun.service.get(job.jobId)
    expect(restored.status).toBe('interrupted')
    expect(restored.error).toMatch(/重新运行/)
    expect(secondRun.workers).toHaveLength(0)
    secondRun.service.dispose()
  })

  it('deleting an active job terminates it without deleting queued history implicitly', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const { service, workers } = createHarness(join(directory, 'jobs.sqlite'))
    const active = service.start(request())
    const queued = service.start(request())
    await service.delete([active.jobId])
    expect(workers[0].terminated).toBe(true)
    expect(() => service.get(active.jobId)).toThrow(/不存在/)
    expect(service.get(queued.jobId).status).toBe('running')
    service.dispose()
  })

  it('cancels queued work without starting another worker and persists a terminal progress label', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const { service, workers } = createHarness(join(directory, 'jobs.sqlite'))
    service.start(request())
    const queued = service.start(request())
    service.control(queued.jobId, 'cancel')
    expect(workers).toHaveLength(1)
    expect(service.get(queued.jobId).status).toBe('cancelled')
    expect(service.get(queued.jobId).progress?.stage).toBe('已取消')
    service.dispose()
  })

  it('persists timeout completeness and coverage warnings even with zero results', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const { service, workers } = createHarness(join(directory, 'jobs.sqlite'))
    const job = service.start(request())
    workers[0].emit('message', { type: 'finished', results: [], value: { requestId: 'test', stage: '达到时间上限，未搜完', checked: 12, verified: 3, results: 0, elapsedMs: 1000, searchComplete: false, incompleteReason: 'timeout', coverageWarnings: ['合成规则未确认'] } })
    expect(service.get(job.jobId).status).toBe('completed')
    expect(service.get(job.jobId).progress).toMatchObject({ stage: '达到时间上限，未搜完', searchComplete: false, incompleteReason: 'timeout', verified: 3, coverageWarnings: ['合成规则未确认'] })
    service.dispose()
  })

  it('creates an edited child only on Start, validates its parent and keeps source conditions unchanged', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-copy-')); directories.push(directory)
    const { service, workers } = createHarness(join(directory, 'jobs.sqlite'))
    try {
      const source = service.start(request())
      const original = service.get(source.jobId).request
      const edited = { ...original, parentJobId: source.jobId, requestId: crypto.randomUUID(), timeoutMs: 47000, resultLimit: 7 }
      const child = service.start(edited)
      expect(child.parentJobId).toBe(source.jobId)
      expect(child.status).toBe('queued'); expect(workers).toHaveLength(1)
      expect(service.get(child.jobId).request).toMatchObject({ timeoutMs: 47000, resultLimit: 7 })
      expect(service.get(child.jobId).request.parentJobId).toBeUndefined()
      expect(service.get(source.jobId).request).toEqual(original)
      expect(edited.parentJobId).toBe(source.jobId)
      expect(() => service.start({ ...request(), parentJobId: crypto.randomUUID() })).toThrow(/不存在/)
      expect(() => service.start({ ...request(), gameId: 'mh4g', baseLoadout: createEmptyLogicalLoadout('mh4g'), parentJobId: source.jobId })).toThrow(/跨游戏/)
      expect(service.list({})).toHaveLength(2)
    } finally { service.dispose() }
  })

  it('marks a job failed when its worker cannot be created', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const service = new AutoLoadoutJobService(join(directory, 'jobs.sqlite'), 'worker.js', value => ({ request: value, snapshot }), () => { throw new Error('missing worker') })
    const job = service.start(request())
    expect(service.get(job.jobId).status).toBe('failed')
    expect(service.get(job.jobId).error).toMatch(/无法启动.*missing worker/)
    service.dispose()
  })
})
