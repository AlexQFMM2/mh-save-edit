import { AlertTriangle, CheckCircle2, CircleSlash, Clock3, LoaderCircle, PauseCircle, XCircle } from 'lucide-react'
import type { AutoLoadoutJobSummary, AutoLoadoutJobStatus } from '../../../api/loadout/types'
import './AutoLoadoutJobProgress.css'

const statusLabels: Record<AutoLoadoutJobStatus, string> = { queued: '排队中', running: '运行中', paused: '已暂停', completed: '已完成', cancelled: '已取消', failed: '失败', interrupted: '已中断' }
const statusIcons = { queued: Clock3, running: LoaderCircle, paused: PauseCircle, completed: CheckCircle2, cancelled: CircleSlash, failed: XCircle, interrupted: AlertTriangle }
const seconds = (milliseconds: number) => `${(milliseconds / 1000).toFixed(1)} 秒`

export function AutoLoadoutJobProgress({ job, compact = false }: { job: AutoLoadoutJobSummary; compact?: boolean }) {
  const progress = job.progress
  const preparing = job.status === 'queued' || (job.status === 'running' && (!progress || /启动|载入|准备/.test(progress.stage)))
  const completed = job.status === 'completed'
  const estimated = progress?.estimatedTotal && progress.estimatedTotal > 0 ? progress.estimatedTotal : null
  const maximum = estimated ?? job.timeoutMs
  const current = completed ? maximum : estimated ? Math.min(estimated, progress?.checked ?? 0) : Math.min(job.timeoutMs, progress?.elapsedMs ?? 0)
  const percent = maximum > 0 ? Math.max(0, Math.min(100, current / maximum * 100)) : 0
  const StatusIcon = statusIcons[job.status]
  const basis = estimated ? `${progress?.checked ?? 0} / ${estimated}` : `${seconds(progress?.elapsedMs ?? 0)} / ${seconds(job.timeoutMs)}`
  const ariaText = preparing ? `${statusLabels[job.status]}，${progress?.stage ?? '等待搜索'}` : `${statusLabels[job.status]}，${estimated ? '组合进度' : '时间预算'} ${basis}`
  return <section className="auto-loadout-job-progress" data-compact={compact || undefined} data-status={job.status} aria-label="自动配装任务进度">
    <div className="auto-loadout-job-progress__heading"><span className="auto-loadout-job-progress__status"><StatusIcon className="auto-loadout-job-progress__status-icon" aria-hidden="true" />{statusLabels[job.status]}</span><span className="auto-loadout-job-progress__stage">{progress?.stage ?? '等待搜索'}</span></div>
    <div className="auto-loadout-job-progress__track" role="progressbar" aria-label={estimated ? '搜索组合进度' : '搜索时间预算'} aria-valuemin={0} aria-valuemax={preparing ? undefined : maximum} aria-valuenow={preparing ? undefined : current} aria-valuetext={ariaText} data-indeterminate={preparing || undefined}>
      <span className="auto-loadout-job-progress__bar" style={preparing ? undefined : { width: `${percent}%` }} />
    </div>
    {!compact && <div className="auto-loadout-job-progress__metrics"><span>{estimated ? '组合进度' : '时间预算'} <b className="auto-loadout-job-progress__metric-value">{basis}</b></span><span>已检查 <b className="auto-loadout-job-progress__metric-value">{progress?.checked ?? 0}</b></span><span>结果 <b className="auto-loadout-job-progress__metric-value">{job.resultCount}</b></span></div>}
  </section>
}
