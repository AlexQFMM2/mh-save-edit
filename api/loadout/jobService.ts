import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { Worker } from 'node:worker_threads'
import type { AutoLoadoutJobDetail, AutoLoadoutJobFilters, AutoLoadoutJobStatus, AutoLoadoutJobSummary, AutoLoadoutProgress, AutoLoadoutRequest, AutoLoadoutResult, LoadoutCatalogSnapshot } from './types'
import { AutoLoadoutJobStore } from './jobStore'

type PreparedRequest = { request: AutoLoadoutRequest; snapshot: LoadoutCatalogSnapshot }
type PrepareRequest = (request: AutoLoadoutRequest, retry: boolean) => PreparedRequest
type WorkerMessage = { type: string; value?: AutoLoadoutProgress; results?: AutoLoadoutResult[]; error?: string }
type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'on' | 'removeAllListeners'>
type WorkerFactory = (path: string) => WorkerLike
type ActiveJob = {
  jobId: string
  worker: WorkerLike
  request: AutoLoadoutRequest
  startedAt: number
  startPosted: boolean
  startupTimer: ReturnType<typeof setTimeout>
  lastPersistedAt: number
  pendingProgress: AutoLoadoutProgress | null
  progressTimer: ReturnType<typeof setTimeout> | null
  heartbeatTimer: ReturnType<typeof setInterval>
}

const nowIso = () => new Date().toISOString()
const workerErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error || '未知错误')

export class AutoLoadoutJobService {
  private readonly store: AutoLoadoutJobStore
  private readonly events = new EventEmitter()
  private readonly prepared = new Map<string, PreparedRequest>()
  private active: ActiveJob | null = null
  private disposed = false

  constructor(
    databasePath: string,
    private readonly workerPath: string,
    private readonly prepareRequest: PrepareRequest,
    private readonly workerFactory: WorkerFactory = path => new Worker(path),
  ) {
    this.store = new AutoLoadoutJobStore(databasePath)
    for (const job of this.store.recoverInterrupted(nowIso())) this.emit(job)
  }

  subscribe(listener: (summary: AutoLoadoutJobSummary) => void): () => void {
    this.events.on('updated', listener)
    return () => this.events.off('updated', listener)
  }

  start(request: AutoLoadoutRequest, parentJobId: string | null = null): AutoLoadoutJobSummary {
    this.assertOpen()
    const prepared = this.prepareRequest(request, false)
    const jobId = randomUUID()
    const summary = this.store.create(jobId, parentJobId, prepared.request, nowIso())
    this.prepared.set(jobId, prepared)
    this.emit(summary)
    this.runNext()
    return this.store.get(jobId) ?? summary
  }

  retry(jobId: string): AutoLoadoutJobSummary {
    this.assertOpen()
    const source = this.requireDetail(jobId)
    const request = structuredClone(source.request)
    request.requestId = randomUUID()
    const prepared = this.prepareRequest(request, true)
    const newJobId = randomUUID()
    const summary = this.store.create(newJobId, jobId, prepared.request, nowIso())
    this.prepared.set(newJobId, prepared)
    this.emit(summary)
    this.runNext()
    return this.store.get(newJobId) ?? summary
  }

  list(filters: AutoLoadoutJobFilters): AutoLoadoutJobSummary[] { return this.store.list(filters) }

  get(jobId: string): AutoLoadoutJobDetail { return this.requireDetail(jobId) }

  control(jobId: string, action: 'pause' | 'resume' | 'cancel') {
    this.assertOpen()
    const job = this.store.get(jobId)
    if (!job) throw new Error('自动配装任务不存在')
    if (action === 'cancel' && job.status === 'queued') {
      this.prepared.delete(jobId)
      const progress = job.progress ? { ...job.progress, stage: '已取消' } : undefined
      this.emit(this.store.setStatus(jobId, 'cancelled', nowIso(), null, progress))
      return
    }
    if (!this.active || this.active.jobId !== jobId) throw new Error('自动配装任务当前不可控制')
    if (action === 'pause') {
      if (job.status !== 'running') return
      this.active.worker.postMessage({ type: 'pause' })
      this.emit(this.store.setStatus(jobId, 'paused', nowIso()))
      return
    }
    if (action === 'resume') {
      if (job.status !== 'paused') return
      this.active.worker.postMessage({ type: 'resume' })
      this.emit(this.store.setStatus(jobId, 'running', nowIso()))
      return
    }
    if (job.status === 'running' || job.status === 'paused') this.active.worker.postMessage({ type: 'cancel' })
  }

