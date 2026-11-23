import { useEffect, useState } from 'react'
import type { DecorationSummary, PageResult, SkillSummary } from '../../../api/catalog/types'
import { P3_ARMOR_PARTS, P3_CHARM_GRADES } from '../../../api/save/p3/equipment'
import type { P3EquipmentChanges, SaveEquipmentCell } from '../../../api/save/types'
import { DecorationEditorContent } from '../DecorationEditorContent/DecorationEditorContent'
import { P3EquipmentPickerContent, type P3EquipmentCandidate } from '../EquipmentPickerContent/P3EquipmentPickerContent'
import { SaveEquipmentUpgradeField } from '../SaveEquipmentUpgradeField/SaveEquipmentUpgradeField'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'
import './SaveEquipmentEditorDrawer.css'

type Category = 'weapon' | typeof P3_ARMOR_PARTS[number] | 'charm'
type Charm = NonNullable<P3EquipmentChanges['charm']>
type CatalogData = { decorations: DecorationSummary[]; skills: SkillSummary[] }
type Props = {
  cell: SaveEquipmentCell
  onApply(changes: P3EquipmentChanges): Promise<void>
  onClose(): void
  onOpenCatalog(path: string): void
}

const categories: { value: Category; label: string }[] = [
  { value: 'weapon', label: '武器' }, { value: 'head', label: '头部' }, { value: 'chest', label: '胴部' },
  { value: 'arms', label: '腕部' }, { value: 'waist', label: '腰部' }, { value: 'legs', label: '脚部' },
  { value: 'charm', label: '护石' },
]
const blankCharm = { grade: 0, skill1Id: 0, skill1Points: 0, skill2Id: 0, skill2Points: 0, slots: 0 }
const fits = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max

async function collect<T>(load: (page: number) => Promise<PageResult<T>>): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const result = await load(page)
    all.push(...result.items)
    if (!result.hasNext) return all
  }
}

export function P3SaveEquipmentEditorDrawer({ cell, onApply, onClose, onOpenCatalog }: Props) {
  const initialCategory = cell.kind === 'armor' ? P3_ARMOR_PARTS[cell.saveType] ?? 'head' : cell.kind === 'charm' ? 'charm' : 'weapon'
  const [category, setCategory] = useState<Category>(initialCategory)
  const [mode, setMode] = useState<'replace' | 'edit'>('replace')
  const [selected, setSelected] = useState<P3EquipmentCandidate | null>(null)
  const [level, setLevel] = useState(cell.level)
  const [decorations, setDecorations] = useState<number[]>()
  const [charm, setCharm] = useState<Charm>()
  const [catalog, setCatalog] = useState<CatalogData>()
  const [error, setError] = useState<string>()
  const [catalogError, setCatalogError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const canEdit = !cell.empty && Boolean(cell.weaponKey || cell.armorKey || cell.charmGrade != null && cell.charmGrade <= 6)
  const creatingCharm = mode === 'replace' && category === 'charm'
  const editCharm = creatingCharm || mode === 'edit' && cell.kind === 'charm'
  const needsCatalog = creatingCharm || mode === 'edit'
  const originalCharm = {
    grade: cell.charmGrade ?? 0, slots: cell.slots ?? 0,
    skill1Id: cell.skill1Id ?? 0, skill1Points: cell.skill1Id ? cell.skill1Points ?? 0 : 0,
    skill2Id: cell.skill2Id ?? 0, skill2Points: cell.skill2Id ? cell.skill2Points ?? 0 : 0,
  }
  const activeCharm = charm ?? (creatingCharm ? blankCharm : originalCharm)
  const charmValid = fits(activeCharm.grade, 0, 6) && fits(activeCharm.slots, 0, 3)
    && fits(activeCharm.skill1Points, -30, 33) && fits(activeCharm.skill2Points, -30, 33)
  const upgradeValid = !cell.upgrade || fits(level, 0, cell.upgrade.maximum)
  const changed = decorations != null || charm != null || level !== cell.level

  useEffect(() => {
    if (!needsCatalog || catalog) return
    let active = true
    setCatalogError(undefined)
    const api = window.mhSaveEditor.catalog
    void Promise.all([
      collect(page => api.searchDecorations({ gameId: 'mhp3', page, pageSize: 100 })),
      collect(page => api.searchSkills({ gameId: 'mhp3', page, pageSize: 100 })),
    ]).then(([decorations, skills]) => {
      if (active) setCatalog({ decorations, skills })
    }).catch(cause => { if (active) setCatalogError(cause instanceof Error ? cause.message : 'P3 技能或装饰品资料读取失败') })
    return () => { active = false }
  }, [needsCatalog, catalog, attempt])

  function choose(next: Category) {
    setCategory(next)
    setSelected(null)
    setDecorations(undefined)
    setCharm(undefined)
    setError(undefined)
  }

  function changeMode(next: 'replace' | 'edit') {
    choose(initialCategory)
    setLevel(cell.level)
    setMode(next)
  }

  async function apply() {
    if (busy) return
    const changes: P3EquipmentChanges = {}
    if (mode === 'replace') {
      if (creatingCharm) changes.selection = { kind: 'charm' }
      else if (selected) changes.selection = 'armorKey' in selected ? { kind: 'armor', key: selected.armorKey } : { kind: 'weapon', key: selected.weaponKey }
      else return
    } else if (cell.upgrade && level !== cell.level) changes.level = level
    if (creatingCharm || charm) changes.charm = activeCharm
    if (decorations) changes.decorations = decorations
    setBusy(true)
    setError(undefined)
    try { await onApply(changes); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '应用装备修改失败') }
    finally { setBusy(false) }
  }

  const disabled = busy || (needsCatalog && !catalog) || (mode === 'edit' ? !changed || !upgradeValid || editCharm && !charmValid
    : creatingCharm ? !charmValid : !selected)
  const footer = <>
    {error && <span role="alert">{error}</span>}
    <button type="button" disabled={busy} onClick={onClose}>取消</button>
    <button type="button" disabled={disabled} onClick={() => void apply()}>{mode === 'edit' ? '应用字段修改' : '应用选择'}</button>
  </>

  return <WorkspaceDrawer title={`编辑第 ${cell.slot + 1} 格装备`} onClose={onClose} busy={busy} footer={footer}>
    <div className="save-equipment-editor">
      <nav>
        <button type="button" className={mode === 'replace' ? 'is-active' : ''} onClick={() => changeMode('replace')}>替换装备</button>
        <button type="button" className={mode === 'edit' ? 'is-active' : ''} disabled={!canEdit} onClick={() => changeMode('edit')}>编辑实例</button>
      </nav>
      {mode === 'replace' && category !== 'charm' ? <div className="save-equipment-editor__replace">
        <div className="save-equipment-editor__toolbar">
          <SearchableSelect ariaLabel="装备类别" value={category} options={categories} onChange={value => choose(value as Category)} />
        </div>
        <P3EquipmentPickerContent key={category} category={category} selected={selected} onSelect={setSelected} onOpenCatalog={onOpenCatalog} />
      </div> : <div className="save-equipment-editor__advanced">
        {creatingCharm && <div className="save-equipment-editor__toolbar">
          <SearchableSelect ariaLabel="装备类别" value={category} options={categories} onChange={value => choose(value as Category)} />
        </div>}
        {mode === 'edit' && cell.upgrade && (cell.kind === 'weapon'
          ? <label><input type="checkbox" checked={level === 1} onChange={event => setLevel(event.target.checked ? 1 : 0)} />攻击强化</label>
          : <SaveEquipmentUpgradeField upgrade={cell.upgrade} value={level} onChange={setLevel} />)}
        {catalogError && <p role="alert">{catalogError} <button type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></p>}
        {!catalog && !catalogError && <p role="status">正在读取技能和装饰品资料…</p>}
        {catalog && <>
          {editCharm && <P3CharmFields value={activeCharm} skills={catalog.skills} onChange={setCharm} />}
          <section className="save-equipment-editor__decoration-section">
            <h3>装饰珠</h3>
            <DecorationEditorContent decorations={catalog.decorations.flatMap(item => item.gameId === 'mhp3' ? [{ ...item, fixed: false }] : [])}
              skills={catalog.skills} value={decorations ?? (creatingCharm ? [] : cell.decorations.filter(Boolean))}
              capacity={editCharm ? activeCharm.slots : cell.slots} onChange={setDecorations} />
          </section>
        </>}
      </div>}
    </div>
  </WorkspaceDrawer>
}

