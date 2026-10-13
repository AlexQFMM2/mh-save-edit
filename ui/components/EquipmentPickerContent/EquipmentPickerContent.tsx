import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArmorLoadoutSlot, LoadoutArmorCandidate, LoadoutDecoration, LoadoutFacets, LoadoutGame, LoadoutPage, LoadoutRelicLookup, LoadoutSlot, LoadoutWeaponCandidate } from '../../../api/loadout/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { EquipmentPickerPreview } from '../EquipmentPickerPreview/EquipmentPickerPreview'
import './EquipmentPickerContent.css'

export type EquipmentPickerCandidate = LoadoutWeaponCandidate | LoadoutArmorCandidate
type Props = {
  gameId: LoadoutGame
  slot: Exclude<LoadoutSlot, 'charm'>
  facets: LoadoutFacets
  relicLookups: LoadoutRelicLookup[]
  decorations: LoadoutDecoration[]
  current?: EquipmentPickerCandidate | null
  onSelectionChange(candidate: EquipmentPickerCandidate | null): void
  onOpenCatalog?: (path: string) => void
}
const emptyPage: LoadoutPage<EquipmentPickerCandidate> = { items: [], page: 1, pageSize: 100, total: 0, hasNext: false }
function displayIdentity(candidate: EquipmentPickerCandidate) {
  if (candidate.gameId === 'mhp2g') return `图鉴 ${(candidate.kind === 'armor' ? candidate.armorKey : candidate.weaponKey).split(':').at(-1)}`
  return `ID ${candidate.saveId ?? (candidate.kind === 'armor' ? candidate.dexId : null) ?? '—'}`
}

