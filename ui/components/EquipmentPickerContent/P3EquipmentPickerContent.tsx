import { useEffect, useState } from 'react'
import type { P3ArmorSummary } from '../../../api/catalog/p3ArmorTypes'
import type { P3WeaponSummary, P3WeaponType } from '../../../api/catalog/p3WeaponTypes'
import type { PageResult } from '../../../api/catalog/types'
import { getCatalogArmor, type CatalogArmorDetail } from '../../utils/catalogArmor'
import { getCatalogWeapon, type CatalogWeaponDetail } from '../../utils/catalogWeapon'
import { ArmorDetailPanel } from '../ArmorDetailPanel/ArmorDetailPanel'
import { WeaponDetailPanel } from '../WeaponDetailPanel/WeaponDetailPanel'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { EquipmentPickerResults } from './EquipmentPickerResults'
import './EquipmentPickerContent.css'
import '../EquipmentPickerPreview/EquipmentPickerPreview.css'

export type P3EquipmentCandidate = P3ArmorSummary | P3WeaponSummary

const keyOf = (candidate: P3EquipmentCandidate) => 'armorKey' in candidate ? candidate.armorKey : candidate.weaponKey
const empty = { items: [], page: 1, pageSize: 100, total: 0, hasNext: false }

type Props = {
  category: 'weapon' | P3ArmorSummary['part']
  selected: P3EquipmentCandidate | null
  onSelect(value: P3EquipmentCandidate): void
  onOpenCatalog(path: string): void
}

export function P3EquipmentPickerContent({ category, selected, onSelect, onOpenCatalog }: Props) {
  const [query, setQuery] = useState('')
  const [weaponType, setWeaponType] = useState('all')
  const [weaponTypes, setWeaponTypes] = useState<P3WeaponType[]>([])
  const [rarity, setRarity] = useState('all')
  const [slots, setSlots] = useState('all')
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<PageResult<P3EquipmentCandidate>>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (category !== 'weapon') return
    let active = true
    void window.mhSaveEditor.catalog.getWeaponFacets('mhp3')
      .then(facets => { if (active) setWeaponTypes(facets.weaponTypes) })
      .catch(() => { if (active) setWeaponTypes([]) })
    return () => { active = false }
  }, [category])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    const timer = window.setTimeout(() => {
      const common = {
        gameId: 'mhp3' as const, query: query.trim() || undefined, page, pageSize: 100,
        rarity: rarity === 'all' ? undefined : Number(rarity), slots: slots === 'all' ? undefined : Number(slots),
      }
      const request = category === 'weapon'
        ? window.mhSaveEditor.catalog.searchWeapons({ ...common, weaponTypeId: weaponType === 'all' ? undefined : Number(weaponType) })
        : window.mhSaveEditor.catalog.searchArmors({ ...common, part: category })
      void request.then(value => { if (active) setResult(value) })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'P3 候选读取失败') })
        .finally(() => { if (active) setLoading(false) })
    }, query ? 120 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [category, query, weaponType, rarity, slots, page, attempt])

  return <div className="equipment-picker-content">
    <label className="equipment-picker-content__search">
      <span className="equipment-picker-content__label">搜索</span>
      <input className="equipment-picker-content__search-input" value={query} placeholder="名称、日文、原生编号、技能或材料"
        onChange={event => { setQuery(event.target.value); setPage(1) }} />
      <small className="equipment-picker-content__count">{loading ? '正在读取…' : `${result.total} 条`}</small>
    </label>
    <div className="equipment-picker-content__filters">
      {category === 'weapon' && <SearchableSelect ariaLabel="武器类型" value={weaponType}
        options={[{ value: 'all', label: '全部类型' }, ...weaponTypes.map(type => ({ value: String(type.typeId), label: type.nameCn }))]}
        onChange={value => { setWeaponType(value); setPage(1) }} />}
      <SearchableSelect ariaLabel="装备稀有度" value={rarity}
        options={[{ value: 'all', label: '全部稀有度' }, ...Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: `稀有度 ${i + 1}` }))]}
        onChange={value => { setRarity(value); setPage(1) }} />
      <SearchableSelect ariaLabel="装备孔位" value={slots}
        options={[{ value: 'all', label: '全部孔位' }, ...[0, 1, 2, 3].map(n => ({ value: String(n), label: `${n} 孔` }))]}
        onChange={value => { setSlots(value); setPage(1) }} />
    </div>
    <div className="equipment-picker-content__layout">
      <EquipmentPickerResults
        rows={result.items.map(item => ({
          key: keyOf(item), name: item.nameCn, tooltip: item.nameJp, iconPath: item.iconPath, slots: item.slots,
          subtitle: `${'weaponKey' in item ? item.typeNameCn : item.combat === 'both' ? '通用' : item.combat === 'gunner' ? '远程' : '近战'} · ${item.nativeId}`,
          source: 'weaponKey' in item && item.isDirectlyProducible ? '可生产' : undefined,
        }))}
        selected={selected ? keyOf(selected) : undefined} loading={loading} error={error}
        page={result.page} pageCount={Math.max(1, Math.ceil(result.total / result.pageSize))} hasNext={result.hasNext}
        onSelect={index => { if (!loading) onSelect(result.items[index]) }} onPage={setPage}
        onRetry={() => setAttempt(value => value + 1)}
      />
      <P3EquipmentPreview selected={selected} onOpenCatalog={onOpenCatalog} />
    </div>
  </div>
}

