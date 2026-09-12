import { useEffect, useMemo, useState } from 'react'
import { validateCharm } from '../../../api/loadout/charm'
import type { CharmValidationResult, LoadoutCalculationSnapshot, LoadoutCharm, LoadoutLock, LoadoutSkillPoint } from '../../../api/loadout/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './CharmEditorForm.css'

export type EditableCharm = LoadoutCharm & { lock: LoadoutLock }
type Props = {
  snapshot: LoadoutCalculationSnapshot
  current: EditableCharm | null
  pointMinimum?: number
  pointMaximum?: number
  onChange(value: EditableCharm, validation: CharmValidationResult): void
}

function pointFor(skills: LoadoutCalculationSnapshot['skills'], id: string, points: number, fallback?: LoadoutSkillPoint | null): LoadoutSkillPoint | null {
  if (!id) return null
  const numericId = Number(id)
  const skill = skills.find(item => item.skillId === numericId)
  if (skill) return { skillId: skill.skillId, nameCn: skill.nameCn, points }
  if (fallback?.skillId === numericId) return { ...fallback, points }
  return { skillId: numericId, nameCn: `未知技能 0x${numericId.toString(16).toUpperCase()}`, points }
}

export function CharmEditorForm({ snapshot, current, pointMinimum = -32768, pointMaximum = 32767, onChange }: Props) {
  const { charmClasses: classes, skills } = snapshot
  const [classId, setClassId] = useState(String(current?.classId ?? classes[0]?.classId ?? ''))
  const [slots, setSlots] = useState(current?.slots ?? 0)
  const [skill1, setSkill1] = useState(current?.skill1?.skillId == null ? '' : String(current.skill1.skillId))
  const [points1, setPoints1] = useState(current?.skill1?.points ?? 0)
  const [skill2, setSkill2] = useState(current?.skill2?.skillId == null ? '' : String(current.skill2.skillId))
  const [points2, setPoints2] = useState(current?.skill2?.points ?? 0)
  const selectedClass = classes.find(item => String(item.classId) === classId)
  const options = useMemo(() => {
    const values = [{ value: '', label: '未设置', keywords: ['none', 'empty'] }, ...skills.map(item => ({ value: String(item.skillId), label: item.nameCn, keywords: [item.nameEn, item.nameJp, `0x${item.skillId.toString(16)}`] }))]
    for (const point of [current?.skill1, current?.skill2]) if (point && !values.some(item => item.value === String(point.skillId))) values.push({ value: String(point.skillId), label: point.nameCn, keywords: [`0x${point.skillId.toString(16)}`, '未知技能', '保留原值'] })
    return values
  }, [current, skills])
  const draft = useMemo<EditableCharm>(() => ({
    kind: 'charm', gameId: snapshot.gameId, classId: Number(classId) || 0,
    classNameCn: selectedClass?.nameCn ?? current?.classNameCn ?? '自定义护石', slots,
    skill1: pointFor(skills, skill1, points1, current?.skill1), skill2: pointFor(skills, skill2, points2, current?.skill2),
    decorations: current?.decorations ?? [], legality: current?.legality ?? 'unknown', encoding: current?.encoding ?? 'encodable', issues: current?.issues ?? [], instance: current?.instance,
    lock: current?.lock ?? 'unlocked',
  }), [classId, current, points1, points2, selectedClass?.nameCn, skill1, skill2, skills, slots, snapshot.gameId])
  const validation = useMemo(() => {
    const base = validateCharm(snapshot, draft)
    const outside = [draft.skill1, draft.skill2].find(point => point && (point.points < pointMinimum || point.points > pointMaximum))
    if (!outside) return base
    return { ...base, legality: 'invalid' as const, encoding: 'blocked' as const, issues: [...base.issues, { code: 'charm.skill.format-width', path: 'charm.skills', severity: 'error' as const, message: `当前存档格式的技能点编码范围为 ${pointMinimum}～${pointMaximum}` }] }
  }, [draft, pointMaximum, pointMinimum, snapshot])
  const validatedDraft = useMemo<EditableCharm>(() => ({ ...draft, legality: validation.legality, encoding: validation.encoding, issues: validation.issues }), [draft, validation])
  useEffect(() => onChange(validatedDraft, validation), [onChange, validatedDraft, validation])
  const renderRange = (position: 'A' | 'B') => {
    const ranges = validation.ranges.filter(item => item.position === position)
    if (!ranges.length) return <span className="charm-editor-form__range charm-editor-form__range--unknown">未找到当前品级、孔位与技能的自然范围；可编码时仍可手动应用。</span>
    return <span className="charm-editor-form__range">自然范围：{ranges.map(item => `${item.min >= 0 ? '+' : ''}${item.min}～${item.max >= 0 ? '+' : ''}${item.max}`).join('、')} · 来源：{[...new Set(ranges.map(item => item.source))].join('、')}</span>
  }
  return <div className="charm-editor-form">
    <label className="charm-editor-form__field"><span className="charm-editor-form__field-label">护石品级</span><SearchableSelect className="charm-editor-form__select" ariaLabel="护石品级" value={classId} options={classes.map(item => ({ value: String(item.classId), label: item.nameCn, keywords: [item.nameEn] }))} onChange={setClassId} /></label>
    <label className="charm-editor-form__field"><span className="charm-editor-form__field-label">孔位</span><input className="charm-editor-form__number" type="number" min={0} max={3} value={slots} onChange={event => setSlots(Number(event.target.value))} /><span className="charm-editor-form__encoding-range">编码范围 0～3；当前品级上限 {selectedClass?.maxSlots ?? '未知'}</span></label>
    <div className="charm-editor-form__skill">
      <label className="charm-editor-form__skill-field"><span className="charm-editor-form__skill-label">A 技能</span><SearchableSelect className="charm-editor-form__select" ariaLabel="A 技能" value={skill1} options={options} placeholder="未设置" onChange={setSkill1} /><input className="charm-editor-form__number" aria-label="A 技能点数" type="number" min={pointMinimum} max={pointMaximum} value={points1} disabled={!skill1} onChange={event => setPoints1(Number(event.target.value))} /></label>{skill1 && renderRange('A')}
      <label className="charm-editor-form__skill-field"><span className="charm-editor-form__skill-label">B 技能</span><SearchableSelect className="charm-editor-form__select" ariaLabel="B 技能" value={skill2} options={options} placeholder="未设置" onChange={setSkill2} /><input className="charm-editor-form__number" aria-label="B 技能点数" type="number" min={pointMinimum} max={pointMaximum} value={points2} disabled={!skill2} onChange={event => setPoints2(Number(event.target.value))} /></label>{skill2 && renderRange('B')}
    </div>
    <div className="charm-editor-form__diagnostics" data-state={validation.encoding === 'blocked' ? 'blocked' : validation.legality} aria-live="polite">{validation.issues.length ? validation.issues.map(issue => <span className="charm-editor-form__diagnostic" key={`${issue.code}-${issue.path}`}>{issue.severity === 'error' ? '阻断' : issue.severity === 'warning' ? '风险' : '提示'}：{issue.message}</span>) : <span className="charm-editor-form__diagnostic">当前字段处于已确认自然范围，且结构可编码。</span>}</div>
    <p className="charm-editor-form__note">自然合法性和结构可编码性分别判断。自然范围外的组合允许手动应用；只有超出字段宽度时才阻断。已有实例的保留字节不会被此表单改写。</p>
  </div>
}
