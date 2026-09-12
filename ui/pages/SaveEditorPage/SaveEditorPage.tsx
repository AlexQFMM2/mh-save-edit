import { Cat, PackageOpen, Shield, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { SaveBoxDomain, SaveBoxSection, SaveEquipmentCell, SaveItemCell, SaveSectionKey, SaveSectionSnapshot } from '../../../api/save/types'
import { ConfirmationDialog } from '../../components/ConfirmationDialog/ConfirmationDialog'
import { SaveBoxTransferDrawer } from '../../components/SaveBoxTransferDrawer/SaveBoxTransferDrawer'
import { SaveBoxWorkspace, type SaveBoxViewFilter } from '../../components/SaveBoxWorkspace/SaveBoxWorkspace'
import { SaveCharacterPicker } from '../../components/SaveCharacterPicker/SaveCharacterPicker'
import { SaveEnvironmentPicker } from '../../components/SaveEnvironmentPicker/SaveEnvironmentPicker'
import { SaveEquipmentEditorDrawer } from '../../components/SaveEquipmentEditorDrawer/SaveEquipmentEditorDrawer'
import { SaveItemPickerDrawer } from '../../components/SaveItemPickerDrawer/SaveItemPickerDrawer'
import { SavePalicoEditor } from '../../components/SavePalicoEditor/SavePalicoEditor'
import { SavePersonalEditor } from '../../components/SavePersonalEditor/SavePersonalEditor'
import { SaveSessionHeader } from '../../components/SaveSessionHeader/SaveSessionHeader'
import { useSaveSession } from '../../components/SaveSessionProvider/SaveSessionProvider'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './SaveEditorPage.css'

const tabs = [
  { id: 'personal-info' as const, label: '个人信息', icon: UserRound },
  { id: 'item-box' as const, label: '道具箱', icon: PackageOpen },
  { id: 'equipment-box' as const, label: '装备箱', icon: Shield },
  { id: 'palico' as const, label: '猫猫', icon: Cat },
]
type Transfer = { mode: 'import' | 'export'; domain: SaveBoxDomain } | null
type EquipmentEdit = { cell: SaveEquipmentCell; domain: 'hunter-equipment' | 'palico-equipment' } | null
type Confirm = { title: string; message: string; confirmLabel: string; action(): void } | null
const sectionKeys: SaveSectionKey[] = ['personal-info', 'item-box', 'equipment-box', 'palico']
const sectionFromUrl = (value: string | null): SaveSectionKey => sectionKeys.includes(value as SaveSectionKey) ? value as SaveSectionKey : 'personal-info'

export function SaveEditorPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>(); const api = useSaveSession(); const { session, characters, busy } = api
  const [params, setParams] = useSearchParams(); const requestedTab = sectionFromUrl(params.get('tab')); const urlTab = requestedTab === 'palico' && game.id !== 'mhgu' ? 'personal-info' : requestedTab
  const [tab, setTab] = useState<SaveSectionKey>(urlTab)
  const [page, setPage] = useState<Record<string, number>>({ 'item-box': 1, 'hunter-equipment': 1, 'palico-equipment': 1 })
  const [boxSelection, setBoxSelection] = useState<Record<string, number | undefined>>({}); const [boxQuery, setBoxQuery] = useState<Record<string, string>>({}); const [boxQueryDraft, setBoxQueryDraft] = useState<Record<string, string>>({}); const [boxViewFilter, setBoxViewFilter] = useState<Record<string, SaveBoxViewFilter>>({})
  const [equipmentDomain, setEquipmentDomain] = useState<'hunter-equipment' | 'palico-equipment'>('hunter-equipment'); const [palicoIndex, setPalicoIndex] = useState(0)
  const [section, setSection] = useState<SaveSectionSnapshot>(); const [loading, setLoading] = useState(false); const [sectionError, setSectionError] = useState<string>()
  const [personalDraftInvalid, setPersonalDraftInvalid] = useState(false); const [palicoDraftDirty, setPalicoDraftDirty] = useState(false); const [characterPickerOpen, setCharacterPickerOpen] = useState(false)
  const [locateAfterSlot, setLocateAfterSlot] = useState<number>()
  const [itemPicker, setItemPicker] = useState<SaveItemCell>(); const [equipmentEdit, setEquipmentEdit] = useState<EquipmentEdit>(null); const [transfer, setTransfer] = useState<Transfer>(null); const [confirm, setConfirm] = useState<Confirm>(null); const request = useRef(0)
  const availableTabs = tabs.filter(value => value.id !== 'palico' || session?.capabilities.hasPalicoes)
  const domain: SaveBoxDomain | undefined = tab === 'item-box' ? 'items' : tab === 'equipment-box' ? equipmentDomain : undefined
  const currentPage = tab === 'item-box' ? page['item-box'] : tab === 'equipment-box' ? page[equipmentDomain] : 1
  const showEquipmentSubtabs = tab === 'equipment-box' && Boolean(session?.capabilities.palicoEquipmentCapacity)
  const localDraftBlocked = personalDraftInvalid || palicoDraftDirty

  useEffect(() => { api.setNavigationBlockReason(session && localDraftBlocked ? personalDraftInvalid ? '请先修正个人信息中的无效输入，再离开修改页面' : '请先应用或放弃当前猎猫草稿，再离开修改页面' : null) }, [api.setNavigationBlockReason, localDraftBlocked, palicoDraftDirty, personalDraftInvalid, session])
  useEffect(() => { if (!personalDraftInvalid && urlTab !== tab) setTab(urlTab) }, [personalDraftInvalid, tab, urlTab])

  useEffect(() => {
    if (!domain) return
    const value = boxQueryDraft[domain] ?? ''
    if (value === (boxQuery[domain] ?? '')) return
    const timer = window.setTimeout(() => { setBoxQuery(current => ({ ...current, [domain]: value })); setLocateAfterSlot(undefined) }, 160)
    return () => window.clearTimeout(timer)
  }, [boxQuery, boxQueryDraft, domain])

  useEffect(() => {
    if (!session || session.state === 'selectingCharacter' || session.contentGameId !== game.id) { setSection(undefined); return }
    const sequence = ++request.current; setLoading(true); setSectionError(undefined)
    const query = domain ? boxQuery[domain] ?? '' : undefined
    void api.getSection({ section: tab, page: currentPage, domain, selectedIndex: tab === 'palico' ? palicoIndex : undefined, query, locateAfterSlot })
      .then(value => { if (sequence !== request.current) return; setSection(value); if ((value.kind === 'item-box' || value.kind === 'equipment-box') && locateAfterSlot != null) { const slot = value.matchingSlots?.[0]; if (slot != null) { setPage(current => ({ ...current, [value.kind === 'item-box' ? 'item-box' : value.domain]: Math.floor(slot / 100) + 1 })); setBoxSelection(current => ({ ...current, [value.domain]: slot })) } setLocateAfterSlot(undefined) } })
      .catch(cause => { if (sequence === request.current) setSectionError(cause instanceof Error ? cause.message : '读取 section 失败') })
      .finally(() => { if (sequence === request.current) setLoading(false) })
  }, [api.getSection, boxQuery, currentPage, domain, game.id, locateAfterSlot, palicoIndex, session, tab])
  useEffect(() => { setTab(urlTab); setPage({ 'item-box': 1, 'hunter-equipment': 1, 'palico-equipment': 1 }); setBoxSelection({}); setBoxQuery({}); setBoxQueryDraft({}); setBoxViewFilter({}); setEquipmentDomain('hunter-equipment'); setPalicoIndex(0); setPalicoDraftDirty(false) }, [session?.sessionId, session?.characterSlot])

  if (!session) return <SaveEnvironmentPicker gameId={game.id} busy={busy} error={api.error} onOpen={formatId => void api.open({ contentGameId: game.id, formatId }).catch(() => undefined)} />
  if (session.contentGameId !== game.id) return <section className="save-editor-page__mismatch"><h1>当前存档属于其他游戏</h1><p>已读取的是 {session.contentGameId.toUpperCase()} 存档。请返回对应版本，或关闭当前会话后再读取。</p><button type="button" onClick={() => setConfirm({ title: '关闭当前存档会话？', message: session.dirty ? '当前会话有未保存修改，关闭后将丢失。' : '关闭后可读取当前游戏的存档。', confirmLabel: '关闭会话', action: () => { void api.close(true); setConfirm(null) } })}>关闭当前会话</button>{confirm && <ConfirmationDialog {...confirm} destructive onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}</section>

  const mutate = async (command: Parameters<typeof api.apply>[0]) => { await api.apply(command) }
  const selectTab = (next: SaveSectionKey) => {
    if (next !== tab && localDraftBlocked) { api.notify(personalDraftInvalid ? '请先修正个人信息中的无效输入' : '请先应用或放弃当前猎猫草稿', 'warning'); return }
    setTab(next)
    setParams(current => { const value = new URLSearchParams(current); if (next === 'personal-info') value.delete('tab'); else value.set('tab', next); return value })
  }
  const clear = (box: SaveBoxSection, slot: number) => setConfirm({ title: '清空这个箱格？', message: `第 ${Math.floor(slot / 100) + 1} 页第 ${slot % 100 + 1} 格会变为空格。操作可撤销，保存前不会写盘。`, confirmLabel: '清空', action: () => { void mutate({ kind: 'clear-box-slot', domain: box.domain, slot }).then(() => setConfirm(null)) } })
  const copy = (box: SaveBoxSection, sourceSlot: number) => setConfirm({ title: '复制到首个空格？', message: `第 ${Math.floor(sourceSlot / 100) + 1} 页第 ${sourceSlot % 100 + 1} 格会完整复制到当前箱域的第一个空物理格。`, confirmLabel: '复制', action: () => { void mutate({ kind: 'copy-box-slot', domain: box.domain, sourceSlot }).then(() => setConfirm(null)) } })

  return <div className={`save-editor-page${showEquipmentSubtabs ? ' has-subtabs' : ''}`}>
    <SaveSessionHeader session={session} busy={busy} saveBlocked={localDraftBlocked} onSelectCharacter={() => { if (session.dirty) { api.notify('切换角色前请先保存或撤销当前修改', 'warning'); return } void api.refreshCharacters().then(() => setCharacterPickerOpen(true)).catch(() => undefined) }} onUndo={() => void api.undo()} onRedo={() => void api.redo()} onSave={() => void api.save()} onSaveAs={() => void api.save(true)} onClose={() => session.dirty || localDraftBlocked ? setConfirm({ title: '关闭存档会话？', message: localDraftBlocked ? '当前页面还有尚未应用的草稿；关闭会话会同时丢弃页面草稿和未保存修改。' : '当前存档有未保存修改，关闭会话会丢弃这些修改。', confirmLabel: '放弃修改并关闭', action: () => { void api.close(true); setConfirm(null) } }) : void api.close()} />
    <nav className="save-editor-page__tabs" role="tablist" aria-label="存档修改项目" onKeyDown={event => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const index = availableTabs.findIndex(value => value.id === tab); const next = availableTabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + availableTabs.length) % availableTabs.length]; if (!localDraftBlocked) { selectTab(next.id); document.getElementById(`save-section-tab-${next.id}`)?.focus() } else api.notify(personalDraftInvalid ? '请先修正个人信息中的无效输入' : '请先应用或放弃当前猎猫草稿', 'warning') }}>
      {availableTabs.map(value => { const Icon = value.icon; return <button id={`save-section-tab-${value.id}`} type="button" role="tab" aria-selected={tab === value.id} tabIndex={tab === value.id ? 0 : -1} key={value.id} onClick={() => selectTab(value.id)}><Icon aria-hidden="true" />{value.label}</button> })}
    </nav>
    {showEquipmentSubtabs && <div className="save-editor-page__subtabs"><button type="button" className={equipmentDomain === 'hunter-equipment' ? 'is-active' : ''} onClick={() => setEquipmentDomain('hunter-equipment')}>猎人装备</button><button type="button" className={equipmentDomain === 'palico-equipment' ? 'is-active' : ''} onClick={() => setEquipmentDomain('palico-equipment')}>猫装备</button></div>}
    <main className={`save-editor-page__section${loading ? ' is-loading' : ''}`}>
      {sectionError && <div role="alert" className="save-editor-page__error">{sectionError}</div>}
      {section?.kind === 'personal-info' && <SavePersonalEditor section={section} session={session} busy={busy || !session.capabilities.canEditPersonal} onDraftValidityChange={setPersonalDraftInvalid} onCommit={(field, value) => mutate({ kind: 'set-personal-field', field, value })} />}
      {(section?.kind === 'item-box' || section?.kind === 'equipment-box') && <SaveBoxWorkspace gameId={game.id} section={section} busy={busy} editable={section.kind === 'item-box' ? session.capabilities.canEditItems : session.capabilities.canEditEquipment} itemCountMax={session.capabilities.itemCountMax} selectedSlot={boxSelection[section.domain]} query={boxQueryDraft[section.domain] ?? ''} viewFilter={boxViewFilter[section.domain] ?? 'all'} onSelectionChange={slot => setBoxSelection(current => ({ ...current, [section.domain]: slot }))} onQueryChange={query => { setBoxQueryDraft(current => ({ ...current, [section.domain]: query })); setLocateAfterSlot(undefined) }} onViewFilterChange={filter => setBoxViewFilter(current => ({ ...current, [section.domain]: filter }))} onFindNext={(query, after) => { setBoxQuery(current => ({ ...current, [section.domain]: query })); setLocateAfterSlot(after) }} onPage={next => setPage(current => ({ ...current, [section.kind === 'item-box' ? 'item-box' : section.domain]: next }))} onReplaceItem={setItemPicker} onEditEquipment={cell => setEquipmentEdit({ cell, domain: section.domain === 'palico-equipment' ? 'palico-equipment' : 'hunter-equipment' })} onSetCount={(cell, count) => void mutate({ kind: 'set-item', slot: cell.slot, itemId: cell.itemId, count })} onClear={slot => clear(section, slot)} onCopy={source => copy(section, source)} onImport={() => setTransfer({ mode: 'import', domain: section.domain })} onExport={() => setTransfer({ mode: 'export', domain: section.domain })} />}
      {section?.kind === 'palico' && <SavePalicoEditor section={section} busy={busy || !session.capabilities.canEditPalicoes} onSelect={setPalicoIndex} onDraftDirtyChange={setPalicoDraftDirty} onCommit={(index, changes) => mutate({ kind: 'set-palico', index, changes })} />}
      {loading && !section && <div role="status" className="save-editor-page__loading">正在读取存档区域…</div>}
    </main>
    {(session.state === 'selectingCharacter' || characterPickerOpen) && <SaveCharacterPicker characters={characters} busy={busy} selectedSlot={session.characterSlot} onSelect={slot => void api.selectCharacter(slot).then(() => setCharacterPickerOpen(false)).catch(() => undefined)} onClose={() => session.state === 'selectingCharacter' ? void api.close(true) : setCharacterPickerOpen(false)} />}
    {itemPicker && <SaveItemPickerDrawer gameId={game.id} selectedId={itemPicker.itemId} initialCount={itemPicker.count} onClose={() => setItemPicker(undefined)} onApply={(item, count) => { void mutate({ kind: 'set-item', slot: itemPicker.slot, itemId: item.saveId, count }).then(() => setItemPicker(undefined)) }} />}
    {equipmentEdit && <SaveEquipmentEditorDrawer gameId={game.id} domain={equipmentEdit.domain} cell={equipmentEdit.cell} onClose={() => setEquipmentEdit(null)} onApply={changes => mutate({ kind: 'set-equipment-fields', domain: equipmentEdit.domain, slot: equipmentEdit.cell.slot, changes })} onApplyRecord={recordHex => mutate({ kind: 'set-equipment-record', domain: equipmentEdit.domain, slot: equipmentEdit.cell.slot, recordHex })} />}
    {transfer && <SaveBoxTransferDrawer domain={transfer.domain} mode={transfer.mode} busy={busy} onClose={() => setTransfer(null)} onPreview={format => window.mhSaveEditor.save.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: transfer.domain, format })} onApply={async (preview, replaceAll) => { const result = await window.mhSaveEditor.save.applyImport({ sessionId: session.sessionId, revision: session.revision, token: preview.token, replaceAll }); api.notify(result.message); setTransfer(null) }} onExport={async format => { const result = await window.mhSaveEditor.save.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: transfer.domain, format }); api.notify(result.message) }} />}
    {confirm && <ConfirmationDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} destructive onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}
  </div>
}
