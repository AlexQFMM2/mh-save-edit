import { Copy, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { calculateLoadout } from '../../../api/loadout/calculator'
import type { AutoLoadoutJobDetail, AutoLoadoutJobStatus, AutoLoadoutJobSummary, AutoLoadoutResult, LoadoutCalculationSnapshot, LoadoutGame, LogicalLoadout } from '../../../api/loadout/types'
import { AutoLoadoutJobProgress } from '../AutoLoadoutJobProgress/AutoLoadoutJobProgress'
import { AutoLoadoutResultList } from '../AutoLoadoutResultList/AutoLoadoutResultList'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './AutoLoadoutHistoryDrawer.css'

type Props = { gameId: LoadoutGame; snapshot: LoadoutCalculationSnapshot; onApply: (value: LogicalLoadout) => void; onJobsChanged?: () => void | Promise<void>; onClose: () => void }
type DetailTab = 'conditions' | 'progress' | 'results'
const terminalStatuses: AutoLoadoutJobStatus[] = ['completed', 'cancelled', 'failed', 'interrupted']
const statusOptions = [{ value: 'all', label: '全部状态' }, { value: 'queued', label: '排队中' }, { value: 'running', label: '运行中' }, { value: 'paused', label: '已暂停' }, { value: 'completed', label: '已完成' }, { value: 'cancelled', label: '已取消' }, { value: 'failed', label: '失败' }, { value: 'interrupted', label: '已中断' }]
const gameOptions = [{ value: 'current', label: '当前版本' }, { value: 'all', label: '全部版本' }, { value: 'mh3g', label: 'MH3G' }, { value: 'mh4g', label: 'MH4G' }, { value: 'mhgu', label: 'MHGU / XX' }]
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const detailTabs: DetailTab[] = ['conditions', 'progress', 'results']

export function AutoLoadoutHistoryDrawer({ gameId, snapshot, onApply, onJobsChanged, onClose }: Props) {
  const [summaries, setSummaries] = useState<AutoLoadoutJobSummary[]>([])
  const [selectedJob, setSelectedJob] = useState<AutoLoadoutJobDetail>()
  const [selectedResult, setSelectedResult] = useState<AutoLoadoutResult>()
  const [tab, setTab] = useState<DetailTab>('conditions')
  const [gameFilter, setGameFilter] = useState('current')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async () => {
    const filters = {
      ...(gameFilter === 'current' ? { gameId } : gameFilter === 'all' ? {} : { gameId: gameFilter as LoadoutGame }),
      ...(statusFilter === 'all' ? {} : { statuses: [statusFilter as AutoLoadoutJobStatus] }),
      ...(query.trim() ? { query: query.trim() } : {}),
      limit: 500,
    }
    setSummaries(await window.mhSaveEditor.loadout.listAutoLoadoutJobs(filters))
  }, [gameFilter, gameId, query, statusFilter])

  const openJob = useCallback(async (jobId: string) => {
    setBusy(true)
    setError(undefined)
    try {
      const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(jobId)
      setSelectedJob(detail)
      setSelectedResult(detail.results.find(result => result.fingerprint === detail.selectedFingerprint))
      setTab(detail.status === 'completed' ? 'results' : 'progress')
      await window.mhSaveEditor.loadout.markAutoLoadoutJobViewed(jobId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取任务失败')
    } finally { setBusy(false) }
  }, [])

  const refreshSelectedJob = useCallback(async (jobId: string) => {
    const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(jobId)
    setSelectedJob(detail)
    setSelectedResult(current => detail.results.find(result => result.fingerprint === current?.fingerprint || result.fingerprint === detail.selectedFingerprint))
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => { void loadList().catch(cause => setError(cause instanceof Error ? cause.message : '读取历史任务失败')) }, 120); return () => window.clearTimeout(timer) }, [loadList])
  useEffect(() => window.mhSaveEditor.loadout.subscribeAutoLoadoutJobs(summary => {
    void loadList()
    if (selectedJob?.jobId === summary.jobId) void refreshSelectedJob(summary.jobId).catch(() => undefined)
  }), [loadList, refreshSelectedJob, selectedJob?.jobId])

  const control = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!selectedJob) return
    setBusy(true)
    try { await window.mhSaveEditor.loadout.controlAutoLoadoutJob(selectedJob.jobId, action); setSelectedJob(await window.mhSaveEditor.loadout.getAutoLoadoutJob(selectedJob.jobId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '任务控制失败') }
    finally { setBusy(false) }
  }
  const retry = async () => {
    if (!selectedJob) return
    setBusy(true)
    try { const next = await window.mhSaveEditor.loadout.retryAutoLoadoutJob(selectedJob.jobId); await openJob(next.jobId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '重新运行失败') }
    finally { setBusy(false) }
  }
  const remove = async (jobIds: string[]) => {
    const active = summaries.some(job => jobIds.includes(job.jobId) && ['running', 'paused'].includes(job.status)) || (selectedJob && jobIds.includes(selectedJob.jobId) && ['running', 'paused'].includes(selectedJob.status))
    if (active && !window.confirm('任务仍在运行或暂停。删除会先终止搜索，确认删除？')) return
    if (!active && !window.confirm(`确认删除 ${jobIds.length} 条本地自动配装记录？`)) return
    setBusy(true)
    try { await window.mhSaveEditor.loadout.deleteAutoLoadoutJobs(jobIds); if (selectedJob && jobIds.includes(selectedJob.jobId)) setSelectedJob(undefined); await loadList(); await onJobsChanged?.() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '删除任务失败') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!selectedJob || !selectedResult || selectedJob.gameId !== gameId) return
    setBusy(true)
    setError(undefined)
    try {
      const reconciled = await window.mhSaveEditor.loadout.reconcileLoadout({ ...selectedResult.loadout, dataVersion: snapshot.dataVersion })
      const calculation = calculateLoadout(snapshot, reconciled)
      if (calculation.encoding === 'blocked') throw new Error(`结果结构不可编码：${calculation.issues.find(issue => issue.severity === 'error')?.message ?? '请检查配装诊断'}`)
      const missing = selectedJob.targets.find(target => (calculation.skills.find(skill => skill.skillId === target.skillId)?.total ?? 0) < target.threshold)
      if (missing) throw new Error(`当前资料复核后不再满足目标：${missing.nameCn}`)
      await window.mhSaveEditor.loadout.selectAutoLoadoutJobResult(selectedJob.jobId, selectedResult.fingerprint)
      onApply(reconciled)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '应用历史结果失败') }
    finally { setBusy(false) }
  }

  const terminalIds = summaries.filter(job => terminalStatuses.includes(job.status)).map(job => job.jobId)
  const back = () => { setSelectedJob(undefined); setSelectedResult(undefined); setError(undefined); void loadList() }
  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, current: DetailTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const next = detailTabs[(detailTabs.indexOf(current) + offset + detailTabs.length) % detailTabs.length]
    setTab(next)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[detailTabs.indexOf(next)]?.focus()
  }
  const footer = selectedJob ? <>
    <button type="button" onClick={back}>返回历史</button>
    <button className="auto-loadout-history-drawer__apply" type="button" disabled={!selectedResult || selectedJob.gameId !== gameId || busy} onClick={apply}>应用到当前配装</button>
  </> : <button type="button" onClick={onClose}>关闭</button>

  return <LoadoutWorkspaceDrawer title={selectedJob ? '自动任务详情' : '自动任务历史'} onBack={selectedJob ? back : undefined} onEscape={selectedJob ? back : onClose} onClose={onClose} footer={footer}>
    {selectedJob ? <div className="auto-loadout-history-drawer__detail">
      <div className="auto-loadout-history-drawer__detail-head"><div><h3 className="auto-loadout-history-drawer__detail-title">{selectedJob.targets.map(target => target.nameCn).join('、')}</h3><p className="auto-loadout-history-drawer__detail-meta">{selectedJob.gameId.toUpperCase()} · {dateFormatter.format(new Date(selectedJob.createdAt))}{selectedJob.dataVersion !== snapshot.dataVersion && selectedJob.gameId === gameId ? ' · 资料已更新，应用前将重新复核' : ''}</p></div><div className="auto-loadout-history-drawer__actions">{selectedJob.status === 'running' && <button className="auto-loadout-history-drawer__action" type="button" disabled={busy} onClick={() => void control('pause')}><Pause className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />暂停</button>}{selectedJob.status === 'paused' && <button className="auto-loadout-history-drawer__action" type="button" disabled={busy} onClick={() => void control('resume')}><Play className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />继续</button>}{['running', 'paused', 'queued'].includes(selectedJob.status) && <button className="auto-loadout-history-drawer__action" type="button" disabled={busy} onClick={() => void control('cancel')}><Square className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />取消</button>}<button className="auto-loadout-history-drawer__action" type="button" disabled={busy} onClick={() => void retry()}><Copy className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />按原条件重跑</button><button className="auto-loadout-history-drawer__action" type="button" disabled={busy} onClick={() => void remove([selectedJob.jobId])}><Trash2 className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />删除</button></div></div>
      <div className="auto-loadout-history-drawer__tabs" role="tablist" aria-label="任务详情"><button className="auto-loadout-history-drawer__tab" type="button" role="tab" tabIndex={tab === 'conditions' ? 0 : -1} aria-selected={tab === 'conditions'} onKeyDown={event => moveTabFocus(event, 'conditions')} onClick={() => setTab('conditions')}>条件</button><button className="auto-loadout-history-drawer__tab" type="button" role="tab" tabIndex={tab === 'progress' ? 0 : -1} aria-selected={tab === 'progress'} onKeyDown={event => moveTabFocus(event, 'progress')} onClick={() => setTab('progress')}>进度</button><button className="auto-loadout-history-drawer__tab" type="button" role="tab" tabIndex={tab === 'results' ? 0 : -1} aria-selected={tab === 'results'} onKeyDown={event => moveTabFocus(event, 'results')} onClick={() => setTab('results')}>结果 ({selectedJob.resultCount})</button></div>
      {tab === 'conditions' && <section className="auto-loadout-history-drawer__conditions" role="tabpanel"><dl className="auto-loadout-history-drawer__condition-list">{[['目标技能', selectedJob.targets.map(target => `${target.nameCn} ≥ ${target.threshold}`).join('、')], ['武器', selectedJob.request.baseLoadout.weapon?.nameCn ?? '未选择'], ['性别', selectedJob.request.baseLoadout.gender === 'male' ? '男性' : '女性'], ['最大时间', `${selectedJob.timeoutMs / 1000} 秒`], ['资料版本', selectedJob.dataVersion]].map(([term, value]) => <div className="auto-loadout-history-drawer__condition-row" key={term}><dt className="auto-loadout-history-drawer__condition-term">{term}</dt><dd className="auto-loadout-history-drawer__condition-value">{value}</dd></div>)}</dl></section>}
      {tab === 'progress' && <section className="auto-loadout-history-drawer__progress" role="tabpanel"><AutoLoadoutJobProgress job={selectedJob} />{selectedJob.error && <p className="auto-loadout-history-drawer__error" role="alert">{selectedJob.error}</p>}</section>}
      {tab === 'results' && <section className="auto-loadout-history-drawer__results" role="tabpanel"><AutoLoadoutResultList results={selectedJob.results} selected={selectedResult?.fingerprint} onSelect={setSelectedResult} /></section>}
      {error && <p className="auto-loadout-history-drawer__error" role="alert">{error}</p>}
    </div> : <div className="auto-loadout-history-drawer__list-view">
      <div className="auto-loadout-history-drawer__filters">
        <label className="auto-loadout-history-drawer__filter"><span>搜索</span><input className="auto-loadout-history-drawer__query" aria-label="历史任务关键词" value={query} onChange={event => setQuery(event.target.value)} placeholder="目标技能或错误信息" /></label>
        <label className="auto-loadout-history-drawer__filter"><span>版本</span><SearchableSelect ariaLabel="历史任务游戏版本" value={gameFilter} options={gameOptions} onChange={setGameFilter} /></label>
        <label className="auto-loadout-history-drawer__filter"><span>状态</span><SearchableSelect ariaLabel="历史任务状态" value={statusFilter} options={statusOptions} onChange={setStatusFilter} /></label>
        <button className="auto-loadout-history-drawer__filter-action" type="button" onClick={() => { setQuery(''); setGameFilter('current'); setStatusFilter('all') }}><RotateCcw className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />重置</button>
        <button className="auto-loadout-history-drawer__filter-action" type="button" disabled={!terminalIds.length || busy} onClick={() => void remove(terminalIds)}><Trash2 className="auto-loadout-history-drawer__action-icon" aria-hidden="true" />清理已结束</button>
      </div>
      <div className="auto-loadout-history-drawer__list" aria-live="polite">{summaries.length ? summaries.map(job => <button className="auto-loadout-history-drawer__job" type="button" key={job.jobId} onClick={() => void openJob(job.jobId)}><div className="auto-loadout-history-drawer__job-copy"><strong className="auto-loadout-history-drawer__job-title">{job.targets.map(target => target.nameCn).join('、')}</strong><span className="auto-loadout-history-drawer__job-meta">{job.gameId.toUpperCase()} · {dateFormatter.format(new Date(job.createdAt))} · {job.resultCount} 个结果</span></div><AutoLoadoutJobProgress job={job} compact />{job.status === 'completed' && !job.viewedAt && <span className="auto-loadout-history-drawer__unread">未查看</span>}</button>) : <p className="auto-loadout-history-drawer__empty">没有符合条件的本地任务记录。</p>}</div>
      {error && <p className="auto-loadout-history-drawer__error" role="alert">{error}</p>}
    </div>}
  </LoadoutWorkspaceDrawer>
}
