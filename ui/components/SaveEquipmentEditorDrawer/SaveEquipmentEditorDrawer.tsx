import { Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PalicoArmorSummary, PalicoWeaponSummary } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import type { ArmorLoadoutSlot, CharmValidationResult, LoadoutArmorCandidate, LoadoutCalculationSnapshot, LoadoutFacets, LoadoutRelicLookup, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import type { SaveArmorAppearance, SaveEquipmentCell } from '../../../api/save/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { ArmorAppearanceIcon } from '../ArmorAppearanceIcon/ArmorAppearanceIcon'
import { armorPartForSaveType } from '../../../api/save/armorParts'
import { CharmEditorForm, type EditableCharm } from '../CharmEditorForm/CharmEditorForm'
import { DecorationEditorContent } from '../DecorationEditorContent/DecorationEditorContent'
import { EquipmentPickerContent, type EquipmentPickerCandidate } from '../EquipmentPickerContent/EquipmentPickerContent'
import { RelicEquipmentEditor } from '../RelicEquipmentEditor/RelicEquipmentEditor'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'
import './SaveEquipmentEditorDrawer.css'

type HunterKind = 'weapon' | ArmorLoadoutSlot | 'charm'
type PalicoKind = 'palico-weapon' | 'palico-head' | 'palico-body'
type Kind = HunterKind | PalicoKind
type RelicCandidate = LoadoutWeaponCandidate | LoadoutArmorCandidate
type EquipmentChanges = {
  reset?: boolean
  saveType?: number
  saveId?: number
  level?: number
  appearanceId?: number
  decorations?: number[]
  skill1Id?: number
  skill1Points?: number
  skill2Id?: number
  skill2Points?: number
  slots?: number
}
type PalicoCandidate = {
  key: string
  nameCn: string
  nameEn: string
  iconPath: string | null
  saveType: number
  saveId: number
  level?: number
  appearanceId?: number
  detail: string
}
type Props = {
  gameId: GameId
  domain: 'hunter-equipment' | 'palico-equipment'
  cell: SaveEquipmentCell
  onApply(changes: EquipmentChanges): Promise<void>
  onApplyRecord(recordHex: string): Promise<void>
  onClose(): void
}

const hunterKinds = [{ value: 'weapon', label: '武器' }, { value: 'head', label: '头部' }, { value: 'chest', label: '胸部' }, { value: 'arms', label: '腕部' }, { value: 'waist', label: '腰部' }, { value: 'legs', label: '腿部' }, { value: 'charm', label: '护石' }]
const palicoKinds = [{ value: 'palico-weapon', label: '猫武器' }, { value: 'palico-head', label: '猫头部' }, { value: 'palico-body', label: '猫身体' }]

function initialKind(cell: SaveEquipmentCell, palico: boolean, gameId: GameId): Kind {
  if (palico) return cell.kind === 'palico-weapon' || cell.kind === 'palico-head' || cell.kind === 'palico-body' ? cell.kind : 'palico-weapon'
  if (cell.kind === 'armor') return armorPartForSaveType(gameId, cell.saveType) ?? 'head'
  return cell.kind === 'weapon' || cell.kind === 'charm' ? cell.kind : 'weapon'
}

export function SaveEquipmentEditorDrawer({ gameId, domain, cell, onApply, onApplyRecord, onClose }: Props) {
  const palico = domain === 'palico-equipment'
  const [kind, setKind] = useState<Kind>(() => initialKind(cell, palico, gameId))
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PalicoCandidate[]>([])
  const [selected, setSelected] = useState<PalicoCandidate | EquipmentPickerCandidate>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [snapshot, setSnapshot] = useState<LoadoutCalculationSnapshot>()
  const [facets, setFacets] = useState<LoadoutFacets>()
  const [existingRelic, setExistingRelic] = useState<RelicCandidate>()
  const [charmDraft, setCharmDraft] = useState<EditableCharm>()
  const [charmEncoding, setCharmEncoding] = useState<CharmValidationResult['encoding']>('encodable')
  const [advanced, setAdvanced] = useState(cell.kind === 'charm' || Boolean(cell.relic))
  const [relicLookups, setRelicLookups] = useState<LoadoutRelicLookup[]>([])
  const [relicLoading, setRelicLoading] = useState(gameId === 'mh4g' && !palico && (cell.kind === 'weapon' || cell.kind === 'armor'))
  const [relicError, setRelicError] = useState<string>()
  const [appearanceItems, setAppearanceItems] = useState<SaveArmorAppearance[]>([])
  const [appearancePage, setAppearancePage] = useState(1)
  const [appearanceTotal, setAppearanceTotal] = useState(0)
  const [appearanceHasNext, setAppearanceHasNext] = useState(false)
  const [selectedAppearance, setSelectedAppearance] = useState(cell.appearance)
  const [appearanceLoading, setAppearanceLoading] = useState(false)
  const [appearanceError, setAppearanceError] = useState<string>()
  const [appearanceId, setAppearanceId] = useState(cell.appearanceId ?? 0)
  const [appearanceQuery, setAppearanceQuery] = useState('')
  const [slots, setSlots] = useState(cell.slots ?? 0)
  const [decorations, setDecorations] = useState([...cell.decorations, 0, 0, 0].slice(0, 3))
  const [charmClassId, setCharmClassId] = useState(cell.kind === 'charm' ? cell.saveId : 0)
  const [skill1Id, setSkill1Id] = useState(cell.skill1Id ?? 0)
  const [skill1Points, setSkill1Points] = useState(cell.skill1Points ?? 0)
  const [skill2Id, setSkill2Id] = useState(cell.skill2Id ?? 0)
  const [skill2Points, setSkill2Points] = useState(cell.skill2Points ?? 0)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (palico) return
    let live = true
    void Promise.all([window.mhSaveEditor.loadout.getBootstrap(gameId), window.mhSaveEditor.loadout.getFacets(gameId)]).then(([value, nextFacets]) => {
      if (!live) return
      setSnapshot(value)
      setFacets(nextFacets)
      setCharmClassId(current => current || value.charmClasses[0]?.classId || 0)
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '装备编辑资料读取失败') })
    return () => { live = false }
  }, [gameId, palico])

  useEffect(() => {
    if (gameId !== 'mhgu' || palico || cell.kind !== 'armor') { setAppearanceItems([]); return }
    let live = true
    setAppearanceLoading(true); setAppearanceError(undefined); setAppearanceItems([])
    void window.mhSaveEditor.save.searchArmorAppearances({ gameId: 'mhgu', saveType: cell.saveType, query: appearanceQuery || undefined, page: appearancePage, pageSize: 100 }).then(value => {
      if (live) { setAppearanceItems(value.items); setAppearanceTotal(value.total); setAppearanceHasNext(value.hasNext) }
    }).catch(cause => { if (live) { setAppearanceTotal(0); setAppearanceHasNext(false); setAppearanceError(cause instanceof Error ? cause.message : '幻化候选读取失败') } }).finally(() => { if (live) setAppearanceLoading(false) })
    return () => { live = false }
  }, [appearanceQuery, appearancePage, cell.kind, cell.saveType, gameId, palico])

  useEffect(() => {
    setExistingRelic(undefined); setRelicError(undefined); setRelicLookups([])
    if (gameId !== 'mh4g' || palico || (cell.kind !== 'weapon' && cell.kind !== 'armor')) { setRelicLoading(false); return }
    let live = true
    setRelicLoading(true)
    const find = async () => {
      const identity = { gameId, saveType: cell.saveType, saveId: cell.saveId, sourceKind: 'relicTemplate' as const, pageSize: 1 }
      const values = cell.kind === 'weapon'
        ? (await window.mhSaveEditor.loadout.searchWeapons(identity)).items
        : (await window.mhSaveEditor.loadout.searchArmors({ ...identity, part: initialKind(cell, false, gameId) as ArmorLoadoutSlot })).items
      const candidate = values.find(value => value.saveType === cell.saveType && value.saveId === cell.saveId && value.instance)
      if (!live) return
      if (!candidate?.instance) {
        if (cell.relic) throw new Error('当前发掘装备的参数模板读取失败，请关闭后重试。')
        return
      }
      setExistingRelic({ ...candidate, instance: { ...candidate.instance, source: 'saveInstance', formatId: 'mh4g-3ds-citra', recordHex: cell.recordHex } })
      const lookups = await window.mhSaveEditor.loadout.getRelicLookups(gameId)
      if (!lookups.some(value => value.kind === 'equipment_lookup')) throw new Error('发掘参数选项读取失败，请关闭后重试。')
      if (live) setRelicLookups(lookups)
    }
    void find().catch(cause => { if (live) setRelicError(cause instanceof Error ? cause.message : '发掘参数读取失败') }).finally(() => { if (live) setRelicLoading(false) })
    return () => { live = false }
  }, [cell.kind, cell.recordHex, cell.saveId, cell.saveType, cell.relic?.templateKey, gameId, palico])

  useEffect(() => {
    if (!palico || kind === 'charm') { setItems([]); setSelected(undefined); return }
    let live = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(undefined)
      const load = async (): Promise<PalicoCandidate[]> => {
        if (kind === 'palico-weapon') {
          const result = await window.mhSaveEditor.catalog.searchPalicoWeapons({ gameId: 'mhgu', query, pageSize: 100 })
          return result.items.map((value: PalicoWeaponSummary) => ({ key: `w-${value.equipmentId}`, nameCn: value.nameCn, nameEn: value.nameEn, iconPath: value.iconPath, saveType: 22, saveId: value.saveId, appearanceId: 0, detail: `近战 ${value.meleeAttack} · 远程 ${value.rangedAttack}` }))
        }
        const result = await window.mhSaveEditor.catalog.searchPalicoArmors({ gameId: 'mhgu', query, part: kind === 'palico-head' ? 'head' : 'body', pageSize: 100 })
        return result.items.map((value: PalicoArmorSummary) => ({ key: `a-${value.equipmentId}`, nameCn: value.nameCn, nameEn: value.nameEn, iconPath: value.iconPath, saveType: kind === 'palico-head' ? 23 : 24, saveId: value.saveId, appearanceId: 0, detail: `稀有度 ${value.rarity} · 防御 ${value.defense}` }))
      }
      void load().then(values => {
        if (!live) return
        setItems(values)
        setSelected(values[0])
      }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '装备候选读取失败') }).finally(() => { if (live) setLoading(false) })
    }, query ? 140 : 0)
    return () => { live = false; window.clearTimeout(timer) }
  }, [gameId, kind, palico, query])

  const pointMinimum = gameId === 'mh4g' ? -32768 : -128
  const pointMaximum = gameId === 'mh4g' ? 32767 : 127
  const currentCharm = useMemo<EditableCharm>(() => ({
    kind: 'charm', gameId, classId: charmClassId, classNameCn: cell.nameCn || '自定义护石', iconPath: snapshot?.charmClasses.find(value => value.classId === charmClassId)?.iconPath ?? null, slots,
    skill1: skill1Id ? { skillId: skill1Id, nameCn: cell.skill1NameCn ?? `技能 #${skill1Id}`, points: skill1Points } : null,
    skill2: skill2Id ? { skillId: skill2Id, nameCn: cell.skill2NameCn ?? `技能 #${skill2Id}`, points: skill2Points } : null,
    decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked',
  }), [cell.nameCn, cell.skill1NameCn, cell.skill2NameCn, charmClassId, gameId, skill1Id, skill1Points, skill2Id, skill2Points, slots, snapshot])
  const selectedMissingIdentity = selected && 'candidateKey' in selected && !selected.instance && (selected.saveType == null || selected.saveId == null)
  const selectedBlocked = selectedMissingIdentity || (selected && 'candidateKey' in selected ? selected.instance?.encoding === 'blocked' : false)
  const activeExistingRelic = existingRelic && ((kind === 'weapon' && existingRelic.kind === 'weapon') || (kind !== 'weapon' && kind !== 'charm' && existingRelic.kind === 'armor' && existingRelic.part === kind)) ? existingRelic : undefined

  const applyCandidate = async (value: PalicoCandidate | EquipmentPickerCandidate) => {
    if ('candidateKey' in value && !value.instance && (value.saveType == null || value.saveId == null)) {
      setError('该条目没有当前游戏的存档编号，无法写入。'); return
    }
    if ('candidateKey' in value && value.instance) await onApplyRecord(value.instance.recordHex)
    else await onApply({
      reset: true,
      saveType: value.saveType!,
      saveId: value.saveId!,
      level: 'candidateKey' in value && value.kind === 'weapon' ? value.saveLevel ?? 0 : 'level' in value ? value.level ?? 0 : 0,
      appearanceId: 'appearanceId' in value ? value.appearanceId ?? 0 : 0,
    })
    onClose()
  }
  const applyAdvanced = async () => {
    if (activeExistingRelic?.instance) { await onApplyRecord(activeExistingRelic.instance.recordHex); onClose(); return }
    const creatingCharm = kind === 'charm' && cell.kind !== 'charm'
    await onApply({
      ...(kind === 'charm' ? { ...(creatingCharm ? { reset: true } : {}), saveType: 6, saveId: charmDraft?.classId ?? charmClassId } : {}),
      ...(kind === 'charm' ? { slots: charmDraft?.slots ?? slots, skill1Id: charmDraft?.skill1?.skillId ?? 0, skill1Points: charmDraft?.skill1?.points ?? 0, skill2Id: charmDraft?.skill2?.skillId ?? 0, skill2Points: charmDraft?.skill2?.points ?? 0 } : {}),
      decorations,
      ...(gameId === 'mhgu' && cell.kind === 'armor' && appearanceId !== (cell.appearanceId ?? 0) ? { appearanceId } : {}),
    })
    onClose()
  }
  const updateCharm = useCallback((value: EditableCharm, validation: CharmValidationResult) => { setCharmDraft(value); setCharmEncoding(validation.encoding) }, [])
  const selectEquipment = useCallback((value: EquipmentPickerCandidate | null) => setSelected(value ?? undefined), [])
  const move = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Enter' && selected) { event.preventDefault(); if (!selectedBlocked) void applyCandidate(selected); return }
    else return
    event.preventDefault(); const value = items[next]; if (value) { setSelected(value); buttons.current[next]?.focus() }
  }

  const footer = <><button type="button" onClick={onClose}>取消</button>{advanced
    ? <button type="button" disabled={relicLoading || Boolean(relicError) || Boolean(activeExistingRelic && (!snapshot || activeExistingRelic.instance?.encoding === 'blocked')) || (kind === 'charm' && (!charmDraft || charmEncoding === 'blocked'))} onClick={() => void applyAdvanced()}>应用字段修改</button>
    : <button type="button" disabled={!selected || selectedBlocked} onClick={() => selected && void applyCandidate(selected)}>应用选择</button>}</>

  return <WorkspaceDrawer title={`编辑第 ${cell.slot + 1} 格装备`} onClose={onClose} footer={footer}>
    <div className="save-equipment-editor">
      <nav><button type="button" className={!advanced ? 'is-active' : ''} onClick={() => setAdvanced(false)}>替换装备</button><button type="button" className={advanced ? 'is-active' : ''} disabled={cell.empty} title={cell.empty ? '空格没有可编辑的实例，请先选择装备或创建护石' : undefined} onClick={() => { setKind(initialKind(cell, palico, gameId)); setAdvanced(true) }}>编辑实例</button></nav>
      {advanced ? <div className="save-equipment-editor__advanced">
        <p>实例编辑只修改已确认字段；未知位、固定标记和保留字节保持原样。替换装备则从干净记录创建。</p>
        {relicLoading || relicError || activeExistingRelic?.instance ? <div className="save-equipment-editor__existing-relic"><h3>{cell.nameCn}</h3>
          {relicLoading ? <p role="status">正在读取当前装备的发掘参数…</p> : relicError ? <p role="alert">{relicError}</p> : activeExistingRelic && snapshot ? <><p>正在编辑当前装备的已保存参数；应用后加入存档草稿。</p><RelicEquipmentEditor candidate={activeExistingRelic} lookups={relicLookups} decorations={snapshot.decorations} onChange={setExistingRelic} /></> : <p role="status">正在读取发掘参数…</p>}
        </div> : <div className={kind === 'charm' ? 'save-equipment-editor__advanced-content is-charm' : 'save-equipment-editor__advanced-content'}>
          {kind === 'charm' && snapshot ? <div className="save-equipment-editor__charm"><CharmEditorForm snapshot={snapshot} current={currentCharm} pointMinimum={pointMinimum} pointMaximum={pointMaximum} onChange={updateCharm} /><section className="save-equipment-editor__decoration-section"><h3>护石装饰珠</h3><DecorationEditorContent decorations={snapshot.decorations} skills={snapshot.skills} value={decorations.filter(Boolean)} capacity={charmDraft?.slots ?? slots} interpretFixedBit={gameId === 'mh4g'} onChange={values => setDecorations([...values, 0, 0, 0].slice(0, 3))} /></section></div> : <>
            {gameId === 'mhgu' && cell.kind === 'armor' && <section className="save-equipment-editor__appearance">
              <h3 className="save-equipment-editor__appearance-heading">防具幻化</h3>
              <p className="save-equipment-editor__appearance-note">只修改显示外观，实际装备和防具属性保持不变。渐变图标仅表示幻化部位。</p>
              <p className="save-equipment-editor__appearance-note">当前外观：{appearanceId ? (selectedAppearance?.appearanceId === appearanceId ? selectedAppearance.nameCn : undefined) ?? `未知外观 #${appearanceId}（原值保留）` : '无幻化'}</p>
              <input className="save-equipment-editor__appearance-search" aria-label="搜索幻化防具名称或 ID" value={appearanceQuery} onChange={event => { setAppearanceQuery(event.target.value); setAppearancePage(1) }} placeholder="搜索幻化防具名称或 ID" />
              {appearanceLoading && <p className="save-equipment-editor__appearance-note" role="status">正在读取同部位幻化候选…</p>}
              {appearanceError && <p className="save-equipment-editor__appearance-note" role="alert">{appearanceError}</p>}
              <div className="save-equipment-editor__appearance-grid" aria-busy={appearanceLoading}>
                <button type="button" aria-pressed={!appearanceId} className={`save-equipment-editor__appearance-option${!appearanceId ? ' is-selected' : ''}`} onClick={() => { setAppearanceId(0); setSelectedAppearance(null) }}>取消幻化</button>
                {appearanceItems.map(item => <button type="button" aria-pressed={appearanceId === item.appearanceId} className={`save-equipment-editor__appearance-option${appearanceId === item.appearanceId ? ' is-selected' : ''}`} key={item.appearanceId} title={`${item.nameCn} · ID ${item.appearanceId}`} onClick={() => { setAppearanceId(item.appearanceId); setSelectedAppearance(item) }}>
                  <ArmorAppearanceIcon part={item.part} name={item.nameCn} />
                  <span className="save-equipment-editor__appearance-name">{item.nameCn}<small className="save-equipment-editor__appearance-id">ID {item.appearanceId}</small></span>
                </button>)}
              </div>
              {!appearanceLoading && !appearanceError && !appearanceItems.length && <p className="save-equipment-editor__appearance-note">未找到同部位候选，请调整搜索词。</p>}
              <div className="save-equipment-editor__appearance-pagination">
                <button type="button" className="save-equipment-editor__appearance-option" disabled={appearanceLoading || appearancePage <= 1} onClick={() => setAppearancePage(page => page - 1)}>上一页外观</button>
                <span className="save-equipment-editor__appearance-id">第 {appearancePage} 页 · 共 {appearanceTotal} 项</span>
                <button type="button" className="save-equipment-editor__appearance-option" disabled={appearanceLoading || !appearanceHasNext} onClick={() => setAppearancePage(page => page + 1)}>下一页外观</button>
              </div>
              <p className="save-equipment-editor__appearance-note">包含普通图鉴之外的同部位原生外观；选择只更新草稿，应用字段修改后才提交。</p>
            </section>}
            {snapshot && !palico && <div className="save-equipment-editor__decoration-content">{kind !== 'weapon' && cell.kind !== 'weapon' && <DecorationEditorContent decorations={snapshot.decorations} skills={snapshot.skills} value={decorations.filter(Boolean)} capacity={cell.slots} interpretFixedBit={gameId === 'mh4g'} onChange={values => setDecorations([...values, 0, 0, 0].slice(0, 3))} />}</div>}
          </>}
        </div>}
      </div> : <div className="save-equipment-editor__replace">
        {selectedMissingIdentity&&<p role="status">该条目没有当前游戏的存档编号，无法写入；美版专属防具不能写入 MH4G 存档。</p>}
        <div className="save-equipment-editor__toolbar">
          <SearchableSelect ariaLabel="装备类别" value={kind} options={palico ? palicoKinds : hunterKinds} onChange={value => setKind(value as Kind)} />
          {palico && <label><Search aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称或 ID" /></label>}
        </div>
        {kind === 'charm' ? <div className="save-equipment-editor__results"><button type="button" onClick={() => { setAdvanced(true); setKind('charm'); setSkill1Id(0); setSkill2Id(0); setSlots(0) }}><Sparkles aria-hidden="true" /><span><strong>创建或编辑护石</strong><small>选择品级、A/B 技能、点数、孔位和装饰珠</small></span></button></div> : !palico && snapshot && facets ? <EquipmentPickerContent gameId={gameId} slot={kind as Exclude<HunterKind, 'charm'>} facets={facets} relicLookups={snapshot.relicLookups} decorations={snapshot.decorations} onSelectionChange={selectEquipment} /> : <div className="save-equipment-editor__candidate-layout">
          <div className="save-equipment-editor__results" role="listbox" aria-busy={loading}>{error && <p role="alert">{error}</p>}{items.map((value, index) => <button ref={element => { buttons.current[index] = element }} type="button" role="option" tabIndex={selected && 'key' in selected && selected.key === value.key || (!selected && index === 0) ? 0 : -1} aria-selected={Boolean(selected && 'key' in selected && selected.key === value.key)} key={value.key} onClick={() => setSelected(value)} onDoubleClick={() => void applyCandidate(value)} onKeyDown={event => move(event, index)}><CatalogIcon path={value.iconPath} name={value.nameCn} /><span><strong>{value.nameCn}</strong><small>{value.nameEn || value.detail}</small><em>{value.detail}</em></span></button>)}{!loading && !error && !items.length && <p>没有符合条件的装备。</p>}</div>
        </div>}
      </div>}
    </div>
  </WorkspaceDrawer>
}
