import { Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PalicoArmorSummary, PalicoWeaponSummary } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import type { ArmorLoadoutSlot, CharmValidationResult, LoadoutArmorCandidate, LoadoutCalculationSnapshot, LoadoutFacets, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import type { SaveEquipmentCell } from '../../../api/save/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
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

function initialKind(cell: SaveEquipmentCell, palico: boolean): Kind {
  if (palico) return cell.kind === 'palico-weapon' || cell.kind === 'palico-head' || cell.kind === 'palico-body' ? cell.kind : 'palico-weapon'
  if (cell.kind === 'armor') return ({ 1: 'head', 2: 'chest', 3: 'arms', 4: 'waist', 5: 'legs' } as Record<number, ArmorLoadoutSlot>)[cell.saveType] ?? 'head'
  return cell.kind === 'weapon' || cell.kind === 'charm' ? cell.kind : 'weapon'
}

export function SaveEquipmentEditorDrawer({ gameId, domain, cell, onApply, onApplyRecord, onClose }: Props) {
  const palico = domain === 'palico-equipment'
  const [kind, setKind] = useState<Kind>(() => initialKind(cell, palico))
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
  const [advanced, setAdvanced] = useState(cell.kind === 'charm')
  const [level, setLevel] = useState(cell.level)
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
    if (gameId !== 'mh4g' || palico || (cell.kind !== 'weapon' && cell.kind !== 'armor')) { setExistingRelic(undefined); return }
    let live = true
    const find = async () => {
      const values = cell.kind === 'weapon'
        ? (await window.mhSaveEditor.loadout.searchWeapons({ gameId, query: cell.nameCn, sourceKind: 'relicTemplate', pageSize: 100 })).items
        : (await window.mhSaveEditor.loadout.searchArmors({ gameId, part: initialKind(cell, false) as ArmorLoadoutSlot, query: cell.nameCn, sourceKind: 'relicTemplate', pageSize: 100 })).items
      const candidate = values.find(value => value.saveType === cell.saveType && value.saveId === cell.saveId && value.instance)
      if (!live || !candidate?.instance) return
      setExistingRelic({ ...candidate, instance: { ...candidate.instance, source: 'saveInstance', formatId: 'mh4g-3ds-citra', recordHex: cell.recordHex } })
    }
    void find().catch(() => { if (live) setExistingRelic(undefined) })
    return () => { live = false }
  }, [cell.kind, cell.nameCn, cell.recordHex, cell.saveId, cell.saveType, gameId, palico])

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
  const selectedBlocked = selected && 'candidateKey' in selected ? selected.instance?.encoding === 'blocked' : false
  const activeExistingRelic = existingRelic && ((kind === 'weapon' && existingRelic.kind === 'weapon') || (kind !== 'weapon' && kind !== 'charm' && existingRelic.kind === 'armor' && existingRelic.part === kind)) ? existingRelic : undefined

  const applyCandidate = async (value: PalicoCandidate | EquipmentPickerCandidate) => {
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
      ...(kind === 'charm' ? { slots: charmDraft?.slots ?? slots, skill1Id: charmDraft?.skill1?.skillId ?? 0, skill1Points: charmDraft?.skill1?.points ?? 0, skill2Id: charmDraft?.skill2?.skillId ?? 0, skill2Points: charmDraft?.skill2?.points ?? 0 } : { level }),
      decorations,
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
    ? <button type="button" disabled={kind === 'charm' && (!charmDraft || charmEncoding === 'blocked')} onClick={() => void applyAdvanced()}>应用字段修改</button>
    : <button type="button" disabled={!selected || selectedBlocked} onClick={() => selected && void applyCandidate(selected)}>应用选择</button>}</>

  return <WorkspaceDrawer title={`编辑第 ${cell.slot + 1} 格装备`} onClose={onClose} footer={footer}>
    <div className="save-equipment-editor">
      <nav><button type="button" className={!advanced ? 'is-active' : ''} onClick={() => setAdvanced(false)}>替换装备</button><button type="button" className={advanced ? 'is-active' : ''} disabled={cell.empty} title={cell.empty ? '空格没有可编辑的实例，请先选择装备或创建护石' : undefined} onClick={() => { setKind(initialKind(cell, palico)); setAdvanced(true) }}>编辑实例</button></nav>
      {advanced ? <div className="save-equipment-editor__advanced">
        <p>实例编辑只修改已确认字段；未知位、固定标记和保留字节保持原样。替换装备则从干净记录创建。</p>
        {activeExistingRelic?.instance ? <div className="save-equipment-editor__existing-relic"><h3>{cell.nameCn}</h3><p>已识别为发掘实例，下面直接编辑当前格的完整 28 字节记录。</p>{snapshot ? <RelicEquipmentEditor candidate={activeExistingRelic} lookups={snapshot.relicLookups} decorations={snapshot.decorations} onChange={setExistingRelic} /> : <p role="status">正在读取发掘参数…</p>}</div> : <div className={kind === 'charm' ? 'save-equipment-editor__advanced-content is-charm' : 'save-equipment-editor__advanced-content'}>
          {kind === 'charm' && snapshot ? <div className="save-equipment-editor__charm"><CharmEditorForm snapshot={snapshot} current={currentCharm} pointMinimum={pointMinimum} pointMaximum={pointMaximum} onChange={updateCharm} /><section className="save-equipment-editor__decoration-section"><h3>护石装饰珠</h3><DecorationEditorContent decorations={snapshot.decorations} skills={snapshot.skills} value={decorations.filter(Boolean)} capacity={charmDraft?.slots ?? slots} interpretFixedBit={gameId === 'mh4g'} onChange={values => setDecorations([...values, 0, 0, 0].slice(0, 3))} /></section></div> : <>
            <label>等级<input type="number" min="0" max={gameId === 'mhgu' ? 31 : 255} value={level} onChange={event => setLevel(Number(event.target.value))} /></label>
            {snapshot && !palico && <div className="save-equipment-editor__decoration-content"><DecorationEditorContent decorations={snapshot.decorations} skills={snapshot.skills} value={decorations.filter(Boolean)} capacity={cell.slots} interpretFixedBit={gameId === 'mh4g'} onChange={values => setDecorations([...values, 0, 0, 0].slice(0, 3))} /></div>}
          </>}
        </div>}
      </div> : <div className="save-equipment-editor__replace">
        <div className="save-equipment-editor__toolbar">
          <SearchableSelect ariaLabel="装备类别" value={kind} options={palico ? palicoKinds : hunterKinds} onChange={value => setKind(value as Kind)} />
          {palico && <label><Search aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称或 ID" /></label>}
        </div>
        {kind === 'charm' ? <div className="save-equipment-editor__results"><button type="button" onClick={() => { setAdvanced(true); setKind('charm'); setSkill1Id(0); setSkill2Id(0); setSlots(0) }}><Sparkles aria-hidden="true" /><span><strong>创建或编辑护石</strong><small>选择品级、A/B 技能、点数、孔位和装饰珠</small></span></button></div> : !palico && snapshot && facets ? <EquipmentPickerContent gameId={gameId} slot={kind as Exclude<HunterKind, 'charm'>} facets={facets} relicLookups={snapshot.relicLookups} decorations={snapshot.decorations} onSelectionChange={selectEquipment} onConfirm={value => void applyCandidate(value)} /> : <div className="save-equipment-editor__candidate-layout">
          <div className="save-equipment-editor__results" role="listbox" aria-busy={loading}>{error && <p role="alert">{error}</p>}{items.map((value, index) => <button ref={element => { buttons.current[index] = element }} type="button" role="option" tabIndex={selected && 'key' in selected && selected.key === value.key || (!selected && index === 0) ? 0 : -1} aria-selected={Boolean(selected && 'key' in selected && selected.key === value.key)} key={value.key} onClick={() => setSelected(value)} onDoubleClick={() => void applyCandidate(value)} onKeyDown={event => move(event, index)}><CatalogIcon path={value.iconPath} name={value.nameCn} /><span><strong>{value.nameCn}</strong><small>{value.nameEn || value.detail}</small><em>{value.detail}</em></span></button>)}{!loading && !error && !items.length && <p>没有符合条件的装备。</p>}</div>
        </div>}
      </div>}
    </div>
  </WorkspaceDrawer>
}