function P3EquipmentPreview({ selected, onOpenCatalog }: Pick<Props, 'selected' | 'onOpenCatalog'>) {
  const armorKey = selected && 'armorKey' in selected ? selected.armorKey : undefined
  const weaponKey = selected && 'weaponKey' in selected ? selected.weaponKey : undefined
  const [detail, setDetail] = useState<CatalogArmorDetail | CatalogWeaponDetail | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setDetail(null)
    setError(undefined)
    if (!armorKey && !weaponKey) { setLoading(false); return }
    let active = true
    setLoading(true)
    const request = armorKey ? getCatalogArmor('mhp3', armorKey) : getCatalogWeapon('mhp3', weaponKey!)
    void request.then(value => {
      if (!active) return
      if (value) setDetail(value)
      else setError('没有找到对应图鉴条目')
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '详情读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [armorKey, weaponKey, attempt])

  const itemPath = (id: number) => `/game/mhp3/catalog/items?target=${id}&item=${id}`
  return <aside className="equipment-picker-preview" aria-label="装备预览" aria-busy={loading}>
    {!selected && <p className="equipment-picker-preview__empty">从左侧选择装备查看详情。</p>}
    {error && <p className="equipment-picker-preview__error" role="alert">{error}<button type="button" className="equipment-picker-preview__retry" onClick={() => setAttempt(value => value + 1)}>重试</button></p>}
    {armorKey && !error && <ArmorDetailPanel armor={detail && 'armorKey' in detail ? detail : null} loading={loading}
      layout="embedded" allowCatalogWrite={false} onSelectItem={id => onOpenCatalog(itemPath(id))}
      onSelectSkill={id => onOpenCatalog(`/game/mhp3/catalog/skills?target=${id}&skill=${id}`)} />}
    {weaponKey && !error && <WeaponDetailPanel gameId="mhp3" weapon={detail && 'weaponKey' in detail ? detail : null} loading={loading}
      layout="embedded" sharpnessStage="base" allowCatalogWrite={false}
      onSelectCatalogItem={item => { if (item.gameId === 'mhp3') onOpenCatalog(itemPath(item.itemId)) }}
      onSelectWeapon={weapon => onOpenCatalog(`/game/mhp3/catalog/weapons?target=${encodeURIComponent(weapon.weaponKey)}&weapon=${encodeURIComponent(weapon.weaponKey)}`)} />}
  </aside>
}
