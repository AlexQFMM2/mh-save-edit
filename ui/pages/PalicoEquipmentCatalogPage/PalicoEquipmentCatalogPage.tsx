import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { PageResult, PalicoArmorDetail, PalicoArmorSummary, PalicoCatalogFacets, PalicoWeaponDetail, PalicoWeaponSummary } from '../../../api/catalog/types'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { PalicoCatalogToolbar, PalicoToolbarField } from '../../components/PalicoCatalogToolbar/PalicoCatalogToolbar'
import { PalicoEquipmentBrowser } from '../../components/PalicoEquipmentBrowser/PalicoEquipmentBrowser'
import { PalicoEquipmentDetailPanel } from '../../components/PalicoEquipmentDetailPanel/PalicoEquipmentDetailPanel'
import { SearchableSelect } from '../../components/SearchableSelect/SearchableSelect'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './PalicoEquipmentCatalogPage.css'

type Mode = 'weapon' | 'armor'

const emptyFacets: PalicoCatalogFacets = {
  typeOptions: [], gaugeCosts: [], memoryCosts: [], learnLevels: [], generationGroups: [], unlockKinds: [],
  rarities: [], specializations: [], specialAttacks: [], sharpnessIds: [],
}
const emptyPage = { items: [], page: 1, pageSize: 100, total: 0, hasNext: false }
const sharpnessNames: Record<number, string> = { 2: '橙', 3: '黄', 4: '绿', 5: '蓝', 6: '白', 7: '紫' }

