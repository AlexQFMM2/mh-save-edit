import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { calculateLoadout } from '../../../api/loadout/calculator'
import { applyCharmValidation } from '../../../api/loadout/charm'
import { normalizeLegacyTransientLoadoutFields } from '../../../api/loadout/file'
import { logicalLoadoutSchema } from '../../../api/loadout/schemas'
import { createEmptyLogicalLoadout, LOADOUT_SLOTS, type ArmorLoadoutSlot, type AutoLoadoutJobSummary, type LoadoutArmorCandidate, type LoadoutCalculationSnapshot, type LoadoutDecoration, type LoadoutFacets, type LoadoutLock, type LoadoutSlot, type LoadoutWeaponCandidate, type LogicalLoadout } from '../../../api/loadout/types'
import { AutoLoadoutDrawer } from '../../components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { AutoLoadoutHistoryDrawer } from '../../components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer'
import { CharmPickerDrawer } from '../../components/CharmPickerDrawer/CharmPickerDrawer'
import { DecorationEditorDrawer } from '../../components/DecorationEditorDrawer/DecorationEditorDrawer'
import { EquipmentPickerDrawer } from '../../components/EquipmentPickerDrawer/EquipmentPickerDrawer'
import { LoadoutEquipmentTable } from '../../components/LoadoutEquipmentTable/LoadoutEquipmentTable'
import { LoadoutLegalitySummary } from '../../components/LoadoutLegalitySummary/LoadoutLegalitySummary'
import { LoadoutSkillMatrix } from '../../components/LoadoutSkillMatrix/LoadoutSkillMatrix'
import { LoadoutToolbar } from '../../components/LoadoutToolbar/LoadoutToolbar'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './LoadoutBuilderPage.css'

type Drawer = { kind: 'equipment'; slot: 'weapon' | ArmorLoadoutSlot } | { kind: 'charm' } | { kind: 'decorations'; slot: LoadoutSlot } | { kind: 'auto' } | { kind: 'history' } | null
const clone = <T,>(value: T): T => structuredClone(value)
const cycleLock = (lock: LoadoutLock): LoadoutLock => lock === 'unlocked' ? 'equipment' : lock === 'equipment' ? 'equipmentAndDecorations' : 'unlocked'

