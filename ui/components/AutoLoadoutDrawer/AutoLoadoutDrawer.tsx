import { ArrowDown, ArrowUp, Pause, Play, RotateCcw, Search, Square, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { calculateLoadout } from '../../../api/loadout/calculator'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutJobDetail, type AutoLoadoutResult, type AutoLoadoutTarget, type LoadoutCalculationSnapshot, type LoadoutLock, type LoadoutResult, type LoadoutSlot, type LogicalLoadout } from '../../../api/loadout/types'
import { AutoLoadoutJobProgress } from '../AutoLoadoutJobProgress/AutoLoadoutJobProgress'
import { AutoLoadoutResultList } from '../AutoLoadoutResultList/AutoLoadoutResultList'
import { LoadoutSlotIcon } from '../LoadoutSlotIcon/LoadoutSlotIcon'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './AutoLoadoutDrawer.css'

type Props = { snapshot: LoadoutCalculationSnapshot; loadout: LogicalLoadout; calculation: LoadoutResult; initialJobId?: string; onJobStarted?: (jobId: string) => void; onApply: (value: LogicalLoadout) => void; onClose: () => void }
const slotLabels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头', chest: '胸', arms: '腕', waist: '腰', legs: '腿', charm: '护石' }
const lockOptions = [{ value: 'unlocked', label: '未固定' }, { value: 'equipment', label: '固定装备' }, { value: 'equipmentAndDecorations', label: '固定装备和珠子' }]
const drawerTabs = ['conditions', 'results'] as const