export function PalicoEquipmentCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const mode = modeParam(params.get('view'))
  const query = params.get('q') ?? ''
  const [queryInput, setQueryInput] = useState(query)
  const selected = numberParam(params.get('equipment'))
  const target = numberParam(params.get('target'))
  const page = numberParam(params.get('page')) ?? 1
  const itemDrawer = numberParam(params.get('material'))
  const attackType = attackParam(params.get('attack'))
  const specializationId = numberParam(params.get('specialization'))
  const rarity = numberParam(params.get('rarity'))
  const specialAttackId = specialAttackParam(params.get('special'))
  const sharpnessId = numberParam(params.get('sharpness'))
  const part = partParam(params.get('part'))
  const direction = directionParam(params.get('direction'))
  const [facets, setFacets] = useState(emptyFacets)
  const [weapons, setWeapons] = useState<PageResult<PalicoWeaponSummary>>(emptyPage)
  const [armors, setArmors] = useState<PageResult<PalicoArmorSummary>>(emptyPage)
  const [detail, setDetail] = useState<PalicoWeaponDetail | PalicoArmorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const detailRequest = useRef(0)
  const setParamsRef = useRef(setParams)
  setParamsRef.current = setParams

  const update = useCallback((changes: Record<string, string | number | undefined>) => {
    setParamsRef.current((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value == null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      return next
    })
  }, [])

  const resetSelection = (changes: Record<string, string | number | undefined>) => {
    update({ ...changes, equipment: undefined, set: undefined, target: undefined, page: undefined })
  }

  useEffect(() => setQueryInput(query), [query])
  useEffect(() => {
    if (params.get('view') === 'set' || params.has('set')) update({ view: undefined, set: undefined })
  }, [params, update])
  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => resetSelection({ q: queryInput || undefined }), 280)
    return () => window.clearTimeout(timer)
    // resetSelection is intentionally derived from the stable update callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput, query, update])

  useEffect(() => {
    if (game.id !== 'mhgu') return
    let active = true
    void window.mhSaveEditor.catalog.getPalicoCatalogFacets().then((value) => {
      if (active) setFacets(value)
    })
    return () => { active = false }
  }, [game.id])

  useEffect(() => {
    if (game.id !== 'mhgu') return
    let active = true
    setLoading(true)
    setError(undefined)
    const request = mode === 'weapon'
      ? window.mhSaveEditor.catalog.searchPalicoWeapons({
          gameId: 'mhgu', targetEquipmentId: target, query, attackType, specializationId, rarity,
          specialAttackId, sharpnessId, sort: weaponSort(params.get('sort')), direction, page, pageSize: 100,
        })
      : window.mhSaveEditor.catalog.searchPalicoArmors({
          gameId: 'mhgu', targetEquipmentId: target, query, part, rarity,
          sort: armorSort(params.get('sort')), direction, page, pageSize: 100,
        })
    void request
      .then((result) => {
        if (!active) return
        if (mode === 'weapon') {
          const value = result as PageResult<PalicoWeaponSummary>
          setWeapons(value)
          if (selected == null && value.items[0]) update({ equipment: value.items[0].equipmentId })
          if (!value.items.length) setDetail(null)
        } else {
          const value = result as PageResult<PalicoArmorSummary>
          setArmors(value)
          if (selected == null && value.items[0]) update({ equipment: value.items[0].equipmentId })
          if (!value.items.length) setDetail(null)
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '猫装备列表读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
    // Selected rows only update the detail pane and must not collapse or rerun the list query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, mode, target, query, attackType, specializationId, rarity, specialAttackId, sharpnessId, part, direction, page, params.get('sort'), update])

  useEffect(() => {
    if (game.id !== 'mhgu' || selected == null) return
    const request = ++detailRequest.current
    setDetailLoading(true)
    const kind = mode === 'weapon' ? 'weapon' : 'armor'
    const call = kind === 'weapon'
      ? window.mhSaveEditor.catalog.getPalicoWeapon({ gameId: 'mhgu', kind, equipmentId: selected })
      : window.mhSaveEditor.catalog.getPalicoArmor({ gameId: 'mhgu', kind, equipmentId: selected })
    void call
      .then((value) => {
        if (request === detailRequest.current) setDetail(value)
      })
      .catch((cause) => {
        if (request === detailRequest.current) setError(cause instanceof Error ? cause.message : '猫装备详情读取失败')
      })
      .finally(() => {
        if (request === detailRequest.current) setDetailLoading(false)
      })
  }, [game.id, mode, selected])

  if (game.id !== 'mhgu') return <Navigate to={`/game/${game.id}/overview`} replace />

  const total = mode === 'weapon' ? weapons.total : armors.total
  const hasNext = mode === 'weapon' ? weapons.hasNext : armors.hasNext
  const sort = params.get('sort') ?? 'source'

  return (
    <div className="palico-equipment-catalog-page">
      <div className="palico-equipment-catalog-page__modes" role="tablist" aria-label="猫装备浏览模式" onKeyDown={handleModeKeys}>
        {([['weapon', '武器'], ['armor', '防具']] as const).map(([value, label]) => (
          <button className="palico-equipment-catalog-page__mode" type="button" role="tab" aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} key={value} onClick={() => resetSelection({ view: value === 'weapon' ? undefined : value, q: undefined, sort: undefined, direction: undefined, attack: undefined, specialization: undefined, rarity: undefined, special: undefined, sharpness: undefined, part: undefined })}>{label}</button>
        ))}
      </div>
      <PalicoCatalogToolbar query={queryInput} onQueryChange={setQueryInput} onReset={() => { setQueryInput(''); setParams(mode === 'weapon' ? {} : { view: mode }) }}>
        {mode === 'weapon' && (
          <>
            <PalicoToolbarField label="攻击"><SearchableSelect ariaLabel="筛选攻击类型" value={attackType ?? ''} options={[{ value: '', label: '全部' }, { value: 'cut', label: '斩击' }, { value: 'blunt', label: '打击' }]} onChange={(value) => resetSelection({ attack: value || undefined })} /></PalicoToolbarField>
            <PalicoToolbarField label="特化"><SearchableSelect ariaLabel="筛选武器特化" value={String(specializationId ?? '')} options={[{ value: '', label: '全部' }, ...facets.specializations.map((value) => ({ value: String(value.id), label: value.nameCn, keywords: [value.nameEn] }))]} onChange={(value) => resetSelection({ specialization: value || undefined })} /></PalicoToolbarField>
            <PalicoToolbarField label="属性"><SearchableSelect ariaLabel="筛选属性或异常" value={String(specialAttackId ?? '')} options={[{ value: '', label: '全部' }, { value: 'none', label: '无属性' }, ...facets.specialAttacks.map((value) => ({ value: String(value.id), label: value.nameCn, keywords: [value.nameEn] }))]} onChange={(value) => resetSelection({ special: value || undefined })} /></PalicoToolbarField>
            <PalicoToolbarField label="斩味"><SearchableSelect ariaLabel="筛选斩味" value={String(sharpnessId ?? '')} options={[{ value: '', label: '全部' }, ...facets.sharpnessIds.map((value) => ({ value: String(value), label: sharpnessNames[value] ?? String(value) }))]} onChange={(value) => resetSelection({ sharpness: value || undefined })} /></PalicoToolbarField>
          </>
        )}
        {mode === 'armor' && <PalicoToolbarField label="部位"><SearchableSelect ariaLabel="筛选猫防具部位" value={part ?? ''} options={[{ value: '', label: '全部' }, { value: 'head', label: '头部' }, { value: 'body', label: '身体' }]} onChange={(value) => resetSelection({ part: value || undefined })} /></PalicoToolbarField>}
        <PalicoToolbarField label="稀有度"><SearchableSelect ariaLabel="筛选猫装备稀有度" value={String(rarity ?? '')} options={[{ value: '', label: '全部' }, ...facets.rarities.map((value) => ({ value: String(value), label: `稀有度 ${value}` }))]} onChange={(value) => resetSelection({ rarity: value || undefined })} /></PalicoToolbarField>
        <PalicoToolbarField label="排序"><SearchableSelect ariaLabel="猫装备排序" value={sort} options={mode === 'weapon' ? weaponSortOptions : armorSortOptions} onChange={(value) => update({ sort: value === 'source' ? undefined : value, page: undefined })} /></PalicoToolbarField>
        <PalicoToolbarField label="方向"><SearchableSelect ariaLabel="排序方向" value={direction} options={[{ value: 'asc', label: '升序' }, { value: 'desc', label: '降序' }]} onChange={(value) => update({ direction: value === 'asc' ? undefined : value, page: undefined })} /></PalicoToolbarField>
      </PalicoCatalogToolbar>
      <div className="palico-equipment-catalog-page__layout">
        <div className="palico-equipment-catalog-page__browser">
          {mode === 'weapon'
            ? <PalicoEquipmentBrowser mode="weapon" items={weapons.items} selectedId={selected} loading={loading} onSelect={(id) => update({ equipment: id, target: undefined })} />
            : <PalicoEquipmentBrowser mode="armor" items={armors.items} selectedId={selected} loading={loading} onSelect={(id) => update({ equipment: id, target: undefined })} />}
          <footer className="palico-equipment-catalog-page__pagination">
            <span>共 {total} 条</span>
            <button className="palico-equipment-catalog-page__page-button" type="button" disabled={page <= 1} onClick={() => update({ page: page - 1, equipment: undefined })}>上一页</button>
            <span>第 {page} 页</span>
            <button className="palico-equipment-catalog-page__page-button" type="button" disabled={!hasNext} onClick={() => update({ page: page + 1, equipment: undefined })}>下一页</button>
          </footer>
        </div>
        <PalicoEquipmentDetailPanel detail={detail} loading={detailLoading} error={error} onSelectItem={(id) => update({ material: id })} />
      </div>
      <ItemDetailDrawer gameId="mhgu" itemSaveId={itemDrawer ?? null} onClose={() => update({ material: undefined })} />
    </div>
  )
}

const weaponSortOptions = [
  { value: 'source', label: '资料顺序' }, { value: 'meleeAttack', label: '近战攻击' },
  { value: 'rangedAttack', label: '远程攻击' }, { value: 'affinity', label: '会心' },
  { value: 'sharpness', label: '斩味' }, { value: 'defense', label: '防御' },
]
const armorSortOptions = [
  { value: 'source', label: '资料顺序' }, { value: 'defense', label: '防御' },
  { value: 'fireRes', label: '火耐性' }, { value: 'waterRes', label: '水耐性' },
  { value: 'thunderRes', label: '雷耐性' }, { value: 'iceRes', label: '冰耐性' },
  { value: 'dragonRes', label: '龙耐性' },
]

function handleModeKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  tabs[next]?.focus()
  tabs[next]?.click()
}

function numberParam(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}
const modeParam = (value: string | null): Mode => value === 'armor' ? 'armor' : 'weapon'
const attackParam = (value: string | null) => value === 'cut' || value === 'blunt' ? value : undefined
const partParam = (value: string | null) => value === 'head' || value === 'body' ? value : undefined
const directionParam = (value: string | null) => value === 'desc' ? 'desc' : 'asc'
const specialAttackParam = (value: string | null) => value === 'none' ? 'none' : numberParam(value)
const weaponSort = (value: string | null) => ['source', 'meleeAttack', 'rangedAttack', 'affinity', 'sharpness', 'defense'].includes(value ?? '') ? value as 'source' | 'meleeAttack' | 'rangedAttack' | 'affinity' | 'sharpness' | 'defense' : 'source'
const armorSort = (value: string | null) => ['source', 'defense', 'fireRes', 'waterRes', 'thunderRes', 'iceRes', 'dragonRes'].includes(value ?? '') ? value as 'source' | 'defense' | 'fireRes' | 'waterRes' | 'thunderRes' | 'iceRes' | 'dragonRes' : 'source'