  markViewed(jobId: string) { this.emit(this.store.markViewed(jobId, nowIso())) }

  selectResult(jobId: string, fingerprint: string | null) { this.emit(this.store.selectResult(jobId, fingerprint, nowIso())) }

  async delete(jobIds: string[]): Promise<void> {
    this.assertOpen()
    const unique = [...new Set(jobIds)]
    if (this.active && unique.includes(this.active.jobId)) this.stopActiveForDeletion()
    for (const jobId of unique) this.prepared.delete(jobId)
    this.store.delete(unique)
    this.runNext()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.store.interruptAll(nowIso(), '应用退出时任务尚未完成，可按原条件重新运行。')
    if (this.active) {
      clearTimeout(this.active.startupTimer)
      if (this.active.progressTimer) clearTimeout(this.active.progressTimer)
      clearInterval(this.active.heartbeatTimer)
      this.active.worker.removeAllListeners()
      void this.active.worker.terminate()
      this.active = null
    }
    this.prepared.clear()
    this.events.removeAllListeners()
    this.store.close()
  }

  private runNext() {
    if (this.disposed || this.active) return
    const queued = this.store.nextQueued()
    if (!queued) return
    let prepared: PreparedRequest
    try {
      prepared = this.prepared.get(queued.jobId) ?? this.prepareRequest(queued.request, false)
    } catch (error) {
      this.emit(this.store.setStatus(queued.jobId, 'failed', nowIso(), workerErrorMessage(error)))
      queueMicrotask(() => this.runNext())
      return
    }
    let worker: WorkerLike
    try {
      worker = this.workerFactory(this.workerPath)
    } catch (error) {
      this.prepared.delete(queued.jobId)
      this.emit(this.store.setStatus(queued.jobId, 'failed', nowIso(), `无法启动自动配装搜索线程：${workerErrorMessage(error)}`))
      queueMicrotask(() => this.runNext())
      return
    }
    const startedAt = Date.now()
    const progress: AutoLoadoutProgress = { requestId: prepared.request.requestId, stage: '启动搜索线程', checked: 0, results: 0, elapsedMs: 0 }
    const startupTimer = setTimeout(() => this.failActive(queued.jobId, '自动配装搜索线程启动超时，请重新搜索。'), 10_000)
    startupTimer.unref?.()
    const heartbeatTimer = setInterval(() => {
      const active = this.active
      if (!active || active.jobId !== queued.jobId) return
      const current = active.pendingProgress ?? this.store.get(queued.jobId)?.progress
      if (current) this.persistProgress(active, { ...current, elapsedMs: Math.max(current.elapsedMs, Date.now() - active.startedAt) }, true)
    }, 800)
    heartbeatTimer.unref?.()
    this.active = { jobId: queued.jobId, worker, request: prepared.request, startedAt, startPosted: false, startupTimer, lastPersistedAt: 0, pendingProgress: null, progressTimer: null, heartbeatTimer }
    this.emit(this.store.setRunning(queued.jobId, nowIso(), progress))
    worker.on('message', (message: WorkerMessage) => this.onWorkerMessage(queued.jobId, prepared, message))
    worker.on('error', (error: Error) => this.failActive(queued.jobId, `自动配装搜索线程异常：${error.message}`))
    worker.on('exit', (code: number) => {
      if (!this.active || this.active.jobId !== queued.jobId) return
      const status = this.store.get(queued.jobId)?.status
      if (status === 'running' || status === 'paused') this.failActive(queued.jobId, code === 0 ? '自动配装搜索线程提前结束，未返回结果。' : `自动配装搜索线程异常退出（代码 ${code}）。`)
    })
  }

