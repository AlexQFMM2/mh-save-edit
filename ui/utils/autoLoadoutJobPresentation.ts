import type { AutoLoadoutJobSummary } from '../../api/loadout/types'

export function autoLoadoutStatusLabel(job: AutoLoadoutJobSummary): string {
  if (job.status !== 'completed') return ({ queued: '排队中', running: '运行中', paused: '已暂停', cancelled: '已取消', failed: '失败', interrupted: '已中断' })[job.status]
  if (job.progress?.incompleteReason === 'timeout') return '时间到，未搜完'
  if (job.progress?.incompleteReason === 'candidate-bound') return '已达到结果数量'
  if (job.progress?.incompleteReason === 'unknown-charm-range') return '规则覆盖不完整'
  return job.progress?.searchComplete === true ? '当前候选域已搜完' : '已结束，完整性未知'
}

export function autoLoadoutEmptyMessage(job?: AutoLoadoutJobSummary): string {
  if (!job) return '尚未开始任务。设置条件后开始搜索。'
  if (job.status === 'running' || job.status === 'queued' || job.status === 'paused') return '暂未找到满足目标的结果，任务尚未结束。'
  if (job.status === 'failed') return `搜索失败：${job.error ?? '请查看任务诊断。'}`
  if (job.status !== 'completed') return '任务已取消或中断，未证明无解。可复制条件调整后重新搜索。'
  if (job.progress?.incompleteReason === 'timeout') return '时间预算内暂未找到结果，搜索未完成，不代表搭配无解。可复制条件增加时间或固定装备。'
  if (job.progress?.coverageWarnings?.length) return '当前可确认候选中未找到结果，护石等规则覆盖不完整，不能断言无解。'
  if (job.progress?.searchComplete === true) return '已搜索完当前候选域，未找到满足全部目标的搭配。'
  return '本次任务没有结果，历史记录未保存搜索完整性，不能断言无解。'
}
