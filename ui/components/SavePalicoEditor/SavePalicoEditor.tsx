import { AlertTriangle, Cat, Check, Palette, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PalicoSkillSummary, PalicoSupportMoveSummary } from '../../../api/catalog/types'
import type { SavePalicoDetail, SavePalicoSection } from '../../../api/save/types'
import { describePalicoStructureChange, rebuildPalicoStructure } from '../../../api/save/palicoStructure'
import { ConfirmationDialog } from '../ConfirmationDialog/ConfirmationDialog'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './SavePalicoEditor.css'

type Tab = 'basic' | 'actions' | 'skills' | 'appearance' | 'diagnostics'
const tabs: { id: Tab; label: string; icon: typeof Cat }[] = [{ id: 'basic', label: '基本', icon: Cat }, { id: 'actions', label: '行动', icon: Sparkles }, { id: 'skills', label: '技能', icon: ShieldCheck }, { id: 'appearance', label: '外观', icon: Palette }, { id: 'diagnostics', label: '诊断', icon: AlertTriangle }]
const clone = <T,>(value: T): T => structuredClone(value)
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const numericOptions = (count: number, label: string) => Array.from({ length: count }, (_, value) => ({ value: String(value), label: `${label} ${value + 1}` }))
type AbilityOption = { value: string; label: string; keywords?: string[]; group: string; cost: string; memoryCost?: number | null; learnLevel?: number | null; teachable: boolean; role: string }
const editableKeys = ['name','forte','target','enthusiasm','greeting','nameGiver','previousOwner','equippedActions','equippedSkills','learnedActions','learnedSkills','actionPattern','actionValidLength','skillPattern','skillValidLength','voice','eyes','clothing','coat','ears','tail','coatColor','rightEyeColor','leftEyeColor','vestColor'] as const

function draftChanges(draft: SavePalicoDetail | null, source: SavePalicoDetail | null) {
  const changes: Record<string, unknown> = {}
  if (!draft || !source) return changes
  for (const key of editableKeys) if (!same(draft[key], source[key])) changes[key] = draft[key]
  return changes
}