  private onWorkerMessage(jobId: string, prepared: PreparedRequest, message: WorkerMessage) {
    const active = this.active
    if (!active || active.jobId !== jobId) return
    if (message.type === 'ready' && !active.startPosted) {
      active.startPosted = true
      clearTimeout(active.startupTimer)
      const progress = { requestId: active.request.requestId, stage: '载入候选数据', checked: 0, results: 0, elapsedMs: Date.now() - active.startedAt }
      this.persistProgress(active, progress, true)
      try {
        const workerSnapshot = { ...prepared.snapshot, weapons: [], relicLookups: [] }
        active.worker.postMessage({ type: 'start', snapshot: workerSnapshot, request: prepared.request })
      } catch (error) {
        this.failActive(jobId, `无法向自动配装搜索线程发送候选数据：${workerErrorMessage(error)}`)
      }
      return
    }
    if (message.type === 'progress' && message.value) {
      this.persistProgress(active, message.value)
      return
    }
    if (message.type === 'finished') {
      const latest = message.value ?? active.pendingProgress ?? this.store.get(jobId)?.progress
      const results = message.results ?? []
      const progress: AutoLoadoutProgress = { requestId: active.request.requestId, stage: '已完成', checked: latest?.checked ?? 0, estimatedTotal: latest?.estimatedTotal, results: results.length, elapsedMs: Math.max(latest?.elapsedMs ?? 0, Date.now() - active.startedAt) }
      this.emit(this.store.complete(jobId, progress, results, nowIso()))
      this.finishActive(jobId)
      return
    }
    if (message.type === 'cancelled') {
      const latest = active.pendingProgress ?? this.store.get(jobId)?.progress
      const progress: AutoLoadoutProgress = { requestId: active.request.requestId, stage: '已取消', checked: latest?.checked ?? 0, estimatedTotal: latest?.estimatedTotal, results: latest?.results ?? 0, elapsedMs: Math.max(latest?.elapsedMs ?? 0, Date.now() - active.startedAt) }
      this.emit(this.store.setStatus(jobId, 'cancelled', nowIso(), null, progress))
      this.finishActive(jobId)
      return
    }
    if (message.type === 'error') this.failActive(jobId, message.error ?? '自动配装失败')
  }

  private persistProgress(active: ActiveJob, progress: AutoLoadoutProgress, immediate = false) {
    active.pendingProgress = progress
    const elapsed = Date.now() - active.lastPersistedAt
    if (immediate || elapsed >= 750) {
      if (active.progressTimer) clearTimeout(active.progressTimer)
      active.progressTimer = null
      active.lastPersistedAt = Date.now()
      active.pendingProgress = null
      this.emit(this.store.setProgress(active.jobId, progress, nowIso()))
      return
    }
    if (!active.progressTimer) active.progressTimer = setTimeout(() => {
      if (!this.active || this.active.jobId !== active.jobId || !active.pendingProgress) return
      const pending = active.pendingProgress
      active.progressTimer = null
      active.lastPersistedAt = Date.now()
      active.pendingProgress = null
      this.emit(this.store.setProgress(active.jobId, pending, nowIso()))
    }, 750 - elapsed)
  }

  private failActive(jobId: string, message: string) {
    if (!this.active || this.active.jobId !== jobId) return
    const active = this.active
    const latest = active.pendingProgress ?? this.store.get(jobId)?.progress
    const progress: AutoLoadoutProgress = { requestId: active.request.requestId, stage: '失败', checked: latest?.checked ?? 0, estimatedTotal: latest?.estimatedTotal, results: latest?.results ?? 0, elapsedMs: Math.max(latest?.elapsedMs ?? 0, Date.now() - active.startedAt) }
    this.emit(this.store.setStatus(jobId, 'failed', nowIso(), message, progress))
    this.finishActive(jobId)
  }

  private finishActive(jobId: string) {
    if (!this.active || this.active.jobId !== jobId) return
    const active = this.active
    this.active = null
    clearTimeout(active.startupTimer)
    clearInterval(active.heartbeatTimer)
    if (active.progressTimer) clearTimeout(active.progressTimer)
    active.worker.removeAllListeners()
    void active.worker.terminate()
    this.prepared.delete(jobId)
    queueMicrotask(() => this.runNext())
  }

  private stopActiveForDeletion() {
    if (!this.active) return
    const active = this.active
    this.active = null
    clearTimeout(active.startupTimer)
    clearInterval(active.heartbeatTimer)
    if (active.progressTimer) clearTimeout(active.progressTimer)
    active.worker.removeAllListeners()
    void active.worker.terminate()
  }

  private emit(summary: AutoLoadoutJobSummary) { this.events.emit('updated', summary) }
  private requireDetail(jobId: string) { const value = this.store.getDetail(jobId); if (!value) throw new Error('自动配装任务不存在'); return value }
  private assertOpen() { if (this.disposed) throw new Error('自动配装任务服务已经关闭') }
}