export function AutoLoadoutDrawer({ snapshot, loadout, initialJobId, onJobStarted, onApply, onClose }: Props) {
  const activations = useMemo(() => snapshot.skills.flatMap(skill => skill.activations.filter(item => item.direction === 'positive').map(item => ({ ...item, skillName: skill.nameCn, nameEn: skill.nameEn, nameJp: skill.nameJp }))), [snapshot])
  const [workingLoadout, setWorkingLoadout] = useState(() => { const value = structuredClone(loadout); if (value.weapon?.lock === 'unlocked') value.weapon.lock = 'equipment'; return value })
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  const [maxSeconds, setMaxSeconds] = useState(30)
  const [job, setJob] = useState<AutoLoadoutJobDetail>()
  const [selected, setSelected] = useState<AutoLoadoutResult>()
  const [tab, setTab] = useState<'conditions' | 'results'>('conditions')
  const [applyError, setApplyError] = useState<string>()
  const [loadingJob, setLoadingJob] = useState(Boolean(initialJobId))

  const adoptJob = useCallback((detail: AutoLoadoutJobDetail) => {
    setJob(detail)
    setWorkingLoadout(structuredClone(detail.request.baseLoadout))
    setTargetKeys(detail.request.targets.map(target => target.activationKey))
    setMaxSeconds(Math.min(120, Math.max(1, detail.timeoutMs / 1000)))
    setSelected(current => detail.results.find(result => result.fingerprint === current?.fingerprint || result.fingerprint === detail.selectedFingerprint))
    setTab('results')
  }, [])
  const refreshJob = useCallback(async (jobId: string) => {
    const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(jobId)
    adoptJob(detail)
    if (detail.status === 'completed' && !detail.viewedAt) await window.mhSaveEditor.loadout.markAutoLoadoutJobViewed(jobId)
  }, [adoptJob])
  useEffect(() => {
    let active = true
    const restore = async () => {
      try {
        if (initialJobId) { const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(initialJobId); if (active) adoptJob(detail); return }
        const jobs = await window.mhSaveEditor.loadout.listAutoLoadoutJobs({ gameId: snapshot.gameId, limit: 1 })
        if (active && jobs[0]) { const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(jobs[0].jobId); adoptJob(detail); if (detail.status === 'completed' && !detail.viewedAt) await window.mhSaveEditor.loadout.markAutoLoadoutJobViewed(detail.jobId) }
      } catch (cause) { if (active) setApplyError(cause instanceof Error ? cause.message : '恢复自动任务失败') }
      finally { if (active) setLoadingJob(false) }
    }
    void restore()
    return () => { active = false }
  }, [adoptJob, initialJobId, snapshot.gameId])
  useEffect(() => window.mhSaveEditor.loadout.subscribeAutoLoadoutJobs(summary => { if (summary.jobId === job?.jobId) void refreshJob(summary.jobId) }), [job?.jobId, refreshJob])

  const targets = useMemo(() => {
    const bySkill = new Map<number, AutoLoadoutTarget>()
    for (const key of targetKeys) { const item = activations.find(value => value.activationKey === key); if (!item) continue; const current = bySkill.get(item.skillId); if (!current || item.threshold > current.threshold) bySkill.set(item.skillId, { activationKey: item.activationKey, skillId: item.skillId, threshold: item.threshold, nameCn: item.nameCn }) }
    return [...bySkill.values()]
  }, [targetKeys, activations])
  const workingCalculation = useMemo(() => calculateLoadout(snapshot, workingLoadout), [snapshot, workingLoadout])
  const itemAt = (slot: LoadoutSlot) => slot === 'weapon' ? workingLoadout.weapon : slot === 'charm' ? workingLoadout.charm : workingLoadout.armor[slot]
  const setLock = (slot: LoadoutSlot, lock: string) => setWorkingLoadout(current => { const next = structuredClone(current); const item = slot === 'weapon' ? next.weapon : slot === 'charm' ? next.charm : next.armor[slot]; if (item) item.lock = lock as LoadoutLock; return next })
  const moveTarget = (index: number, direction: -1 | 1) => setTargetKeys(current => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= current.length) return current; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next })
  const start = async () => {
    if (!workingLoadout.weapon || !targets.length || workingCalculation.encoding === 'blocked') return
    setSelected(undefined); setApplyError(undefined); setTab('results')
    try {
      const summary = await window.mhSaveEditor.loadout.startAutoLoadout({ requestId: crypto.randomUUID(), gameId: snapshot.gameId, dataVersion: snapshot.dataVersion, baseLoadout: workingLoadout, targets, resultLimit: 20, timeoutMs: Math.min(120, Math.max(1, Math.trunc(maxSeconds))) * 1000 })
      onJobStarted?.(summary.jobId)
      await refreshJob(summary.jobId)
    } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '启动失败') }
  }
  const control = async (action: 'pause' | 'resume' | 'cancel') => { if (!job) return; try { await window.mhSaveEditor.loadout.controlAutoLoadoutJob(job.jobId, action); await refreshJob(job.jobId) } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '任务控制失败') } }
  const apply = async () => {
    if (!job || !selected) return
    setApplyError(undefined)
    try {
      const reconciled = await window.mhSaveEditor.loadout.reconcileLoadout({ ...selected.loadout, dataVersion: snapshot.dataVersion })
      const checked = calculateLoadout(snapshot, reconciled)
      const missing = job.targets.find(target => (checked.skills.find(skill => skill.skillId === target.skillId)?.total ?? 0) < target.threshold)
      if (checked.encoding === 'blocked' || missing) throw new Error(missing ? `当前资料复核后不再满足目标：${missing.nameCn}` : '结果结构不可编码')
      await window.mhSaveEditor.loadout.selectAutoLoadoutJobResult(job.jobId, selected.fingerprint)
      onApply(reconciled)
    } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '结果复核失败') }
  }
  const newSearch = () => { setJob(undefined); setSelected(undefined); setTargetKeys([]); setWorkingLoadout(() => { const value = structuredClone(loadout); if (value.weapon?.lock === 'unlocked') value.weapon.lock = 'equipment'; return value }); setTab('conditions'); setApplyError(undefined) }
  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, current: typeof drawerTabs[number]) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const next = drawerTabs[(drawerTabs.indexOf(current) + offset + drawerTabs.length) % drawerTabs.length]
    setTab(next)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[drawerTabs.indexOf(next)]?.focus()
  }

  const footer = <><button type="button" onClick={onClose}>关闭</button><button type="button" className="auto-loadout-drawer__apply" disabled={!selected} onClick={() => void apply()}>应用结果</button></>
  return <LoadoutWorkspaceDrawer title="自动配装" onClose={onClose} footer={footer}>
    <div className="auto-loadout-drawer">
      <div className="auto-loadout-drawer__tabs" role="tablist" aria-label="自动配装步骤"><button className="auto-loadout-drawer__tab" type="button" role="tab" tabIndex={tab === 'conditions' ? 0 : -1} aria-selected={tab === 'conditions'} onKeyDown={event => moveTabFocus(event, 'conditions')} onClick={() => setTab('conditions')}>条件</button><button className="auto-loadout-drawer__tab" type="button" role="tab" tabIndex={tab === 'results' ? 0 : -1} aria-selected={tab === 'results'} onKeyDown={event => moveTabFocus(event, 'results')} onClick={() => setTab('results')}>任务与结果 {job?.resultCount ? `(${job.resultCount})` : ''}</button></div>
      {tab === 'conditions' && <section className="auto-loadout-drawer__conditions" role="tabpanel">
        <h3 className="auto-loadout-drawer__section-title">搜索条件</h3>
        <p className="auto-loadout-drawer__summary">具体武器：<b className="auto-loadout-drawer__data">{workingLoadout.weapon?.nameCn ?? '未选择'}</b> · 性别：{workingLoadout.gender === 'male' ? '男性' : '女性'}</p>
        <label className="auto-loadout-drawer__target"><span className="auto-loadout-drawer__target-label">目标技能（可多选）</span><SearchableSelect multiple ariaLabel="自动配装目标技能" value={targetKeys} options={activations.map(item => ({ value: item.activationKey, label: `${item.nameCn}（${item.skillName} ${item.threshold}）`, keywords: [item.nameEn, item.nameJp, item.skillName] }))} onChange={setTargetKeys} /></label>
        {targetKeys.length > 0 && <div className="auto-loadout-drawer__target-list" aria-label="目标技能优先顺序">{targetKeys.map((key, index) => { const item = activations.find(value => value.activationKey === key); return <div className="auto-loadout-drawer__target-row" key={key}><span className="auto-loadout-drawer__target-name">{index + 1}. {item ? `${item.nameCn}（${item.skillName} ${item.threshold}）` : key}</span><button className="auto-loadout-drawer__target-action" type="button" disabled={index === 0} aria-label={`上移${item?.nameCn ?? key}`} onClick={() => moveTarget(index, -1)}><ArrowUp className="auto-loadout-drawer__target-icon" aria-hidden="true" />上移</button><button className="auto-loadout-drawer__target-action" type="button" disabled={index === targetKeys.length - 1} aria-label={`下移${item?.nameCn ?? key}`} onClick={() => moveTarget(index, 1)}><ArrowDown className="auto-loadout-drawer__target-icon" aria-hidden="true" />下移</button><button className="auto-loadout-drawer__target-action" type="button" aria-label={`移除${item?.nameCn ?? key}`} onClick={() => setTargetKeys(current => current.filter(value => value !== key))}><X className="auto-loadout-drawer__target-icon" aria-hidden="true" />移除</button></div> })}</div>}
        <label className="auto-loadout-drawer__duration"><span className="auto-loadout-drawer__duration-label">最大搜索时间</span><input className="auto-loadout-drawer__duration-input" type="number" min={1} max={120} step={1} value={maxSeconds} onChange={event => setMaxSeconds(Math.min(120, Math.max(1, Number(event.target.value) || 1)))} /><span className="auto-loadout-drawer__duration-unit">秒（1～120）</span></label>
        <div className="auto-loadout-drawer__locks"><h4 className="auto-loadout-drawer__subheading">固定槽位</h4>{(['weapon', ...ARMOR_LOADOUT_SLOTS, 'charm'] as LoadoutSlot[]).map(slot => { const item = itemAt(slot); const options = slot === 'weapon' ? lockOptions.filter(option => option.value !== 'unlocked') : lockOptions; return <label className="auto-loadout-drawer__lock" key={slot}><LoadoutSlotIcon gameId={snapshot.gameId} slot={slot} item={item} size="small" /><span className="auto-loadout-drawer__lock-name">{item ? ('classNameCn' in item ? item.classNameCn : item.nameCn) : '未选择'}</span><SearchableSelect ariaLabel={`${slotLabels[slot]}固定状态`} value={item?.lock ?? 'unlocked'} disabled={!item} options={options} onChange={value => setLock(slot, value)} /></label> })}</div>
        <div className="auto-loadout-drawer__preflight" data-state={workingCalculation.encoding}>{!workingLoadout.weapon ? '请先在主页面选择具体武器。' : !targets.length ? '请选择至少一个正向发动技能。' : workingCalculation.encoding === 'blocked' ? `当前固定输入不可编码：${workingCalculation.issues.find(issue => issue.severity === 'error')?.message ?? '请检查诊断'}` : '指定武器始终固定；发掘、非法护石或超孔珠只有明确固定时才作为常量保留。'}</div>
        <div className="auto-loadout-drawer__controls"><button className="auto-loadout-drawer__control" type="button" disabled={!workingLoadout.weapon || !targets.length || workingCalculation.encoding === 'blocked'} onClick={() => void start()}><Search className="auto-loadout-drawer__control-icon" aria-hidden="true" />开始搜索</button></div>
      </section>}
      {tab === 'results' && <section className="auto-loadout-drawer__results" role="tabpanel">
        <div className="auto-loadout-drawer__result-head">
          <h3 className="auto-loadout-drawer__section-title">{job ? job.targets.map(target => target.nameCn).join('、') : '自动任务'}</h3>
          <div className="auto-loadout-drawer__controls">
            {job?.status === 'running' && <button className="auto-loadout-drawer__control" type="button" onClick={() => void control('pause')}><Pause className="auto-loadout-drawer__control-icon" aria-hidden="true" />暂停</button>}
            {job?.status === 'paused' && <button className="auto-loadout-drawer__control" type="button" onClick={() => void control('resume')}><Play className="auto-loadout-drawer__control-icon" aria-hidden="true" />继续</button>}
            {job && ['queued', 'running', 'paused'].includes(job.status) && <button className="auto-loadout-drawer__control" type="button" onClick={() => void control('cancel')}><Square className="auto-loadout-drawer__control-icon" aria-hidden="true" />取消任务</button>}
            <button className="auto-loadout-drawer__control" type="button" onClick={newSearch}><RotateCcw className="auto-loadout-drawer__control-icon" aria-hidden="true" />新建搜索</button>
          </div>
        </div>
        <div className="auto-loadout-drawer__progress-stack">
          {loadingJob ? <p className="auto-loadout-drawer__progress">正在恢复任务…</p> : job ? <AutoLoadoutJobProgress job={job} /> : <p className="auto-loadout-drawer__progress">尚未开始任务，请回到“条件”设置目标。</p>}
          {job?.error && <strong className="auto-loadout-drawer__error">{job.error}</strong>}
          {applyError && <strong className="auto-loadout-drawer__error" role="alert">{applyError}</strong>}
        </div>
        <AutoLoadoutResultList results={job?.results ?? []} selected={selected?.fingerprint} onSelect={setSelected} />
      </section>}
    </div>
  </LoadoutWorkspaceDrawer>
}