export function EquipmentPickerContent({ gameId, slot, facets, relicLookups, decorations, current, onSelectionChange, onOpenCatalog }: Props) {
  const candidateButtons = useRef<Array<HTMLButtonElement | null>>([])
  const requestSequence = useRef(0)
  const [token, setToken] = useState('')
  const [finalOnly, setFinalOnly] = useState(false)
  const [response, setResponse] = useState<LoadoutPage<EquipmentPickerCandidate>>(emptyPage)
  const [edited, setEdited] = useState<Record<string, EquipmentPickerCandidate>>({})
  const [selection, setSelection] = useState<EquipmentPickerCandidate | null>(current ?? null)
  const selected = selection?.candidateKey
  const [attempt, setAttempt] = useState(0)
  const [source, setSource] = useState('all'); const [type, setType] = useState('all'); const [rarity, setRarity] = useState('all'); const [slots, setSlots] = useState('all')
  const [combat, setCombat] = useState('all'); const [gender, setGender] = useState('all'); const [skill, setSkill] = useState('all'); const [producible, setProducible] = useState('all'); const [sort, setSort] = useState('source')
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState<string>()
  const rarities = slot === 'weapon' ? facets.weaponRarities : facets.armorRarities

  useEffect(() => {
    const sequence = ++requestSequence.current; setLoading(true); setError(undefined)
    const timer = window.setTimeout(() => {
      const common = { gameId, query: token.trim() || undefined, sourceKind: source === 'all' ? undefined : source as 'catalog' | 'relicTemplate', rarity: rarity === 'all' ? undefined : Number(rarity), slots: slots === 'all' ? undefined : Number(slots), page, pageSize: 100 }
      const request = slot === 'weapon'
        ? window.mhSaveEditor.loadout.searchWeapons({ ...common, typeId: type === 'all' ? undefined : Number(type), finalOnly, directlyProducible: producible === 'all' ? undefined : producible === 'yes', sort: sort as 'source' | 'rarity' | 'slots' | 'attack' })
        : window.mhSaveEditor.loadout.searchArmors({ ...common, part: slot as ArmorLoadoutSlot, skillId: skill === 'all' ? undefined : Number(skill), combat: combat === 'all' ? undefined : combat as 'blademaster' | 'gunner', gender: gender === 'all' ? undefined : gender as 'male' | 'female', sort: sort as 'source' | 'rarity' | 'slots' | 'defense' | 'skill' })
      void request.then(value => { if (sequence === requestSequence.current) setResponse(value as LoadoutPage<EquipmentPickerCandidate>) }).catch(cause => { if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : '候选读取失败') }).finally(() => { if (sequence === requestSequence.current) setLoading(false) })
    }, token ? 120 : 0)
    return () => { window.clearTimeout(timer); requestSequence.current += 1 }
  }, [finalOnly, combat, gameId, gender, page, producible, rarity, skill, slot, slots, sort, source, token, type, attempt])
  useEffect(() => setPage(1), [finalOnly, combat, gender, producible, rarity, skill, slots, sort, source, token, type])
  const visible = response.items.map(item => edited[item.candidateKey] ?? item)
  const pageCount = Math.max(1, Math.ceil(response.total / response.pageSize))
  const visibleSelected = visible.some(item => item.candidateKey === selected)
  const active = (selected ? edited[selected] : undefined) ?? selection ?? undefined
  useEffect(() => onSelectionChange(active ?? null), [active, onSelectionChange])
  const moveCandidate = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index
    if (event.key === 'ArrowDown') next = Math.min(visible.length - 1, index + 1); else if (event.key === 'ArrowUp') next = Math.max(0, index - 1); else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = visible.length - 1; else if (event.key === 'PageDown') next = Math.min(visible.length - 1, index + 10); else if (event.key === 'PageUp') next = Math.max(0, index - 10); else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const candidate = visible[index]; if (candidate) setSelection(candidate); return } else return
    event.preventDefault(); const candidate = visible[next]; if (candidate) setSelection(candidate); candidateButtons.current[next]?.focus()
  }
  const skillOptions = useMemo(() => facets.skills.map(item => ({ value: String(item.skillId), label: item.nameCn, keywords: [item.nameEn, item.nameJp] })), [facets.skills])

  return <div className="equipment-picker-content">
    <label className="equipment-picker-content__search"><span className="equipment-picker-content__label">搜索</span><input className="equipment-picker-content__search-input" value={token} onChange={event => setToken(event.target.value)} placeholder={gameId === 'mhp2g' ? '名称、日文、原生键、技能或材料' : '名称、英文名、十进制或十六进制 ID'} /><small className="equipment-picker-content__count">{loading ? '正在读取…' : `${response.total} 条 · 选择后在底栏应用`}</small></label>
    <div className="equipment-picker-content__filters">
      {gameId !== 'mhp2g' && <SearchableSelect ariaLabel="候选来源" value={source} options={[{ value: 'all', label: '全部来源' }, { value: 'catalog', label: '普通图鉴' }, { value: 'relicTemplate', label: '发掘模板' }]} onChange={setSource} />}
      {slot === 'weapon' ? <><SearchableSelect ariaLabel="武器类型" value={type} options={[{ value: 'all', label: '全部类型' }, ...facets.weaponTypes.map(item => ({ value: String(item.typeId), label: item.nameCn }))]} onChange={setType} /><SearchableSelect ariaLabel="可直接生产" value={producible} options={[{ value: 'all', label: '全部生产状态' }, { value: 'yes', label: '仅可直接生产' }, { value: 'no', label: '不可直接生产' }]} onChange={setProducible} /></> : <><SearchableSelect ariaLabel="防具职业" value={combat} options={[{ value: 'all', label: '全部职业' }, { value: 'blademaster', label: '近战（含通用）', keywords: ['剑士', 'blademaster', 'melee'] }, { value: 'gunner', label: '远程（含通用）', keywords: ['枪手', 'gunner', 'ranged'] }]} onChange={setCombat} /><SearchableSelect ariaLabel="防具性别" value={gender} options={[{ value: 'all', label: '全部性别' }, { value: 'male', label: '男性' }, { value: 'female', label: '女性' }]} onChange={setGender} /><SearchableSelect className="equipment-picker-content__skill-select" ariaLabel="防具技能" value={skill} options={[{ value: 'all', label: '全部技能' }, ...skillOptions]} onChange={setSkill} /></>}
      {slot === 'weapon' && <label className="equipment-picker-content__check"><input type="checkbox" checked={finalOnly} onChange={event => setFinalOnly(event.target.checked)} /><span>只看无法再强化</span></label>}
      <SearchableSelect ariaLabel="装备稀有度" value={rarity} options={[{ value: 'all', label: '全部稀有度' }, ...rarities.map(value => ({ value: String(value), label: `稀有度 ${value}` }))]} onChange={setRarity} />
      <SearchableSelect ariaLabel="装备孔位" value={slots} options={[{ value: 'all', label: '全部孔位' }, { value: '0', label: '0 孔' }, { value: '1', label: '1 孔' }, { value: '2', label: '2 孔' }, { value: '3', label: '3 孔' }]} onChange={setSlots} />
      <SearchableSelect ariaLabel="装备排序" value={sort} options={[{ value: 'source', label: gameId === 'mhp2g' ? '原生顺序' : '来源顺序' }, { value: 'rarity', label: '稀有度降序' }, { value: 'slots', label: '孔位降序' }, ...(slot === 'weapon' ? [{ value: 'attack', label: '攻击降序' }] : [{ value: 'defense', label: '防御降序' }, { value: 'skill', label: '指定技能点降序', disabled: skill === 'all' }])]} onChange={setSort} />
    </div>
    <div className="equipment-picker-content__layout">
      <div className="equipment-picker-content__candidate-pane"><div className="equipment-picker-content__body" aria-busy={loading}>{error && <p className="equipment-picker-content__empty" role="alert">{error}<button className="equipment-picker-content__retry" type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></p>}{!error && visible.map((item, index) => <button ref={element => { candidateButtons.current[index] = element }} type="button" tabIndex={item.candidateKey === selected || (!visibleSelected && index === 0) ? 0 : -1} className={`equipment-picker-content__item${item.candidateKey === selected ? ' equipment-picker-content__item--selected' : ''}`} aria-pressed={item.candidateKey === selected} key={item.candidateKey} onKeyDown={event => moveCandidate(event, index)} onClick={() => setSelection(item)}><CatalogIcon path={item.iconPath} name={item.nameCn} /><span className="equipment-picker-content__item-copy" title={item.nameJp || item.nameEn}><strong className="equipment-picker-content__item-name">{item.nameCn}</strong><small className="equipment-picker-content__item-detail">{item.kind === 'weapon' ? item.typeNameCn : `${item.combat === 'both' ? '通用' : item.combat === 'gunner' ? '远程' : '近战'} · ${item.gender === 'both' ? '通用' : item.gender === 'male' ? '男' : '女'}`} · {displayIdentity(item)}</small></span><EquipmentSlotIndicator slots={item.slots} /><em className="equipment-picker-content__source">{item.sourceKind === 'relicTemplate' ? '发掘模板' : item.kind === 'weapon' && item.directlyProducible ? '可生产' : ''}</em></button>)}{!loading && !error && !visible.length && <p className="equipment-picker-content__empty">没有符合条件的候选。</p>}</div><nav className="equipment-picker-content__pagination" aria-label="候选分页"><button className="equipment-picker-content__pagination-button" type="button" disabled={response.page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>上一页</button><span>{response.page} / {pageCount}</span><button className="equipment-picker-content__pagination-button" type="button" disabled={!response.hasNext || loading} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>下一页</button></nav></div>
      <EquipmentPickerPreview gameId={gameId} candidate={active} current={current} relicLookups={relicLookups} decorations={decorations} onEdit={value => setEdited(values => ({ ...values, [value.candidateKey]: value }))} onOpenCatalog={onOpenCatalog} />
    </div>
  </div>
}
