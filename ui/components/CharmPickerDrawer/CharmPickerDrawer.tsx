import { useMemo, useState } from 'react'
import { validateCharm } from '../../../api/loadout/charm'
import type { LoadoutCalculationSnapshot, LoadoutCharm, LoadoutLock, LoadoutSkillPoint } from '../../../api/loadout/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './CharmPickerDrawer.css'

type EditableCharm = LoadoutCharm & { lock: LoadoutLock }
type Props = {
  snapshot: LoadoutCalculationSnapshot
  current: EditableCharm | null
  onApply: (value: EditableCharm) => void
  onClose: () => void
}

function pointFor(skills: LoadoutCalculationSnapshot['skills'], id: string, points: number, fallback?: LoadoutSkillPoint | null): LoadoutSkillPoint | null {
  if (!id) return null
  const numericId = Number(id)
  const skill = skills.find(item => item.skillId === numericId)
  if (skill) return { skillId: skill.skillId, nameCn: skill.nameCn, points }
  if (fallback?.skillId === numericId) return { ...fallback, points }
  return { skillId: numericId, nameCn: `未知技能 0x${numericId.toString(16).toUpperCase()}`, points }
}

export function CharmPickerDrawer({ snapshot, current, onApply, onClose }: Props) {
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
    for (const point of [current?.skill1, current?.skill2]) {
      if (point && !values.some(item => item.value === String(point.skillId))) values.push({ value: String(point.skillId), label: point.nameCn, keywords: [`0x${point.skillId.toString(16)}`, '未知技能', '保留原值'] })
    }
    return values
  }, [current, skills])
  const draft: EditableCharm = {
    kind: 'charm', gameId: snapshot.gameId, classId: Number(classId) || 0,
    classNameCn: selectedClass?.nameCn ?? current?.classNameCn ?? '自定义护石', slots,
    skill1: pointFor(skills, skill1, points1, current?.skill1),
    skill2: pointFor(skills, skill2, points2, current?.skill2),
    decorations: current?.decorations ?? [], legality: current?.legality ?? 'unknown',
    encoding: current?.encoding ?? 'encodable', issues: current?.issues ?? [], instance: current?.instance,
    lock: current?.lock ?? 'unlocked',
  }
  const validation = validateCharm(snapshot, draft)
  const validatedDraft: EditableCharm = { ...draft, legality: validation.legality, encoding: validation.encoding, issues: validation.issues }
  const renderRange = (position: 'A' | 'B') => {
    const ranges = validation.ranges.filter(item => item.position === position)
    if (!ranges.length) return <span className="charm-picker-drawer__range charm-picker-drawer__range--unknown">未找到当前品级、孔位与技能的自然范围；可编码时仍可手动应用。</span>
    return <span className="charm-picker-drawer__range">自然范围：{ranges.map(item => `${item.min >= 0 ? '+' : ''}${item.min}～${item.max >= 0 ? '+' : ''}${item.max}`).join('、')} · 来源：{[...new Set(ranges.map(item => item.source))].join('、')}</span>
  }

  return <LoadoutWorkspaceDrawer title="编辑护石" onClose={onClose} footer={<>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" className="charm-picker-drawer__apply" disabled={validation.encoding === 'blocked'} onClick={() => onApply(validatedDraft)}>应用护石</button>
  </>}>
    <div className="charm-picker-drawer">
      <label className="charm-picker-drawer__field"><span className="charm-picker-drawer__field-label">护石品级</span><SearchableSelect className="charm-picker-drawer__select" ariaLabel="护石品级" value={classId} options={classes.map(item => ({ value: String(item.classId), label: item.nameCn, keywords: [item.nameEn] }))} onChange={setClassId} /></label>
      <label className="charm-picker-drawer__field"><span className="charm-picker-drawer__field-label">孔位</span><input className="charm-picker-drawer__number" type="number" min={0} max={3} value={slots} onChange={event => setSlots(Number(event.target.value))} /><span className="charm-picker-drawer__encoding-range">编码范围 0～3；当前品级上限 {selectedClass?.maxSlots ?? '未知'}</span></label>
      <div className="charm-picker-drawer__skill">
        <label className="charm-picker-drawer__skill-field"><span className="charm-picker-drawer__skill-label">A 技能</span><SearchableSelect className="charm-picker-drawer__select" ariaLabel="A 技能" value={skill1} options={options} placeholder="未设置" onChange={setSkill1} /><input className="charm-picker-drawer__number" aria-label="A 技能点数" type="number" min={-32768} max={32767} value={points1} disabled={!skill1} onChange={event => setPoints1(Number(event.target.value))} /></label>
        {skill1 && renderRange('A')}
        <label className="charm-picker-drawer__skill-field"><span className="charm-picker-drawer__skill-label">B 技能</span><SearchableSelect className="charm-picker-drawer__select" ariaLabel="B 技能" value={skill2} options={options} placeholder="未设置" onChange={setSkill2} /><input className="charm-picker-drawer__number" aria-label="B 技能点数" type="number" min={-32768} max={32767} value={points2} disabled={!skill2} onChange={event => setPoints2(Number(event.target.value))} /></label>
        {skill2 && renderRange('B')}
      </div>
      <div className="charm-picker-drawer__diagnostics" data-state={validation.encoding === 'blocked' ? 'blocked' : validation.legality} aria-live="polite">{validation.issues.length ? validation.issues.map(issue => <span className="charm-picker-drawer__diagnostic" key={`${issue.code}-${issue.path}`}>{issue.severity === 'error' ? '阻断' : issue.severity === 'warning' ? '风险' : '提示'}：{issue.message}</span>) : <span className="charm-picker-drawer__diagnostic">当前字段处于已确认自然范围，且结构可编码。</span>}</div>
      <p className="charm-picker-drawer__note">自然合法性和结构可编码性分别判断。自然范围外的组合允许手动应用；只有超出字段宽度时才阻断。已有 28 字节实例及 0x14–0x1B 保留字节不会被此表单改写。</p>
    </div>
  </LoadoutWorkspaceDrawer>
}