export function LoadoutBuilderPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [snapshot, setSnapshot] = useState<LoadoutCalculationSnapshot>()
  const [facets, setFacets] = useState<LoadoutFacets>()
  const [loadout, setLoadout] = useState<LogicalLoadout>()
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [jobs, setJobs] = useState<AutoLoadoutJobSummary[]>([])
  const [currentAutoJobId, setCurrentAutoJobId] = useState<string>()
  const undo = useRef<LogicalLoadout[]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    const api = window.mhSaveEditor?.loadout
    if (!api) { setError('配装器 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return () => { active = false } }
    void Promise.all([api.getBootstrap(game.id), api.getFacets(game.id)]).then(([value, nextFacets]) => {
      if (!active) return
      setSnapshot(value)
      setFacets(nextFacets)
      setLoadout(createEmptyLogicalLoadout(game.id, value.dataVersion))
      setCurrentAutoJobId(undefined)
      undo.current = []
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '配装资料读取失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [game.id])

  const refreshJobs = useCallback(async () => {
    try { setJobs(await window.mhSaveEditor.loadout.listAutoLoadoutJobs({ limit: 500 })) } catch { /* Catalog remains usable if local history is unavailable. */ }
  }, [])
  useEffect(() => {
    void refreshJobs()
    return window.mhSaveEditor.loadout.subscribeAutoLoadoutJobs(summary => setJobs(current => {
      const index = current.findIndex(job => job.jobId === summary.jobId)
      if (index < 0) return [summary, ...current]
      const previous = current[index]
      if (previous.status === summary.status && previous.viewedAt === summary.viewedAt) return current
      const next = [...current]
      next[index] = summary
      return next
    }))
  }, [refreshJobs])

  const commit = useCallback((recipe: (current: LogicalLoadout) => LogicalLoadout) => setLoadout(current => {
    if (!current) return current
    undo.current.push(clone(current))
    if (undo.current.length > 30) undo.current.shift()
    return recipe(clone(current))
  }), [])
  const result = useMemo(() => snapshot && loadout ? calculateLoadout(snapshot, loadout) : undefined, [snapshot, loadout])
  const equipment = (slot: LoadoutSlot) => { if (!loadout) return null; if (slot === 'weapon') return loadout.weapon; if (slot === 'charm') return loadout.charm; return loadout.armor[slot] ?? null }
  const clear = (slot: LoadoutSlot) => commit(current => { if (slot === 'weapon') current.weapon = null; else if (slot === 'charm') current.charm = null; else delete current.armor[slot]; return current })
  const choose = (slot: LoadoutSlot) => setDrawer(slot === 'charm' ? { kind: 'charm' } : { kind: 'equipment', slot })
  const applyEquipment = (slot: 'weapon' | ArmorLoadoutSlot, candidate: LoadoutWeaponCandidate | LoadoutArmorCandidate) => {
    const removedDecorations = equipment(slot)?.decorations.length ?? 0
    commit(current => { if (slot === 'weapon' && candidate.kind === 'weapon') current.weapon = { ...clone(candidate), decorations: [], lock: current.weapon?.lock ?? 'unlocked' }; else if (slot !== 'weapon' && candidate.kind === 'armor') current.armor[slot] = { ...clone(candidate), decorations: [], lock: current.armor[slot]?.lock ?? 'unlocked' }; return current })
    setNotice(removedDecorations ? `已更换装备并移除原来的 ${removedDecorations} 颗装饰珠` : '已更换装备')
    setDrawer(null)
  }
  const applyCharm = (charm: NonNullable<LogicalLoadout['charm']>) => { if (!snapshot) return; commit(current => ({ ...current, charm: applyCharmValidation(snapshot, charm) })); setDrawer(null) }
  const applyDecorations = (slot: LoadoutSlot, decorations: LoadoutDecoration[]) => { commit(current => { if (slot === 'weapon' && current.weapon) current.weapon.decorations = decorations; else if (slot === 'charm' && current.charm) current.charm.decorations = decorations; else if (slot !== 'weapon' && slot !== 'charm' && current.armor[slot]) current.armor[slot]!.decorations = decorations; return current }); setDrawer(null) }
  const toggleLock = (slot: LoadoutSlot) => commit(current => { const item = slot === 'weapon' ? current.weapon : slot === 'charm' ? current.charm : current.armor[slot]; if (item) item.lock = cycleLock(item.lock); return current })
  const newLoadout = () => { if (!snapshot) return; if (loadout) undo.current.push(clone(loadout)); setLoadout(createEmptyLogicalLoadout(game.id, snapshot.dataVersion)); setNotice('已创建新配装') }
  const undoOnce = () => { const previous = undo.current.pop(); if (previous) { setLoadout(previous); setNotice('已撤销上一步') } }
  const applyAutoResult = (value: LogicalLoadout) => { commit(() => value); setDrawer(null); setNotice('已应用自动配装结果，可撤销') }

  const importFile = async (file: File) => {
    try {
      const checked = logicalLoadoutSchema.safeParse(normalizeLegacyTransientLoadoutFields(JSON.parse(await file.text())))
      if (!checked.success) throw new Error(`配装文件结构无效：${checked.error.issues[0]?.message ?? '未知字段错误'}`)
      if (!snapshot) throw new Error('当前配装资料尚未加载')
      const versionChanged = checked.data.dataVersion !== snapshot.dataVersion
      const reconciled = await window.mhSaveEditor.loadout.reconcileLoadout(checked.data)
      if (loadout) undo.current.push(clone(loadout))
      setLoadout(reconciled)
      setNotice(versionChanged ? '配装已按当前资料迁移并重新计算' : '配装已按当前资料重新读取并计算')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : '导入失败') }
  }
  const exportFile = () => { if (!loadout) return; const blob = new Blob([JSON.stringify(loadout, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${loadout.name || 'loadout'}.mhloadout.json`; anchor.click(); URL.revokeObjectURL(url) }

  if (loading) return <div className="loadout-builder-page__state" role="status">正在加载配装资料…</div>
  if (error || !snapshot || !facets || !loadout || !result) return <div className="loadout-builder-page__state loadout-builder-page__state--error" role="alert">{error ?? '配装资料不可用'}</div>
  const activeDecoration = drawer?.kind === 'decorations' ? equipment(drawer.slot) : null
  const activeJobCount = jobs.filter(job => job.status === 'running').length
  const unreadJobCount = jobs.filter(job => job.status === 'completed' && !job.viewedAt).length

  return <div className="loadout-builder-page">
    <LoadoutToolbar loadout={loadout} result={result} notice={notice} canUndo={undo.current.length > 0} activeJobCount={activeJobCount} unreadJobCount={unreadJobCount} onUndo={undoOnce} onNameChange={value => commit(current => ({ ...current, name: value }))} onGenderChange={value => commit(current => ({ ...current, gender: value }))} onReset={() => { undo.current.push(clone(loadout)); setLoadout(createEmptyLogicalLoadout(game.id, snapshot.dataVersion)); setNotice('已重置配装') }} onNew={newLoadout} onImport={importFile} onExport={exportFile} onOpenAuto={() => setDrawer({ kind: 'auto' })} onOpenHistory={() => setDrawer({ kind: 'history' })} />
    <LoadoutEquipmentTable slots={LOADOUT_SLOTS} loadout={loadout} result={result} onChoose={choose} onClear={clear} onDecorate={slot => setDrawer({ kind: 'decorations', slot })} onToggleLock={toggleLock} />
    <div className="loadout-builder-page__analysis"><LoadoutSkillMatrix skills={result.skills} /><LoadoutLegalitySummary result={result} onIssueClick={path => setNotice(`问题位置：${path}`)} /></div>
    {drawer?.kind === 'equipment' && <EquipmentPickerDrawer gameId={game.id} slot={drawer.slot} facets={facets} relicLookups={snapshot.relicLookups} current={equipment(drawer.slot) as LoadoutWeaponCandidate | LoadoutArmorCandidate | null} onApply={candidate => applyEquipment(drawer.slot, candidate)} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'charm' && <CharmPickerDrawer snapshot={snapshot} current={loadout.charm} onApply={applyCharm} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'decorations' && activeDecoration && <DecorationEditorDrawer decorations={snapshot.decorations} skills={snapshot.skills} current={activeDecoration.decorations} capacity={activeDecoration.slots} onApply={value => applyDecorations(drawer.slot, value)} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'auto' && <AutoLoadoutDrawer snapshot={snapshot} loadout={loadout} calculation={result} initialJobId={currentAutoJobId} onJobStarted={setCurrentAutoJobId} onApply={applyAutoResult} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'history' && <AutoLoadoutHistoryDrawer gameId={game.id} snapshot={snapshot} onApply={applyAutoResult} onJobsChanged={refreshJobs} onClose={() => setDrawer(null)} />}
  </div>
}
