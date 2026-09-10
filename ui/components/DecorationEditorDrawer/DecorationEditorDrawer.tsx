import { useEffect, useMemo, useState } from 'react'
import type { LoadoutDecoration, LoadoutSkillDefinition } from '../../../api/loadout/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './DecorationEditorDrawer.css'

type Props = {
  decorations: LoadoutDecoration[]
  skills: LoadoutSkillDefinition[]
  current: LoadoutDecoration[]
  capacity: number
  onApply: (value: LoadoutDecoration[]) => void
  onClose: () => void
}

export function DecorationEditorDrawer({ decorations, skills, current, capacity, onApply, onClose }: Props) {
  const [values, setValues] = useState(() => structuredClone(current))
  const [selected, setSelected] = useState('')
  const [skillId, setSkillId] = useState('all')
  const [slots, setSlots] = useState('all')
  const [sort, setSort] = useState('id')
  const candidates = useMemo(() => decorations
    .filter(item => skillId === 'all' || item.skills.some(point => String(point.skillId) === skillId))
    .filter(item => slots === 'all' || item.slots === Number(slots))
    .sort((a, b) => sort === 'slots'
      ? a.slots - b.slots || a.saveId - b.saveId
      : sort === 'points'
        ? Math.max(...b.skills.map(point => point.points), -999) - Math.max(...a.skills.map(point => point.points), -999) || a.saveId - b.saveId
        : a.saveId - b.saveId), [decorations, skillId, slots, sort])
  useEffect(() => {
    if (!candidates.some(item => String(item.saveId) === selected)) setSelected(String(candidates[0]?.saveId ?? ''))
  }, [candidates, selected])
  const add = () => {
    const item = candidates.find(value => String(value.saveId) === selected)
    if (item && values.length < 3) setValues(currentValues => [...currentValues, structuredClone(item)])
  }
  const remove = (index: number) => setValues(currentValues => currentValues.filter((_, itemIndex) => itemIndex !== index))
  const used = values.reduce((sum, item) => sum + item.slots, 0)
  const overSlots = Math.max(0, used - capacity)

  return <LoadoutWorkspaceDrawer title="编辑装饰珠" onClose={onClose} footer={<>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" className="decoration-editor-drawer__apply" onClick={() => onApply(values)}>应用装饰珠</button>
  </>}>
    <div className="decoration-editor-drawer">
      <div className="decoration-editor-drawer__filters">
        <label className="decoration-editor-drawer__filter"><span className="decoration-editor-drawer__label">技能</span><SearchableSelect className="decoration-editor-drawer__select" ariaLabel="按技能筛选装饰珠" value={skillId} options={[{ value: 'all', label: '全部技能' }, ...skills.map(skill => ({ value: String(skill.skillId), label: skill.nameCn, keywords: [skill.nameEn, skill.nameJp] }))]} onChange={setSkillId} /></label>
        <label className="decoration-editor-drawer__filter"><span className="decoration-editor-drawer__label">孔位</span><SearchableSelect ariaLabel="按孔位筛选装饰珠" value={slots} options={[{ value: 'all', label: '全部孔位' }, { value: '1', label: '1 孔' }, { value: '2', label: '2 孔' }, { value: '3', label: '3 孔' }]} onChange={setSlots} /></label>
        <label className="decoration-editor-drawer__filter"><span className="decoration-editor-drawer__label">排序</span><SearchableSelect ariaLabel="装饰珠排序" value={sort} options={[{ value: 'id', label: 'ID 升序' }, { value: 'slots', label: '孔位升序' }, { value: 'points', label: '技能点降序' }]} onChange={setSort} /></label>
      </div>
      <div className="decoration-editor-drawer__picker">
        <SearchableSelect className="decoration-editor-drawer__candidate-select" ariaLabel="选择装饰珠" value={selected} options={candidates.map(item => ({ value: String(item.saveId), label: `${item.nameCn} · ${item.slots}孔`, keywords: [`${item.saveId}`, `0x${item.saveId.toString(16)}`, ...item.skills.flatMap(point => [point.nameCn, skills.find(value => value.skillId === point.skillId)?.nameEn ?? '', `${point.points}`])] }))} onChange={setSelected} />
        <button className="decoration-editor-drawer__add" type="button" disabled={!selected || values.length >= 3} onClick={add}>添加</button>
      </div>
      <div className="decoration-editor-drawer__usage" data-state={overSlots ? 'invalid' : 'confirmed'}>天然孔 <b className="decoration-editor-drawer__data">{capacity}</b> · 已用 <b className="decoration-editor-drawer__data">{used}</b> · 剩余 <b className="decoration-editor-drawer__data">{capacity - used}</b> · 记录 <b className="decoration-editor-drawer__data">{values.length}/3</b>{overSlots > 0 && <strong className="decoration-editor-drawer__warning">风险：超出 {overSlots} 孔，允许手动保留</strong>}</div>
      <ul className="decoration-editor-drawer__list">{values.map((item, index) => <li className="decoration-editor-drawer__item" key={`${item.saveId}-${index}`}><span className="decoration-editor-drawer__item-body"><strong className="decoration-editor-drawer__item-name">{item.nameCn}</strong><small className="decoration-editor-drawer__item-detail">{item.slots} 孔 · {item.skills.map(point => `${point.nameCn} ${point.points > 0 ? '+' : ''}${point.points}`).join(' / ')}</small></span><button className="decoration-editor-drawer__remove" type="button" onClick={() => remove(index)}>移除</button></li>)}</ul>
    </div>
  </LoadoutWorkspaceDrawer>
}
