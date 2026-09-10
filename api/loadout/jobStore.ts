import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type DatabaseType from 'better-sqlite3'
import type { AutoLoadoutJobDetail, AutoLoadoutJobFilters, AutoLoadoutJobStatus, AutoLoadoutJobSummary, AutoLoadoutProgress, AutoLoadoutRequest, AutoLoadoutResult } from './types'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType
const ACTIVE_STATUSES: readonly AutoLoadoutJobStatus[] = ['queued', 'running', 'paused']

type JobRow = {
  job_id: string
  parent_job_id: string | null
  game_id: AutoLoadoutJobSummary['gameId']
  data_version: string
  status: AutoLoadoutJobStatus
  created_at: string
  started_at: string | null
  updated_at: string
  completed_at: string | null
  targets_json: string
  timeout_ms: number
  progress_json: string | null
  result_count: number
  error: string | null
  selected_fingerprint: string | null
  viewed_at: string | null
  request_json: string
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}

function toSummary(row: JobRow): AutoLoadoutJobSummary {
  return {
    jobId: row.job_id,
    parentJobId: row.parent_job_id,
    gameId: row.game_id,
    dataVersion: row.data_version,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    targets: parseJson(row.targets_json),
    timeoutMs: row.timeout_ms,
    progress: row.progress_json ? parseJson(row.progress_json) : null,
    resultCount: row.result_count,
    error: row.error,
    selectedFingerprint: row.selected_fingerprint,
    viewedAt: row.viewed_at,
  }
}