export function SavePalicoEditor({ section, busy, onSelect, onCommit, onDraftDirtyChange }: { section: SavePalicoSection; busy: boolean; onSelect(index: number): void; onCommit(index: number, changes: Record<string, unknown>): Promise<void>; onDraftDirtyChange?(dirty: boolean): void }) {
  const [tab, setTab] = useState<Tab>('basic'); const [draft, setDraft] = useState<SavePalicoDetail | null>(section.selected ? clone(section.selected) : null); const [moves, setMoves] = useState<PalicoSupportMoveSummary[]>([]); const [skills, setSkills] = useState<PalicoSkillSummary[]>([])
  const [query, setQuery] = useState(''); const [includeEmpty, setIncludeEmpty] = useState(false); const [riskOnly, setRiskOnly] = useState(false)
  const [pendingForte, setPendingForte] = useState<{ value: number; rebuilt: ReturnType<typeof rebuildPalicoStructure>; description: ReturnType<typeof describePalicoStructureChange> }>()
  const [pendingSelection, setPendingSelection] = useState<number>()
  const [structureError, setStructureError] = useState<string>()
  const entryButtons = useRef<Array<HTMLButtonElement | null>>([]); const tabButtons = useRef<Array<HTMLButtonElement | null>>([])
  useEffect(() => { setDraft(section.selected ? clone(section.selected) : null); setPendingForte(undefined); setStructureError(undefined) }, [section.selected])
  useEffect(() => { let live = true; void Promise.all([window.mhSaveEditor.catalog.searchPalicoSupportMoves({ gameId: 'mhgu' }), window.mhSaveEditor.catalog.searchPalicoSkills({ gameId: 'mhgu' })]).then(([a, b]) => { if (live) { setMoves(a); setSkills(b) } }); return () => { live = false } }, [])
  const changes = useMemo(() => draftChanges(draft, section.selected), [draft, section.selected])
  const draftDirty = Object.keys(changes).length > 0
  useEffect(() => { onDraftDirtyChange?.(draftDirty) }, [draftDirty, onDraftDirtyChange])
  useEffect(() => () => onDraftDirtyChange?.(false), [onDraftDirtyChange])
  const commit = async () => {
    if (!draft || draft.empty || !section.selected) return
    if (Object.keys(changes).length) await onCommit(draft.index, changes)
  }
  const requestSelection = (index: number) => {
    if (index === draft?.index) return
    if (draftDirty) { setPendingSelection(index); return }
    onSelect(index)
  }
  const set = <K extends keyof SavePalicoDetail>(key: K, value: SavePalicoDetail[K]) => setDraft(current => current ? { ...current, [key]: value } : current)
  const requestForteChange = (value: number) => {
    if (!draft || value === draft.forte) return
    if (!section.generationRules) { set('forte', value); setStructureError('当前资料库缺少原生生成规则；仅修改了倾向，行动与技能结构保持原样并视为风险。'); return }
    try {
      const rebuilt = rebuildPalicoStructure(draft, section.generationRules, value)
      setPendingForte({ value, rebuilt, description: describePalicoStructureChange(draft, rebuilt) })
      setStructureError(undefined)
    } catch (cause) {
      setStructureError(cause instanceof Error ? cause.message : '无法按原生规则重建猎猫结构')
    }
  }
  const moveEntry = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const available = section.entries.filter(value => filteredEntries.some(item => item.index === value.index)); const current = available.findIndex(value => value.index === index); let next = current
    if (event.key === 'ArrowDown') next = Math.min(available.length - 1, current + 1); else if (event.key === 'ArrowUp') next = Math.max(0, current - 1); else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = available.length - 1; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); requestSelection(index); return } else return
    event.preventDefault(); const value = available[next]; if (value) { requestSelection(value.index); if (!draftDirty) entryButtons.current[value.index]?.focus() }
  }
  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setTab(tabs[next].id); tabButtons.current[next]?.focus()
  }
  const moveOptions: AbilityOption[] = moves.map(value => ({ value: String(value.supportMoveId), label: value.nameCn, keywords: [value.nameEn, value.nameJp, value.generationGroup ?? ''], group: value.generationGroup ?? '未分组', cost: value.gaugeCost == null ? '消耗未记录' : `消耗 ${value.gaugeCost} 格`, teachable: value.teachable, role: value.role }))
  const skillOptions: AbilityOption[] = skills.map(value => ({ value: String(value.palicoSkillId), label: value.nameCn, keywords: [value.nameEn, value.nameJp, value.generationGroup ?? ''], group: value.generationGroup ?? '未分组', cost: value.memoryCost == null ? '记忆槽未记录' : `记忆槽 ${value.memoryCost}`, memoryCost: value.memoryCost, learnLevel: value.learnLevel, teachable: value.teachable, role: value.role }))
  const filteredEntries = section.entries.filter(value => (includeEmpty || !value.empty) && (!query.trim() || `${value.name} ${value.index + 1} ${value.forteNameCn} ${value.targetNameCn}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (!riskOnly || value.received || value.diagnostics.length > 0))
  const forteName = pendingForte ? ['领袖','战斗','防御','治疗','爆弹','收集','协助','野兽'][pendingForte.value] : ''
  return <>
    <div className="save-palico-editor">
      <aside><header><h2>猎猫记录</h2><span>{filteredEntries.length} / {section.entries.length}</span></header><div className="save-palico-editor__list-tools"><label><span className="save-palico-editor__visually-hidden">搜索猎猫</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称、倾向或目标" /></label><label><input type="checkbox" checked={includeEmpty} onChange={event => setIncludeEmpty(event.target.checked)} />显示空记录</label><label><input type="checkbox" checked={riskOnly} onChange={event => setRiskOnly(event.target.checked)} />仅风险记录</label></div><div role="listbox" aria-label="猎猫记录">{filteredEntries.map(value => <button ref={element => { entryButtons.current[value.index] = element }} type="button" role="option" aria-selected={value.index === draft?.index} tabIndex={value.index === draft?.index ? 0 : -1} disabled={busy} key={value.index} onClick={() => requestSelection(value.index)} onKeyDown={event => moveEntry(event, value.index)}><Cat aria-hidden="true" /><span><strong>{value.empty ? `空记录 ${value.index + 1}` : value.name}</strong><small>{value.empty ? '空记录 · 可查看诊断' : `Lv.${value.level} · ${value.forteNameCn} · ${value.targetNameCn}`}</small></span>{value.received && <em>外来</em>}{value.diagnostics.length > 0 && <em className="is-risk">风险</em>}</button>)}</div></aside>
      <section className="save-palico-editor__detail">{draft ? <>
        <nav role="tablist" aria-label="猎猫编辑分类">{tabs.map((value, index) => { const Icon = value.icon; return <button ref={element => { tabButtons.current[index] = element }} type="button" role="tab" aria-selected={tab === value.id} tabIndex={tab === value.id ? 0 : -1} key={value.id} onClick={() => setTab(value.id)} onKeyDown={event => moveTab(event, index)}><Icon aria-hidden="true" />{value.label}</button> })}</nav>
        <div className="save-palico-editor__body">
          {tab === 'basic' && <Basic draft={draft} disabled={busy} set={set} onForteChange={requestForteChange} structureError={structureError} />}
          {tab === 'actions' && <AbilitySlots kind="action" disabled={busy} equipped={draft.equippedActions} learned={draft.learnedActions} learnedValidLength={draft.actionValidLength} pattern={draft.actionPattern} sentinel={57} options={moveOptions} onEquipped={value => set('equippedActions', value)} onLearned={value => set('learnedActions', value)} />}
          {tab === 'skills' && <AbilitySlots kind="skill" disabled={busy} equipped={draft.equippedSkills} learned={draft.learnedSkills} learnedValidLength={draft.skillValidLength} pattern={draft.skillPattern} sentinel={96} options={skillOptions} onEquipped={value => set('equippedSkills', value)} onLearned={value => set('learnedSkills', value)} />}
          {tab === 'appearance' && <Appearance draft={draft} disabled={busy} set={set} />}{tab === 'diagnostics' && <Diagnostics draft={draft} />}
        </div>
        <footer><span><Check aria-hidden="true" />等级 {draft.level} 与 EXP {draft.experience} 始终只读</span>{draftDirty && <button type="button" disabled={busy} onClick={() => { setDraft(section.selected ? clone(section.selected) : null); setStructureError(undefined) }}>放弃草稿</button>}<button type="button" disabled={busy || draft.empty || !draftDirty} onClick={() => void commit()}>应用修改</button></footer>
      </> : <p>没有可编辑的猎猫记录</p>}</section>
    </div>
    {pendingForte && <ConfirmationDialog
      title="切换倾向并重建能力结构？"
      message={`${draft?.received ? '当前是外来或配信猎猫。' : ''}按原生规则切换到${forteName}倾向，将改写 ${pendingForte.description.changedActions} 个行动记录、${pendingForte.description.changedSkills} 个技能记录，并清空 ${pendingForte.description.clearedActions} 个已装备行动和 ${pendingForte.description.clearedSkills} 个已装备技能。等级、EXP、训练和设施字段保持不变。`}
      confirmLabel="重建并切换"
      alternateLabel="仅修改倾向（风险）"
      alternateDestructive
      onConfirm={() => { setDraft(current => current ? { ...current, ...pendingForte.rebuilt } : current); setPendingForte(undefined) }}
      onAlternate={() => { set('forte', pendingForte.value); setStructureError('倾向已在草稿中修改，但行动与技能仍保留旧结构；应用后可能不是自然生成组合。'); setPendingForte(undefined) }}
      onCancel={() => setPendingForte(undefined)}
    />}
    {pendingSelection != null && <ConfirmationDialog
      title="放弃当前猎猫草稿？"
      message="当前猎猫还有尚未应用到存档会话的修改。切换记录会丢弃这些页面草稿。"
      confirmLabel="放弃草稿并切换"
      destructive
      onConfirm={() => { const index = pendingSelection; setPendingSelection(undefined); onSelect(index) }}
      onCancel={() => setPendingSelection(undefined)}
    />}
  </>
}

function Basic({ draft, disabled, set, onForteChange, structureError }: { draft: SavePalicoDetail; disabled: boolean; set: <K extends keyof SavePalicoDetail>(key: K, value: SavePalicoDetail[K]) => void; onForteChange(value: number): void; structureError?: string }) { return <div className="save-palico-editor__form"><label>名称<input disabled={disabled} value={draft.name} onChange={event => set('name', event.target.value)} /></label><label>等级（只读）<input value={draft.level} readOnly /></label><label>EXP（只读）<input value={draft.experience} readOnly /></label><label>支援倾向<SearchableSelect disabled={disabled} ariaLabel="支援倾向" value={String(draft.forte)} options={['领袖','战斗','防御','治疗','爆弹','收集','协助','野兽'].map((label, value) => ({ value: String(value), label }))} onChange={value => onForteChange(Number(value))} /></label>{structureError && <p className="save-palico-editor__structure-warning" role="alert"><AlertTriangle aria-hidden="true" />{structureError}</p>}<label>目标<SearchableSelect disabled={disabled} ariaLabel="攻击目标" value={String(draft.target)} options={['平衡','大型优先','小型优先','只打大型','只打小型','随从'].map((label, value) => ({ value: String(value), label }))} onChange={value => set('target', Number(value))} /></label><label>热情<input disabled={disabled} type="number" min="0" max="255" value={draft.enthusiasm} onChange={event => set('enthusiasm', Number(event.target.value))} /></label><label className="is-wide">问候语<textarea disabled={disabled} value={draft.greeting} onChange={event => set('greeting', event.target.value)} /></label><label>赠送者<input disabled={disabled} value={draft.nameGiver} onChange={event => set('nameGiver', event.target.value)} /></label><label>前任主人<input disabled={disabled} value={draft.previousOwner} onChange={event => set('previousOwner', event.target.value)} /></label></div> }
function AbilitySlots({ kind, disabled, equipped, learned, learnedValidLength, pattern, sentinel, options, onEquipped, onLearned }: { kind: 'action' | 'skill'; disabled: boolean; equipped: number[]; learned: number[]; learnedValidLength: number; pattern: number; sentinel: number; options: AbilityOption[]; onEquipped(value: number[]): void; onLearned(value: number[]): void }) {
  const withEmpty: AbilityOption[] = [{ value: '0', label: '空槽', group: '—', cost: '—', teachable: false, role: '' }, ...options]
  const change = (values: number[], index: number, value: string) => values.map((current, at) => at === index ? Number(value) : current)
  const compactChange = (values: number[], index: number, value: string) => { const next = change(values, index, value).filter(Boolean); return [...next, ...Array(values.length - next.length).fill(0)] }
  const learnedIds = new Set(learned.slice(0, learnedValidLength).filter(value => value !== 0 && value !== sentinel))
  const memoryUsed = kind === 'skill' ? equipped.reduce((sum, value) => sum + (options.find(option => Number(option.value) === value)?.memoryCost ?? 0), 0) : 0
  const equippedOptions = withEmpty.filter(value => value.value === '0' || learnedIds.has(Number(value.value)) || equipped.includes(Number(value.value)))
  const learnedOptions = (current: number) => {
    const existing = options.find(value => value.value === String(current))
    if (!existing?.group || existing.group === '未分组') return options.filter(value => value.value === String(current))
    return options.filter(value => value.group === existing.group || value.value === String(current))
  }
  const meta = (value: number) => { const option = options.find(item => item.value === String(value)); if (!option) return null; return <small className="save-palico-editor__ability-meta"><span>{option.group} 组</span><span>{option.cost}</span>{option.learnLevel != null && <span>Lv.{option.learnLevel} 学习</span>}<span>{option.teachable ? '可传授' : '固有 / 不可传授'}</span>{option.role && <span>{option.role}</span>}</small> }
  return <div className="save-palico-editor__abilities"><section><h3>已装备槽</h3><p className="save-palico-editor__structure">只能从当前已学池选择；清空中间槽时会自动向前紧凑。{kind === 'skill' && <> 已用记忆槽 <strong className={memoryUsed > 8 ? 'is-warning' : ''}>{memoryUsed} / 8</strong>。</>}</p>{kind === 'skill' && memoryUsed > 8 && <p className="save-palico-editor__structure-warning" role="alert">已装备技能超过 8 个记忆槽；可保留为自由编辑风险，但不会伪装成自然合法结构。</p>}{equipped.map((value, index) => <label key={index}>槽位 {index + 1}<SearchableSelect disabled={disabled} ariaLabel={`${kind === 'action' ? '行动' : '技能'}装备槽 ${index + 1}`} value={String(value)} options={equippedOptions} onChange={next => onEquipped(compactChange(equipped, index, next))} />{meta(value)}</label>)}</section><section><h3>已学池</h3><p className="save-palico-editor__structure">原生模式 {pattern} · 有效区域 {learnedValidLength}/{learned.length}；普通编辑只允许同 A/B/C 组替换，尾部哨兵保持只读。</p>{learned.map((value, index) => index >= learnedValidLength ? <label key={index}>记录 {index + 1}<SearchableSelect disabled ariaLabel={`${kind === 'action' ? '行动' : '技能'}尾部记录 ${index + 1}`} value={String(value)} options={[{ value: String(value), label: value === sentinel ? `尾部哨兵 ${sentinel}` : `保留原值 ${value}` }]} onChange={() => undefined} /></label> : <label key={index}>记录 {index + 1}<SearchableSelect disabled={disabled || !learnedOptions(value).length} ariaLabel={`${kind === 'action' ? '行动' : '技能'}记录 ${index + 1}`} value={String(value)} options={learnedOptions(value)} onChange={next => onLearned(change(learned, index, next))} />{meta(value)}</label>)}</section></div>
}
function Appearance({ draft, disabled, set }: { draft: SavePalicoDetail; disabled: boolean; set: <K extends keyof SavePalicoDetail>(key: K, value: SavePalicoDetail[K]) => void }) { const color = (key: 'coatColor'|'rightEyeColor'|'leftEyeColor'|'vestColor', value: string) => set(key, value.replace('#','').toUpperCase() + 'FF'); return <div className="save-palico-editor__form">{(['voice','eyes','clothing','coat','ears','tail'] as const).map(key => <label key={key}>{({voice:'声音',eyes:'眼型',clothing:'服装',coat:'毛型',ears:'耳型',tail:'尾型'} as const)[key]}<SearchableSelect disabled={disabled} ariaLabel={key} value={String(draft[key])} options={numericOptions(32, ({voice:'声音',eyes:'眼型',clothing:'服装',coat:'毛型',ears:'耳型',tail:'尾型'} as const)[key])} onChange={value => set(key, Number(value))} /></label>)}{(['coatColor','rightEyeColor','leftEyeColor','vestColor'] as const).map(key => <label key={key}>{({coatColor:'毛色',rightEyeColor:'右眼颜色',leftEyeColor:'左眼颜色',vestColor:'服装颜色'} as const)[key]}<input disabled={disabled} type="color" value={`#${draft[key].slice(0,6)}`} onChange={event => color(key, event.target.value)} /></label>)}</div> }
function Diagnostics({ draft }: { draft: SavePalicoDetail }) { return <div className="save-palico-editor__diagnostics"><p><strong>原样保留：</strong>训练、设施分配、猎猫选中状态和关联引用不会被本页重建。</p><p><strong>只读保护：</strong>等级与 EXP 不在 mutation 协议中，主进程也会拒绝相关字段。</p>{draft.received && <p className="is-warning">这是一只外来或配信猎猫；编辑时请特别留意固有行动、技能和生成结构。</p>}{draft.diagnostics.length ? draft.diagnostics.map(issue => <p key={`${issue.code}-${issue.path}`} className={`is-${issue.severity}`}>{issue.message}</p>) : <p>当前记录没有结构诊断。</p>}</div> }
