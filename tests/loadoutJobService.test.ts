import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { AutoLoadoutJobService } from '../api/loadout/jobService'
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

  it('marks a job failed when its worker cannot be created', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mh-loadout-jobs-')); directories.push(directory)
    const service = new AutoLoadoutJobService(join(directory, 'jobs.sqlite'), 'worker.js', value => ({ request: value, snapshot }), () => { throw new Error('missing worker') })
    const job = service.start(request())
    expect(service.get(job.jobId).status).toBe('failed')
    expect(service.get(job.jobId).error).toMatch(/无法启动.*missing worker/)
    service.dispose()
  })
})
