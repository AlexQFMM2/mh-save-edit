import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { PalicoCatalogFacets, PalicoSupportMoveDetail, PalicoSupportMoveFilters, PalicoSupportMoveSummary } from '../../../api/catalog/types'
import { MonsterDetailDrawer } from '../../components/MonsterDetailDrawer/MonsterDetailDrawer'
import { PalicoAbilityDetailPanel } from '../../components/PalicoAbilityDetailPanel/PalicoAbilityDetailPanel'
import { PalicoCatalogToolbar, PalicoToolbarField } from '../../components/PalicoCatalogToolbar/PalicoCatalogToolbar'
import { PalicoEntryList } from '../../components/PalicoEntryList/PalicoEntryList'
import { SearchableSelect } from '../../components/SearchableSelect/SearchableSelect'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { palicoGenerationLabel, type PalicoGenerationFilter } from '../../utils/palicoLabels'
import './PalicoSupportMovesCatalogPage.css'

const emptyFacets: PalicoCatalogFacets = {
  typeOptions: [], gaugeCosts: [], memoryCosts: [], learnLevels: [], generationGroups: [], unlockKinds: [],
  rarities: [], specializations: [], specialAttacks: [], sharpnessIds: [],
}

export function PalicoSupportMovesCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [queryInput, setQueryInput] = useState(query)
  const selected = numberParam(params.get('move'))
  const target = numberParam(params.get('target'))
  const monster = numberParam(params.get('monster'))
  const typeId = numberParam(params.get('type'))
  const gaugeCost = numberParam(params.get('cost'))
  const generationGroup = groupParam(params.get('group'))
  const [items, setItems] = useState<PalicoSupportMoveSummary[]>([])
  const [detail, setDetail] = useState<PalicoSupportMoveDetail | null>(null)
  const [facets, setFacets] = useState(emptyFacets)
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

  useEffect(() => setQueryInput(query), [query])
  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, move: undefined, target: undefined }), 280)
    return () => window.clearTimeout(timer)
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
    const filters: PalicoSupportMoveFilters = {
      gameId: 'mhgu', targetSupportMoveId: target, query, typeId, gaugeCost, generationGroup,
    }
    setLoading(true)
    setError(undefined)
    void window.mhSaveEditor.catalog.searchPalicoSupportMoves(filters)
      .then((rows) => {
        if (!active) return
        setItems(rows)
        if (selected == null && rows[0]) update({ move: rows[0].supportMoveId })
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '支援行动读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
    // Selecting a row must not rerun the list query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, query, typeId, gaugeCost, generationGroup, target, update])

  useEffect(() => {
    if (game.id !== 'mhgu' || selected == null) return
    const request = ++detailRequest.current
    setDetailLoading(true)
    void window.mhSaveEditor.catalog.getPalicoSupportMove({ gameId: 'mhgu', supportMoveId: selected })
      .then((value) => {
        if (request === detailRequest.current) setDetail(value)
      })
      .catch((cause) => {
        if (request === detailRequest.current) setError(cause instanceof Error ? cause.message : '支援行动详情读取失败')
      })
      .finally(() => {
        if (request === detailRequest.current) setDetailLoading(false)
      })
  }, [game.id, selected])

  if (game.id !== 'mhgu') return <Navigate to={`/game/${game.id}/overview`} replace />

  return (
    <div className="palico-support-moves-catalog-page">
      <PalicoCatalogToolbar query={queryInput} onQueryChange={setQueryInput} onReset={() => { setQueryInput(''); setParams({}) }}>
        <PalicoToolbarField label="倾向">
          <SearchableSelect ariaLabel="筛选支援倾向" value={String(typeId ?? '')} options={[{ value: '', label: '全部倾向' }, ...facets.typeOptions.map((value) => ({ value: String(value.typeId), label: value.nameCn, keywords: [value.nameEn] }))]} onChange={(value) => update({ type: value || undefined, move: undefined, target: undefined })} />
        </PalicoToolbarField>
        <PalicoToolbarField label="分组">
          <SearchableSelect ariaLabel="筛选行动分组" value={generationGroup ?? ''} options={[{ value: '', label: '全部分组' }, ...facets.generationGroups.map((value) => ({ value, label: `${value} 组（随机池）` })), { value: 'fixed', label: '不参与随机分组', keywords: ['固定', '特殊', '固有'] }]} onChange={(value) => update({ group: value || undefined, move: undefined, target: undefined })} />
        </PalicoToolbarField>
        {facets.gaugeCosts.length > 0 && (
          <PalicoToolbarField label="消耗">
            <SearchableSelect ariaLabel="筛选支援槽消耗" value={String(gaugeCost ?? '')} options={[{ value: '', label: '全部消耗' }, ...facets.gaugeCosts.map((value) => ({ value: String(value), label: `${value} 槽` }))]} onChange={(value) => update({ cost: value || undefined, move: undefined, target: undefined })} />
          </PalicoToolbarField>
        )}
      </PalicoCatalogToolbar>
      <div className="palico-support-moves-catalog-page__layout">
        <div className="palico-support-moves-catalog-page__list-slot">
          <PalicoEntryList entries={items.map((item) => ({ id: item.supportMoveId, nameCn: item.nameCn, nameEn: item.nameEn, meta: palicoGenerationLabel(item.generationGroup, true) }))} selectedId={selected} loading={loading} error={error} label="支援行动" onSelect={(id) => update({ move: id, target: undefined })} />
        </div>
        <PalicoAbilityDetailPanel kind="move" detail={detail} loading={detailLoading} error={error} onSelectMonster={(id) => update({ monster: id })} />
      </div>
      <MonsterDetailDrawer gameId="mhgu" monsterId={monster ?? null} onClose={() => update({ monster: undefined })} />
    </div>
  )
}

function numberParam(value: string | null) {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function groupParam(value: string | null): PalicoGenerationFilter | undefined {
  return value === 'A' || value === 'B' || value === 'C' || value === 'fixed' ? value : undefined
}