function P3CharmFields({ value, skills, onChange }: { value: Charm; skills: SkillSummary[]; onChange(next: Charm): void }) {
  const choices = [{ value: '0', label: '无' }, ...skills
    .filter(skill => skill.skillId > 0 && skill.skillId < 128 && !skill.isPlaceholder)
    .map(skill => ({ value: String(skill.skillId), label: skill.nameCn, keywords: [skill.nameJp, skill.nameEn] }))]

  return <div className="save-equipment-editor__p3-charm">
    <label><span>护石品级</span><SearchableSelect ariaLabel="护石品级" value={String(value.grade)}
      options={P3_CHARM_GRADES.map((label, grade) => ({ value: String(grade), label }))}
      onChange={grade => onChange({ ...value, grade: Number(grade) })} /></label>
    <label><span>孔数</span><SearchableSelect ariaLabel="护石孔数" value={String(value.slots)}
      options={[0, 1, 2, 3].map(slots => ({ value: String(slots), label: `${slots} 孔` }))}
      onChange={slots => onChange({ ...value, slots: Number(slots) })} /></label>
    {([1, 2] as const).map(n => {
      const id = `skill${n}Id` as const, points = `skill${n}Points` as const
      const options = choices.some(option => Number(option.value) === value[id]) ? choices : [...choices, { value: String(value[id]), label: `未知技能 #${value[id]}` }]
      return <div key={n}>
        <label><span>技能 {n}</span><SearchableSelect ariaLabel={`技能 ${n}`} value={String(value[id])} options={options}
          onChange={selected => onChange({ ...value, [id]: Number(selected), [points]: Number(selected) ? value[points] : 0 })} /></label>
        <label>技能 {n} 点数<input type="number" min={-30} max={33} disabled={value[id] === 0}
          value={value[points]} aria-invalid={!fits(value[points], -30, 33)}
          onChange={event => onChange({ ...value, [points]: event.target.valueAsNumber })} /></label>
      </div>
    })}
    <p role="status">手动组合按存档结构校验。鉴定能否获得此组合未确认。</p>
  </div>
}
