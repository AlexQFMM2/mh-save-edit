import { useEffect, useMemo, useState } from 'react'
import type { LoadoutDecoration, LoadoutSkillDefinition } from '../../../api/loadout/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './DecorationEditorContent.css'

type Props = {
  decorations: LoadoutDecoration[]
  skills: LoadoutSkillDefinition[]
  value: number[]
  capacity: number | null
  interpretFixedBit?: boolean
  onChange(value: number[]): void
}

export function DecorationEditorContent({ decorations, skills, value, capacity, interpretFixedBit = false, onChange }: Props) {
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
  const resolved = value.map(rawValue => {
    const fixed = interpretFixedBit && Boolean(rawValue & 0x8000)
    const saveId = fixed ? rawValue & 0x7fff : rawValue
    const definition = decorations.find(item => item.saveId === saveId)
    return definition ? { ...definition, saveId: rawValue, fixed: fixed || definition.fixed } : { saveId: rawValue, nameCn: `未知装饰珠 #${saveId}`, slots: 0, skills: [], fixed: true }
  })
  const used = resolved.reduce((sum, item) => sum + item.slots, 0)
  const overSlots = capacity == null ? 0 : Math.max(0, used - capacity)
  const add = () => { const item = candidates.find(candidate => String(candidate.saveId) === selected); if (item && value.length < 3) onChange([...value, item.saveId]) }
  const remove = (index: number) => onChange(value.filter((_, itemIndex) => itemIndex !== index))

  return <div className="decoration-editor-content">
    <div className="decoration-editor-content__filters">
      <label className="decoration-editor-content__filter"><span className="decoration-editor-content__label">技能</span><SearchableSelect className="decoration-editor-content__select" ariaLabel="按技能筛选装饰珠" value={skillId} options={[{ value: 'all', label: '全部技能' }, ...skills.map(skill => ({ value: String(skill.skillId), label: skill.nameCn, keywords: [skill.nameEn, skill.nameJp] }))]} onChange={setSkillId} /></label>
      <label className="decoration-editor-content__filter"><span className="decoration-editor-content__label">孔位</span><SearchableSelect ariaLabel="按孔位筛选装饰珠" value={slots} options={[{ value: 'all', label: '全部孔位' }, { value: '1', label: '1 孔' }, { value: '2', label: '2 孔' }, { value: '3', label: '3 孔' }]} onChange={setSlots} /></label>
      <label className="decoration-editor-content__filter"><span className="decoration-editor-content__label">排序</span><SearchableSelect ariaLabel="装饰珠排序" value={sort} options={[{ value: 'id', label: 'ID 升序' }, { value: 'slots', label: '孔位升序' }, { value: 'points', label: '技能点降序' }]} onChange={setSort} /></label>
    </div>
    <div className="decoration-editor-content__picker"><SearchableSelect className="decoration-editor-content__candidate-select" ariaLabel="选择装饰珠" value={selected} options={candidates.map(item => ({ value: String(item.saveId), label: `${item.nameCn} · ${item.slots}孔`, keywords: [`${item.saveId}`, `0x${item.saveId.toString(16)}`, ...item.skills.flatMap(point => [point.nameCn, skills.find(skill => skill.skillId === point.skillId)?.nameEn ?? '', `${point.points}`])] }))} onChange={setSelected} /><button className="decoration-editor-content__add" type="button" disabled={!selected || value.length >= 3} onClick={add}>添加</button></div>
    <div className="decoration-editor-content__usage" data-state={overSlots ? 'invalid' : 'confirmed'}>{capacity == null ? '天然孔未解析' : <>天然孔 <b className="decoration-editor-content__data">{capacity}</b></>} · 已用 <b className="decoration-editor-content__data">{used}</b> · 剩余 <b className="decoration-editor-content__data">{capacity == null ? '—' : capacity - used}</b> · 记录 <b className="decoration-editor-content__data">{value.length}/3</b>{overSlots > 0 && <strong className="decoration-editor-content__warning">风险：超出 {overSlots} 孔，允许手动保留</strong>}</div>
    <ul className="decoration-editor-content__list">{resolved.map((item, index) => <li className="decoration-editor-content__item" key={`${item.saveId}-${index}`}><span className="decoration-editor-content__item-body"><strong className="decoration-editor-content__item-name">{item.nameCn}</strong><small className="decoration-editor-content__item-detail">{item.fixed ? `${item.slots} 孔 · 固定 / 内置记录（原值保留）` : `${item.slots} 孔 · ${item.skills.map(point => `${point.nameCn} ${point.points > 0 ? '+' : ''}${point.points}`).join(' / ')}`}</small></span><button className="decoration-editor-content__remove" type="button" onClick={() => remove(index)}>移除</button></li>)}</ul>
  </div>
}