export class AutoLoadoutJobStore {
  private readonly database: DatabaseType.Database

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    this.database = new Database(path, nativeBinding ? { nativeBinding } : undefined)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS auto_loadout_schema (
        version INTEGER NOT NULL
      );
      INSERT INTO auto_loadout_schema(version)
      SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM auto_loadout_schema);
      CREATE TABLE IF NOT EXISTS auto_loadout_jobs (
        job_id TEXT PRIMARY KEY,
        parent_job_id TEXT,
        game_id TEXT NOT NULL,
        data_version TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        targets_json TEXT NOT NULL,
        timeout_ms INTEGER NOT NULL,
        progress_json TEXT,
        result_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        selected_fingerprint TEXT,
        viewed_at TEXT,
        request_json TEXT NOT NULL,
        FOREIGN KEY(parent_job_id) REFERENCES auto_loadout_jobs(job_id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS auto_loadout_results (
        job_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        fingerprint TEXT NOT NULL,
        result_json TEXT NOT NULL,
        PRIMARY KEY(job_id, fingerprint),
        FOREIGN KEY(job_id) REFERENCES auto_loadout_jobs(job_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS auto_loadout_jobs_created ON auto_loadout_jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS auto_loadout_jobs_status ON auto_loadout_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS auto_loadout_results_order ON auto_loadout_results(job_id, sort_order);
    `)
    const version = this.database.prepare('SELECT version FROM auto_loadout_schema LIMIT 1').pluck().get()
    if (version !== 1) throw new Error(`不支持的自动配装任务数据库版本：${String(version)}`)
  }

  recoverInterrupted(now: string): AutoLoadoutJobSummary[] {
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(',')
    const rows = this.database.prepare(`SELECT * FROM auto_loadout_jobs WHERE status IN (${placeholders})`).all(...ACTIVE_STATUSES) as JobRow[]
    if (!rows.length) return []
    this.database.prepare(`UPDATE auto_loadout_jobs SET status = 'interrupted', updated_at = ?, completed_at = ?, error = COALESCE(error, '应用上次退出时任务尚未完成，可按原条件重新运行。') WHERE status IN (${placeholders})`).run(now, now, ...ACTIVE_STATUSES)
    return rows.map(row => ({ ...toSummary(row), status: 'interrupted', updatedAt: now, completedAt: now, error: row.error ?? '应用上次退出时任务尚未完成，可按原条件重新运行。' }))
  }

  interruptAll(now: string, error: string) {
    const placeholders = ACTIVE_STATUSES.map(() => '?').join(',')
    this.database.prepare(`UPDATE auto_loadout_jobs SET status = 'interrupted', updated_at = ?, completed_at = ?, error = ? WHERE status IN (${placeholders})`).run(now, now, error, ...ACTIVE_STATUSES)
  }

  create(jobId: string, parentJobId: string | null, request: AutoLoadoutRequest, now: string): AutoLoadoutJobSummary {
    const progress: AutoLoadoutProgress = { requestId: request.requestId, stage: '等待搜索', checked: 0, results: 0, elapsedMs: 0 }
    this.database.prepare(`INSERT INTO auto_loadout_jobs(job_id,parent_job_id,game_id,data_version,status,created_at,updated_at,targets_json,timeout_ms,progress_json,request_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      jobId, parentJobId, request.gameId, request.dataVersion, 'queued', now, now, JSON.stringify(request.targets), request.timeoutMs, JSON.stringify(progress), JSON.stringify(request),
    )
    return this.get(jobId)!
  }

  get(jobId: string): AutoLoadoutJobSummary | null {
    const row = this.database.prepare('SELECT * FROM auto_loadout_jobs WHERE job_id = ?').get(jobId) as JobRow | undefined
    return row ? toSummary(row) : null
  }

  getDetail(jobId: string): AutoLoadoutJobDetail | null {
    const row = this.database.prepare('SELECT * FROM auto_loadout_jobs WHERE job_id = ?').get(jobId) as JobRow | undefined
    if (!row) return null
    const results = (this.database.prepare('SELECT result_json FROM auto_loadout_results WHERE job_id = ? ORDER BY sort_order').all(jobId) as { result_json: string }[]).map(value => parseJson<AutoLoadoutResult>(value.result_json))
    return { ...toSummary(row), request: parseJson(row.request_json), results }
  }

  list(filters: AutoLoadoutJobFilters = {}): AutoLoadoutJobSummary[] {
    const clauses: string[] = []
    const parameters: unknown[] = []
    if (filters.gameId) { clauses.push('game_id = ?'); parameters.push(filters.gameId) }
    if (filters.statuses?.length) { clauses.push(`status IN (${filters.statuses.map(() => '?').join(',')})`); parameters.push(...filters.statuses) }
    if (filters.query) { clauses.push('(targets_json LIKE ? OR error LIKE ?)'); const query = `%${filters.query}%`; parameters.push(query, query) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const limit = Math.min(500, Math.max(1, filters.limit ?? 200))
    return (this.database.prepare(`SELECT * FROM auto_loadout_jobs ${where} ORDER BY created_at DESC LIMIT ?`).all(...parameters, limit) as JobRow[]).map(toSummary)
  }

  nextQueued(): AutoLoadoutJobDetail | null {
    const row = this.database.prepare("SELECT job_id FROM auto_loadout_jobs WHERE status = 'queued' ORDER BY created_at, job_id LIMIT 1").get() as { job_id: string } | undefined
    return row ? this.getDetail(row.job_id) : null
  }

  setRunning(jobId: string, now: string, progress: AutoLoadoutProgress): AutoLoadoutJobSummary {
    this.database.prepare("UPDATE auto_loadout_jobs SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?, progress_json = ?, error = NULL WHERE job_id = ?").run(now, now, JSON.stringify(progress), jobId)
    return this.require(jobId)
  }

  setStatus(jobId: string, status: AutoLoadoutJobStatus, now: string, error: string | null = null, progress?: AutoLoadoutProgress): AutoLoadoutJobSummary {
    const terminal = ['completed', 'cancelled', 'failed', 'interrupted'].includes(status)
    this.database.prepare('UPDATE auto_loadout_jobs SET status = ?, updated_at = ?, completed_at = CASE WHEN ? THEN ? ELSE completed_at END, error = ?, progress_json = COALESCE(?, progress_json), result_count = CASE WHEN ? IS NULL THEN result_count ELSE MAX(result_count, ?) END WHERE job_id = ?').run(status, now, terminal ? 1 : 0, terminal ? now : null, error, progress ? JSON.stringify(progress) : null, progress ? 1 : null, progress?.results ?? 0, jobId)
    return this.require(jobId)
  }

  setProgress(jobId: string, progress: AutoLoadoutProgress, now: string): AutoLoadoutJobSummary {
    this.database.prepare('UPDATE auto_loadout_jobs SET progress_json = ?, result_count = MAX(result_count, ?), updated_at = ? WHERE job_id = ?').run(JSON.stringify(progress), progress.results, now, jobId)
    return this.require(jobId)
  }

  complete(jobId: string, progress: AutoLoadoutProgress, results: AutoLoadoutResult[], now: string): AutoLoadoutJobSummary {
    const transaction = this.database.transaction(() => {
      this.database.prepare('DELETE FROM auto_loadout_results WHERE job_id = ?').run(jobId)
      const insert = this.database.prepare('INSERT INTO auto_loadout_results(job_id,sort_order,fingerprint,result_json) VALUES(?,?,?,?)')
      results.forEach((result, index) => insert.run(jobId, index, result.fingerprint, JSON.stringify(result)))
      this.database.prepare("UPDATE auto_loadout_jobs SET status = 'completed', updated_at = ?, completed_at = ?, progress_json = ?, result_count = ?, error = NULL WHERE job_id = ?").run(now, now, JSON.stringify(progress), results.length, jobId)
    })
    transaction()
    return this.require(jobId)
  }

  markViewed(jobId: string, now: string): AutoLoadoutJobSummary {
    this.database.prepare('UPDATE auto_loadout_jobs SET viewed_at = ?, updated_at = ? WHERE job_id = ?').run(now, now, jobId)
    return this.require(jobId)
  }

  selectResult(jobId: string, fingerprint: string | null, now: string): AutoLoadoutJobSummary {
    if (fingerprint) {
      const exists = this.database.prepare('SELECT 1 FROM auto_loadout_results WHERE job_id = ? AND fingerprint = ?').get(jobId, fingerprint)
      if (!exists) throw new Error('自动配装结果不存在')
    }
    this.database.prepare('UPDATE auto_loadout_jobs SET selected_fingerprint = ?, updated_at = ? WHERE job_id = ?').run(fingerprint, now, jobId)
    return this.require(jobId)
  }

  delete(jobIds: string[]) {
    if (!jobIds.length) return
    const statement = this.database.prepare('DELETE FROM auto_loadout_jobs WHERE job_id = ?')
    this.database.transaction(() => jobIds.forEach(jobId => statement.run(jobId)))()
  }

  close() { this.database.close() }

  private require(jobId: string): AutoLoadoutJobSummary {
    const job = this.get(jobId)
    if (!job) throw new Error('自动配装任务不存在')
    return job
  }
}
