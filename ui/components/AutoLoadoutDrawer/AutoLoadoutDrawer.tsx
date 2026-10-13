import { validateAutoResult } from '../../../api/loadout/resultValidation'
import { ArrowDown, ArrowUp, Pause, Play, RotateCcw, Search, Square, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { calculateLoadout } from '../../../api/loadout/calculator'
import { applyCharmValidation } from '../../../api/loadout/charm'
import { AutoLoadoutEquipmentView, type AutoLoadoutEquipmentValue } from '../AutoLoadoutEquipmentView/AutoLoadoutEquipmentView'
import { getLoadoutSlots, type AutoLoadoutJobDetail, type AutoLoadoutResult, type AutoLoadoutTarget, type LoadoutCalculationSnapshot, type LoadoutLock, type LoadoutResult, type LoadoutSlot, type LogicalLoadout } from '../../../api/loadout/types'
import { AutoLoadoutJobProgress } from '../AutoLoadoutJobProgress/AutoLoadoutJobProgress'
import { AutoLoadoutResultList } from '../AutoLoadoutResultList/AutoLoadoutResultList'
import { LoadoutSlotIcon } from '../LoadoutSlotIcon/LoadoutSlotIcon'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { getAutoLoadoutDraft, saveAutoLoadoutDraft } from '../../stores/autoLoadoutDraftStore'
import './AutoLoadoutDrawer.css'

type Props = { snapshot: LoadoutCalculationSnapshot; loadout: LogicalLoadout; calculation: LoadoutResult; initialJobId?: string; onJobStarted?: (jobId: string) => void; onApply: (value: LogicalLoadout) => void; onClose: () => void; onOpenCatalog?: (path: string) => void }
const slotLabels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头', chest: '胸', arms: '腕', waist: '腰', legs: '腿', charm: '护石' }
const lockOptions = [{ value: 'unlocked', label: '未固定' }, { value: 'equipment', label: '固定装备' }, { value: 'equipmentAndDecorations', label: '固定装备和珠子' }]
const drawerTabs = ['conditions', 'results'] as const

export function AutoLoadoutDrawer({ snapshot, loadout, initialJobId, onJobStarted, onApply, onClose, onOpenCatalog }: Props) {
  const activations = useMemo(() => snapshot.skills.flatMap(skill => skill.activations.filter(item => item.direction === 'positive').map(item => ({ ...item, skillName: skill.nameCn, nameEn: skill.nameEn, nameJp: `${skill.nameJp} ${item.nameJp ?? ''}` }))), [snapshot])
  const [savedDraft] = useState(() => getAutoLoadoutDraft(snapshot.gameId))
  const [workingLoadout, setWorkingLoadout] = useState(() => { const value = savedDraft?.baseLoadout ?? structuredClone(loadout); if (value.weapon?.lock === 'unlocked') value.weapon.lock = 'equipment'; return value })
  const [targetKeys, setTargetKeys] = useState<string[]>(savedDraft?.targetKeys ?? [])
  const [maxSeconds, setMaxSeconds] = useState(savedDraft?.maxSeconds ?? 30)
  const [resultLimit, setResultLimit] = useState(savedDraft?.resultLimit ?? 20)
  const [parentJobId, setParentJobId] = useState(savedDraft?.parentJobId)
  const [job, setJob] = useState<AutoLoadoutJobDetail>()
  const [selected, setSelected] = useState<AutoLoadoutResult>()
  const [tab, setTab] = useState<'conditions' | 'results'>(savedDraft?.tab ?? 'conditions')
  const [applyError, setApplyError] = useState<string>()
  const [starting, setStarting] = useState(false)
  const [editorSlot, setEditorSlot] = useState<LoadoutSlot>()
  const editorButtons = useRef<Partial<Record<LoadoutSlot, HTMLButtonElement | null>>>({})
  const returnSlot = useRef<LoadoutSlot>()
  useEffect(() => { if (!editorSlot && returnSlot.current) { editorButtons.current[returnSlot.current]?.focus(); returnSlot.current = undefined } }, [editorSlot])
  const [restoreJobId] = useState(() => savedDraft ? savedDraft.jobId : initialJobId)
  const [loadingJob, setLoadingJob] = useState(Boolean(restoreJobId))
  const [trackedJobId, setTrackedJobId] = useState(restoreJobId)
  const formReady = workingLoadout.dataVersion === snapshot.dataVersion
  useEffect(() => {
    saveAutoLoadoutDraft(snapshot.gameId, { baseLoadout: workingLoadout, targetKeys, maxSeconds, resultLimit, parentJobId, tab, jobId: trackedJobId })
  }, [workingLoadout, targetKeys, maxSeconds, resultLimit, parentJobId, tab, trackedJobId, snapshot.gameId])
  useEffect(() => {
    if (formReady) return
    let active = true
    void window.mhSaveEditor.loadout.reconcileLoadout(workingLoadout).then(value => { if (!active) return; if (value.gameId !== snapshot.gameId || value.dataVersion !== snapshot.dataVersion) throw new Error('资料版本再次变化，请关闭并重新进入配装页面'); setWorkingLoadout(value) }).catch(cause => { if (active) setApplyError(cause instanceof Error ? cause.message : '搜索草稿复核失败') })
    return () => { active = false }
  }, [formReady, workingLoadout, snapshot.dataVersion])

  const adoptJob = useCallback((detail: AutoLoadoutJobDetail) => {
    setJob(detail)
    setTrackedJobId(detail.jobId)
    setSelected(current => detail.results.find(result => result.fingerprint === current?.fingerprint || result.fingerprint === detail.selectedFingerprint))
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
        if (restoreJobId) { const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(restoreJobId); if (active) { adoptJob(detail); if (!savedDraft) setTab('results') }; return }
        if (savedDraft) return
        const jobs = await window.mhSaveEditor.loadout.listAutoLoadoutJobs({ gameId: snapshot.gameId, limit: 1 })
        if (active && jobs[0]) { const detail = await window.mhSaveEditor.loadout.getAutoLoadoutJob(jobs[0].jobId); if (!active) return; adoptJob(detail); if (detail.status === 'completed' && !detail.viewedAt) await window.mhSaveEditor.loadout.markAutoLoadoutJobViewed(detail.jobId) }
      } catch (cause) { if (active) setApplyError(cause instanceof Error ? cause.message : '恢复自动任务失败') }
      finally { if (active) setLoadingJob(false) }
    }
    void restore()
    return () => { active = false }
  }, [adoptJob, restoreJobId, savedDraft, snapshot.gameId])
  useEffect(() => window.mhSaveEditor.loadout.subscribeAutoLoadoutJobs(summary => { if (summary.jobId === job?.jobId) void refreshJob(summary.jobId).catch(cause => setApplyError(cause instanceof Error ? cause.message : '任务刷新失败')) }), [job?.jobId, refreshJob])

  const targets = useMemo(() => {
    const bySkill = new Map<number, AutoLoadoutTarget>()
    for (const key of targetKeys) { const item = activations.find(value => value.activationKey === key); if (!item) continue; const current = bySkill.get(item.skillId); if (!current || item.threshold > current.threshold) bySkill.set(item.skillId, { activationKey: item.activationKey, skillId: item.skillId, threshold: item.threshold, nameCn: item.nameCn }) }
    return [...bySkill.values()]
  }, [targetKeys, activations])
  const missingTarget = targetKeys.some(key => !activations.some(item => item.activationKey === key))
  const workingCalculation = useMemo(() => calculateLoadout(snapshot, workingLoadout), [snapshot, workingLoadout])
  const itemAt = (slot: LoadoutSlot) => slot === 'weapon' ? workingLoadout.weapon : slot === 'charm' ? workingLoadout.charm : workingLoadout.armor[slot]
  const setLock = (slot: LoadoutSlot, lock: string) => setWorkingLoadout(current => { const next = structuredClone(current); const item = slot === 'weapon' ? next.weapon : slot === 'charm' ? next.charm : next.armor[slot]; if (item) item.lock = lock as LoadoutLock; return next })
  const moveTarget = (index: number, direction: -1 | 1) => setTargetKeys(current => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= current.length) return current; const next = [...current]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; return next })
  const start = async () => {
    if (starting || !formReady || missingTarget || !workingLoadout.weapon || !targets.length || workingCalculation.encoding === 'blocked') return
    setStarting(true)
    setSelected(undefined); setApplyError(undefined); setTab('results')
    try {
      const summary = await window.mhSaveEditor.loadout.startAutoLoadout({ requestId: crypto.randomUUID(), gameId: snapshot.gameId, dataVersion: snapshot.dataVersion, baseLoadout: workingLoadout, targets, resultLimit, parentJobId, timeoutMs: Math.round(Math.min(120, Math.max(1, maxSeconds)) * 1000) })
      setTrackedJobId(summary.jobId)
      const latestDraft = getAutoLoadoutDraft(snapshot.gameId)
      if (latestDraft) saveAutoLoadoutDraft(snapshot.gameId, { ...latestDraft, jobId: summary.jobId })
      onJobStarted?.(summary.jobId)
      await refreshJob(summary.jobId)
    } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '启动失败') }
    finally { setStarting(false) }
  }
  const control = async (action: 'pause' | 'resume' | 'cancel') => { if (!job) return; try { await window.mhSaveEditor.loadout.controlAutoLoadoutJob(job.jobId, action); await refreshJob(job.jobId) } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '任务控制失败') } }
  const apply = async () => {
    if (!job || !selected) return
    setApplyError(undefined)
    try {
      const reconciled = await window.mhSaveEditor.loadout.reconcileLoadout({ ...selected.loadout, dataVersion: snapshot.dataVersion })
      validateAutoResult(snapshot, reconciled, job.targets)
      await window.mhSaveEditor.loadout.selectAutoLoadoutJobResult(job.jobId, selected.fingerprint)
      onApply(reconciled)
    } catch (cause) { setApplyError(cause instanceof Error ? cause.message : '结果复核失败') }
  }
  const newSearch = () => { setParentJobId(undefined); setResultLimit(20); setJob(undefined); setTrackedJobId(undefined); setSelected(undefined); setTargetKeys([]); setWorkingLoadout(() => { const value = structuredClone(loadout); if (value.weapon?.lock === 'unlocked') value.weapon.lock = 'equipment'; return value }); setTab('conditions'); setApplyError(undefined) }
  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, current: typeof drawerTabs[number]) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const next = drawerTabs[(drawerTabs.indexOf(current) + offset + drawerTabs.length) % drawerTabs.length]
    setTab(next)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[drawerTabs.indexOf(next)]?.focus()
  }

  const backToConditions = () => { setEditorSlot(undefined); setTab('conditions') }
  const applyEquipmentCondition = (value: AutoLoadoutEquipmentValue | null) => {
    if (!editorSlot) return
    const slot = editorSlot
    setWorkingLoadout(current => {
      const next = structuredClone(current)
      if (!value) {
        if (slot === 'weapon') next.weapon = null
        else if (slot === 'charm') next.charm = null
        else delete next.armor[slot]
      } else if (value.gameId === snapshot.gameId) {
        if (slot === 'weapon' && value.kind === 'weapon') next.weapon = { ...structuredClone(value), decorations: structuredClone(value.decorations ?? []), lock: current.weapon?.lock === 'equipmentAndDecorations' ? 'equipmentAndDecorations' : 'equipment' }
        else if (slot === 'charm' && value.kind === 'charm') next.charm = applyCharmValidation(snapshot, structuredClone(value))
        else if (slot !== 'weapon' && slot !== 'charm' && value.kind === 'armor' && value.part === slot) next.armor[slot] = { ...structuredClone(value), decorations: structuredClone(value.decorations ?? []), lock: current.armor[slot]?.lock ?? 'unlocked' }
      }
      return next
    })
    backToConditions()
  }
  const footer = editorSlot ? undefined : <><button type="button" onClick={onClose}>关闭</button><button type="button" className="auto-loadout-drawer__apply" disabled={!selected} onClick={() => void apply()}>应用结果</button></>
  return <LoadoutWorkspaceDrawer title={editorSlot ? `编辑搜索条件 · ${slotLabels[editorSlot]}` : '自动配装'} onBack={editorSlot ? backToConditions : undefined} onEscape={editorSlot ? backToConditions : onClose} onClose={onClose} footer={footer}>
    {editorSlot ? <AutoLoadoutEquipmentView key={editorSlot} slot={editorSlot} snapshot={snapshot} current={itemAt(editorSlot) ?? null} onApply={applyEquipmentCondition} onBack={backToConditions} onOpenCatalog={path => { onClose(); onOpenCatalog?.(path) }} /> : <div className="auto-loadout-drawer">
      <div className="auto-loadout-drawer__tabs" role="tablist" aria-label="自动配装步骤"><button className="auto-loadout-drawer__tab" type="button" role="tab" tabIndex={tab === 'conditions' ? 0 : -1} aria-selected={tab === 'conditions'} onKeyDown={event => moveTabFocus(event, 'conditions')} onClick={() => setTab('conditions')}>条件</button><button className="auto-loadout-drawer__tab" type="button" role="tab" tabIndex={tab === 'results' ? 0 : -1} aria-selected={tab === 'results'} onKeyDown={event => moveTabFocus(event, 'results')} onClick={() => setTab('results')}>任务与结果 {job?.resultCount ? `(${job.resultCount})` : ''}</button></div>
      {tab === 'conditions' && <section className="auto-loadout-drawer__conditions" role="tabpanel">
        <h3 className="auto-loadout-drawer__section-title">搜索条件草稿</h3>
        <p className="auto-loadout-drawer__summary">修改条件不会改变已有任务；点击开始搜索才创建新任务。{parentJobId ? ' 当前条件复制自历史任务，修改不会影响来源任务。' : ''} 最多返回 <b className="auto-loadout-drawer__data">{resultLimit}</b> 套。</p>
        {!formReady && <p className="auto-loadout-drawer__progress" role="status">正在按当前资料复核搜索草稿；失败时保留原条件。</p>}
        {missingTarget && <p className="auto-loadout-drawer__error" role="alert">部分目标技能在当前资料中不存在，请移除或重新选择。</p>}
        {applyError && <p className="auto-loadout-drawer__error" role="alert">{applyError}</p>}
        <p className="auto-loadout-drawer__summary">具体武器：<b className="auto-loadout-drawer__data">{workingLoadout.weapon?.nameCn ?? '未选择'}</b> · 性别：{workingLoadout.gender === 'male' ? '男性' : '女性'}</p>
        <label className="auto-loadout-drawer__target"><span className="auto-loadout-drawer__target-label">目标技能（可多选）</span><SearchableSelect multiple ariaLabel="自动配装目标技能" value={targetKeys} options={activations.map(item => ({ value: item.activationKey, label: `${item.nameCn}（${item.skillName} ${item.threshold}）`, keywords: [item.nameEn, item.nameJp, item.skillName] }))} onChange={setTargetKeys} /></label>
        {targetKeys.length > 0 && <div className="auto-loadout-drawer__target-list" aria-label="目标技能优先顺序">{targetKeys.map((key, index) => { const item = activations.find(value => value.activationKey === key); return <div className="auto-loadout-drawer__target-row" key={key}><span className="auto-loadout-drawer__target-name">{index + 1}. {item ? `${item.nameCn}（${item.skillName} ${item.threshold}）` : key}</span><button className="auto-loadout-drawer__target-action" type="button" disabled={index === 0} aria-label={`上移${item?.nameCn ?? key}`} onClick={() => moveTarget(index, -1)}><ArrowUp className="auto-loadout-drawer__target-icon" aria-hidden="true" />上移</button><button className="auto-loadout-drawer__target-action" type="button" disabled={index === targetKeys.length - 1} aria-label={`下移${item?.nameCn ?? key}`} onClick={() => moveTarget(index, 1)}><ArrowDown className="auto-loadout-drawer__target-icon" aria-hidden="true" />下移</button><button className="auto-loadout-drawer__target-action" type="button" aria-label={`移除${item?.nameCn ?? key}`} onClick={() => setTargetKeys(current => current.filter(value => value !== key))}><X className="auto-loadout-drawer__target-icon" aria-hidden="true" />移除</button></div> })}</div>}
        <label className="auto-loadout-drawer__duration"><span className="auto-loadout-drawer__duration-label">最大搜索时间</span><input className="auto-loadout-drawer__duration-input" type="number" min={1} max={120} step="any" value={maxSeconds} onChange={event => setMaxSeconds(Math.min(120, Math.max(1, Number(event.target.value) || 1)))} /><span className="auto-loadout-drawer__duration-unit">秒（1～120）</span></label>
        <div className="auto-loadout-drawer__locks"><h4 className="auto-loadout-drawer__subheading">固定槽位</h4>{getLoadoutSlots(snapshot.gameId).map(slot => { const item = itemAt(slot); const options = slot === 'weapon' ? lockOptions.filter(option => option.value !== 'unlocked') : lockOptions; return <div className="auto-loadout-drawer__lock" key={slot}><LoadoutSlotIcon gameId={snapshot.gameId} slot={slot} item={item} size="small" /><span className="auto-loadout-drawer__lock-name">{item ? ('classNameCn' in item ? item.classNameCn : item.nameCn) : '未选择'}</span><SearchableSelect ariaLabel={`${slotLabels[slot]}固定状态`} value={item?.lock ?? 'unlocked'} disabled={!item || !formReady} options={options} onChange={value => setLock(slot, value)} /><button type="button" className="auto-loadout-drawer__control" disabled={!formReady || starting} aria-label={`编辑搜索${slotLabels[slot]}`} ref={button => { editorButtons.current[slot] = button }} onClick={() => { returnSlot.current = slot; setEditorSlot(slot) }}>编辑</button></div> })}</div>
        <div className="auto-loadout-drawer__preflight" data-state={workingCalculation.encoding}>{!workingLoadout.weapon ? '请编辑武器槽，选择具体武器。' : !targets.length ? '请选择至少一个正向发动技能。' : workingCalculation.encoding === 'blocked' ? `当前固定输入不可编码：${workingCalculation.issues.find(issue => issue.severity === 'error')?.message ?? '请检查诊断'}` : snapshot.gameId === 'mhp2g' ? '指定武器始终固定；自动结果需符合性别、职业和孔位限制，负技能会保留并显示。' : '指定武器始终固定；发掘、非法护石或超孔珠只有明确固定时才作为常量保留。'}</div>
        <div className="auto-loadout-drawer__controls"><button className="auto-loadout-drawer__control" type="button" disabled={starting || !formReady || missingTarget || !workingLoadout.weapon || !targets.length || workingCalculation.encoding === 'blocked'} onClick={() => void start()}><Search className="auto-loadout-drawer__control-icon" aria-hidden="true" />开始搜索</button></div>
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
        <AutoLoadoutResultList job={job} results={job?.results ?? []} selected={selected?.fingerprint} onSelect={setSelected} />
      </section>}
    </div>}
  </LoadoutWorkspaceDrawer>
}
