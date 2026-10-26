import { useMemo, useState } from 'react'
import type { SkillArmorRelation } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './SkillArmorRelationList.css'
const armorKey = (row: SkillArmorRelation) => row.gameId === 'mhp3' ? row.armorKey : String(row.dexId)
const armorName = (row: SkillArmorRelation) => row.nameCn || (row.gameId === 'mhp3' ? row.nameJp : '')
const parts = { head: '头', chest: '胸', arms: '手', waist: '腰', legs: '腿' }
export function SkillArmorRelationList({ rows, onSelect }: { rows: SkillArmorRelation[]; onSelect: (row: SkillArmorRelation) => void }) {
  const [sort, setSort] = useState<'points' | 'slots'>('points')
  const sorted = useMemo(() => [...rows].sort((left, right) => sort === 'slots' ? right.slots - left.slots || right.points - left.points || armorKey(left).localeCompare(armorKey(right), undefined, { numeric: true }) : right.points - left.points || right.slots - left.slots || armorKey(left).localeCompare(armorKey(right), undefined, { numeric: true })), [rows, sort])
  return <div className="skill-armor-relation-list__root"><div className="skill-armor-relation-list__toolbar"><label className="skill-armor-relation-list__sort-label">防具排序<SearchableSelect ariaLabel="相关防具排序" value={sort} onChange={value => setSort(value as 'points' | 'slots')} options={[{ value: 'points', label: '技能点降序', keywords: ['数值', '技能'] }, { value: 'slots', label: '孔位降序', keywords: ['插槽', 'slots'] }]} /></label></div>{sorted.length ? <ul className="skill-armor-relation-list">{sorted.map(row => <li className="skill-armor-relation-list__item" key={armorKey(row)}><button className="skill-armor-relation-list__button" type="button" onClick={() => onSelect(row)}><span className="skill-armor-relation-list__icon"><ArmorIcon path={row.iconPath} name={armorName(row)} /></span><span className="skill-armor-relation-list__copy"><strong className="skill-armor-relation-list__name">{armorName(row)}</strong><small className="skill-armor-relation-list__subtitle">{row.nameEn || (row.gameId === 'mhp3' ? `原生编号 ${row.nativeId}` : '')} · {parts[row.part]}{row.gameId === 'mhp3' && row.referenceCoverage === 'native-only-acquisition-unverified' ? ' · 取得未确认' : ''}</small></span><span className="skill-armor-relation-list__slots" aria-label={`${row.slots} 个孔位`}><EquipmentSlotIndicator slots={row.slots} /></span><b className="skill-armor-relation-list__points">{row.gameId === 'mhp3' && row.kind === 'torso-copy-marker' ? '胴系复制' : `${row.points > 0 ? '+' : ''}${row.points}`}</b></button></li>)}</ul> : <p className="skill-armor-relation-list__empty">没有相关防具。</p>}</div>
}
