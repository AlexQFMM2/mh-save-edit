import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { commitLoadoutDraft, getLoadoutDraft, restoreLoadoutDraft, setLoadoutDraftJob, subscribeLoadoutDraft, undoLoadoutDraft } from '../../stores/loadoutDraftStore'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { calculateLoadout } from '../../../api/loadout/calculator'
import { applyCharmValidation } from '../../../api/loadout/charm'
import { normalizeLegacyTransientLoadoutFields } from '../../../api/loadout/file'
import { logicalLoadoutSchema } from '../../../api/loadout/schemas'
import { createEmptyLogicalLoadout, getLoadoutSlots, type ArmorLoadoutSlot, type AutoLoadoutJobSummary, type LoadoutArmorCandidate, type LoadoutCalculationSnapshot, type LoadoutDecoration, type LoadoutFacets, type LoadoutLock, type LoadoutSlot, type LoadoutWeaponCandidate, type LogicalLoadout } from '../../../api/loadout/types'
import { AutoLoadoutDrawer } from '../../components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { AutoLoadoutHistoryDrawer } from '../../components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer'
import { CharmPickerDrawer } from '../../components/CharmPickerDrawer/CharmPickerDrawer'
import { DecorationEditorDrawer } from '../../components/DecorationEditorDrawer/DecorationEditorDrawer'
import { EquipmentPickerDrawer } from '../../components/EquipmentPickerDrawer/EquipmentPickerDrawer'
import { LoadoutEquipmentTable } from '../../components/LoadoutEquipmentTable/LoadoutEquipmentTable'
import { LoadoutLegalitySummary } from '../../components/LoadoutLegalitySummary/LoadoutLegalitySummary'
import { LoadoutSaveWriteDrawer } from '../../components/LoadoutSaveWriteDrawer/LoadoutSaveWriteDrawer'
import { LoadoutSkillMatrix } from '../../components/LoadoutSkillMatrix/LoadoutSkillMatrix'
import { LoadoutToolbar } from '../../components/LoadoutToolbar/LoadoutToolbar'
import type { ShellOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import type { SaveLoadoutWritePreview } from '../../../api/save/types'
import { useSaveSession } from '../../components/SaveSessionProvider/SaveSessionProvider'
import './LoadoutBuilderPage.css'

type Drawer = { kind: 'equipment'; slot: 'weapon' | ArmorLoadoutSlot } | { kind: 'charm' } | { kind: 'decorations'; slot: LoadoutSlot } | { kind: 'auto' } | { kind: 'history' } | { kind: 'save'; preview: SaveLoadoutWritePreview } | null
const clone = <T,>(value: T): T => structuredClone(value)
const cycleLock = (lock: LoadoutLock): LoadoutLock => lock === 'unlocked' ? 'equipment' : lock === 'equipment' ? 'equipmentAndDecorations' : 'unlocked'

export function LoadoutBuilderPage() {
  const navigate = useNavigate()
  const { game } = useOutletContext<ShellOutletContext>()
  const saveSession = useSaveSession()
  const [snapshot, setSnapshot] = useState<LoadoutCalculationSnapshot>()
  const [facets, setFacets] = useState<LoadoutFacets>()
  const draft = useSyncExternalStore(subscribeLoadoutDraft, useCallback(() => getLoadoutDraft(game.id), [game.id]))
  const loadout = draft.loadout
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [jobs, setJobs] = useState<AutoLoadoutJobSummary[]>([])
  const currentAutoJobId = draft.autoJobId
  const setCurrentAutoJobId = (jobId: string) => setLoadoutDraftJob(game.id, jobId)
  const [writeBusy, setWriteBusy] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    setDrawer(null)
    setNotice(undefined)
    const api = window.mhSaveEditor?.loadout
    if (!api) { setError('配装器 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return () => { active = false } }
    void Promise.all([api.getBootstrap(game.id), api.getFacets(game.id)]).then(async ([value, nextFacets]) => {
      if (!active) return
      const saved = getLoadoutDraft(game.id)
      let restored = saved.loadout ?? createEmptyLogicalLoadout(game.id, value.dataVersion)
      let history = saved.undo
      if (restored.dataVersion !== value.dataVersion || history.some(entry => entry.dataVersion !== value.dataVersion)) {
        const reconciled = await Promise.all([restored, ...history].map(entry => api.reconcileLoadout(entry)))
        if (reconciled.some(entry => entry.gameId !== game.id || entry.dataVersion !== value.dataVersion)) throw new Error('资料版本再次变化，请重新进入配装页面；原草稿已保留')
        restored = reconciled[0]; history = reconciled.slice(1)
      }
      if (!active) return
      restoreLoadoutDraft(game.id, restored, history)
      setSnapshot(value)
      setFacets(nextFacets)
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

  const commit = useCallback((recipe: (current: LogicalLoadout) => LogicalLoadout) => commitLoadoutDraft(game.id, recipe), [game.id])
  const result = useMemo(() => snapshot?.gameId === game.id && loadout?.gameId === game.id ? calculateLoadout(snapshot, loadout) : undefined, [snapshot, loadout, game.id])
  const equipment = (slot: LoadoutSlot) => { if (!loadout) return null; if (slot === 'weapon') return loadout.weapon; if (slot === 'charm') return loadout.charm; return loadout.armor[slot] ?? null }
  const clear = (slot: LoadoutSlot) => commit(current => { if (slot === 'weapon') current.weapon = null; else if (slot === 'charm') current.charm = null; else delete current.armor[slot]; return current })
  const choose = (slot: LoadoutSlot) => setDrawer(slot === 'charm' ? { kind: 'charm' } : { kind: 'equipment', slot })
  const applyEquipment = (slot: 'weapon' | ArmorLoadoutSlot, candidate: LoadoutWeaponCandidate | LoadoutArmorCandidate) => {
    const removedDecorations = equipment(slot)?.decorations.length ?? 0
    commit(current => { if (slot === 'weapon' && candidate.kind === 'weapon') current.weapon = { ...clone(candidate), decorations: clone(candidate.decorations ?? []), lock: current.weapon?.lock ?? 'unlocked' }; else if (slot !== 'weapon' && candidate.kind === 'armor') current.armor[slot] = { ...clone(candidate), decorations: clone(candidate.decorations ?? []), lock: current.armor[slot]?.lock ?? 'unlocked' }; return current })
    setNotice(removedDecorations ? `已更换装备并移除原来的 ${removedDecorations} 颗装饰珠` : '已更换装备')
    setDrawer(null)
  }
  const applyCharm = (charm: NonNullable<LogicalLoadout['charm']>) => { if (!snapshot) return; commit(current => ({ ...current, charm: applyCharmValidation(snapshot, charm) })); setDrawer(null) }
  const applyDecorations = (slot: LoadoutSlot, decorations: LoadoutDecoration[]) => { commit(current => { if (slot === 'weapon' && current.weapon) current.weapon.decorations = decorations; else if (slot === 'charm' && current.charm) current.charm.decorations = decorations; else if (slot !== 'weapon' && slot !== 'charm' && current.armor[slot]) current.armor[slot]!.decorations = decorations; return current }); setNotice('装饰珠已即时更新，可逐步撤销') }
  const toggleLock = (slot: LoadoutSlot) => commit(current => { const item = slot === 'weapon' ? current.weapon : slot === 'charm' ? current.charm : current.armor[slot]; if (item) item.lock = cycleLock(item.lock); return current })
  const newLoadout = () => { if (!snapshot) return; commit(() => createEmptyLogicalLoadout(game.id, snapshot.dataVersion)); setNotice('已创建新配装') }
  const undoOnce = () => { if (undoLoadoutDraft(game.id)) setNotice('已撤销上一步') }
  const applyAutoResult = (value: LogicalLoadout) => { commit(() => value); setDrawer(null); setNotice('已应用自动配装结果，可撤销') }
  const openWritePreview = async () => {
    const current = saveSession.session
    if (!current || !loadout || current.contentGameId !== game.id || current.readOnly) return
    setWriteBusy(true)
    try {
      const preview = await window.mhSaveEditor.save.previewLoadoutWrite({ sessionId: current.sessionId, revision: current.revision, loadout })
      setDrawer({ kind: 'save', preview })
    } catch (cause) {
      saveSession.notify(cause instanceof Error ? cause.message : '无法预览装备箱写入', 'error')
    } finally { setWriteBusy(false) }
  }
  const applyWritePreview = async () => {
    const current = saveSession.session
    if (!current || !loadout) return
    setWriteBusy(true)
    try {
      const value = await window.mhSaveEditor.save.addLoadout({ sessionId: current.sessionId, revision: current.revision, loadout })
      saveSession.notify(value.message)
      setNotice('整套配装已加入装备箱，尚未保存')
      setDrawer(null)
    } catch (cause) { saveSession.notify(cause instanceof Error ? cause.message : '写入装备箱失败', 'error') } finally { setWriteBusy(false) }
  }

  const importFile = async (file: File) => {
    try {
      const checked = logicalLoadoutSchema.safeParse(normalizeLegacyTransientLoadoutFields(JSON.parse(await file.text())))
      if (!checked.success) throw new Error(`配装文件结构无效：${checked.error.issues[0]?.message ?? '未知字段错误'}`)
      if (!snapshot) throw new Error('当前配装资料尚未加载')
      if (checked.data.gameId !== game.id) throw new Error('文件游戏版本与当前页面不匹配')
      const versionChanged = checked.data.dataVersion !== snapshot.dataVersion
      const reconciled = await window.mhSaveEditor.loadout.reconcileLoadout(checked.data)
      commit(() => reconciled)
      setNotice(versionChanged ? '配装已按当前资料迁移并重新计算' : '配装已按当前资料重新读取并计算')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : '导入失败') }
  }
  const exportFile = () => { if (!loadout) return; const blob = new Blob([JSON.stringify(loadout, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${loadout.name || 'loadout'}.mhloadout.json`; anchor.click(); URL.revokeObjectURL(url) }

  if (loading || (!error && snapshot?.gameId !== game.id)) return <div className="loadout-builder-page__state" role="status">正在加载配装资料…</div>
  if (error || !snapshot || !facets || !loadout || !result) return <div className="loadout-builder-page__state loadout-builder-page__state--error" role="alert">{error ?? '配装资料不可用'}</div>
  const activeDecoration = drawer?.kind === 'decorations' ? equipment(drawer.slot) : null
  const activeJobCount = jobs.filter(job => job.status === 'running').length
  const unreadJobCount = jobs.filter(job => job.status === 'completed' && !job.viewedAt).length

  return <div className="loadout-builder-page">
    <LoadoutToolbar loadout={loadout} result={result} notice={notice} canUndo={draft.undo.length > 0} activeJobCount={activeJobCount} unreadJobCount={unreadJobCount} onUndo={undoOnce} onNameChange={value => commit(current => ({ ...current, name: value }))} onGenderChange={value => commit(current => ({ ...current, gender: value }))} onReset={() => { commit(() => createEmptyLogicalLoadout(game.id, snapshot.dataVersion)); setNotice('已重置配装') }} onNew={newLoadout} onImport={importFile} onExport={exportFile} onOpenAuto={() => setDrawer({ kind: 'auto' })} onOpenHistory={() => setDrawer({ kind: 'history' })} onWriteToSave={saveSession.session?.contentGameId === game.id && !saveSession.session.readOnly ? () => void openWritePreview() : undefined} />
    <LoadoutEquipmentTable slots={getLoadoutSlots(game.id)} loadout={loadout} result={result} onChoose={choose} onClear={clear} onDecorate={slot => setDrawer({ kind: 'decorations', slot })} onToggleLock={toggleLock} />
    <div className="loadout-builder-page__analysis"><LoadoutSkillMatrix gameId={game.id} skills={result.skills} /><LoadoutLegalitySummary result={result} onIssueClick={path => setNotice(`问题位置：${path}`)} /></div>
    {drawer?.kind === 'equipment' && <EquipmentPickerDrawer gameId={game.id} slot={drawer.slot} facets={facets} relicLookups={snapshot.relicLookups} decorations={snapshot.decorations} current={equipment(drawer.slot) as LoadoutWeaponCandidate | LoadoutArmorCandidate | null} onOpenCatalog={navigate} onApply={candidate => applyEquipment(drawer.slot, candidate)} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'charm' && <CharmPickerDrawer snapshot={snapshot} current={loadout.charm} onApply={applyCharm} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'decorations' && activeDecoration && <DecorationEditorDrawer decorations={snapshot.decorations} skills={snapshot.skills} current={activeDecoration.decorations} capacity={activeDecoration.slots} canUndo={draft.undo.length > 0} onUndo={undoOnce} onChange={value => applyDecorations(drawer.slot, value)} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'auto' && <AutoLoadoutDrawer onOpenCatalog={navigate} snapshot={snapshot} loadout={loadout} calculation={result} initialJobId={currentAutoJobId} onJobStarted={setCurrentAutoJobId} onApply={applyAutoResult} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'history' && <AutoLoadoutHistoryDrawer gameId={game.id} snapshot={snapshot} onApply={applyAutoResult} onJobsChanged={refreshJobs} onCopyConditions={() => setDrawer({ kind: 'auto' })} onClose={() => setDrawer(null)} />}
    {drawer?.kind === 'save' && <LoadoutSaveWriteDrawer preview={drawer.preview} busy={writeBusy} onClose={() => setDrawer(null)} onApply={() => void applyWritePreview()} />}
  </div>
}
