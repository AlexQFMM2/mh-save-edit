import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { PalicoCatalogFacets, PalicoSkillDetail, PalicoSkillFilters, PalicoSkillSummary, PalicoUnlockKind } from '../../../api/catalog/types'
import { MonsterDetailDrawer } from '../../components/MonsterDetailDrawer/MonsterDetailDrawer'
import { PalicoAbilityDetailPanel } from '../../components/PalicoAbilityDetailPanel/PalicoAbilityDetailPanel'
import { PalicoCatalogToolbar, PalicoToolbarField } from '../../components/PalicoCatalogToolbar/PalicoCatalogToolbar'
import { PalicoEntryList } from '../../components/PalicoEntryList/PalicoEntryList'
import { SearchableSelect } from '../../components/SearchableSelect/SearchableSelect'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { palicoGenerationLabel, palicoUnlockKindLabels, type PalicoGenerationFilter } from '../../utils/palicoLabels'
import './PalicoSkillsCatalogPage.css'

const emptyFacets: PalicoCatalogFacets = {
  typeOptions: [], gaugeCosts: [], memoryCosts: [], learnLevels: [], generationGroups: [], unlockKinds: [],
  rarities: [], specializations: [], specialAttacks: [], sharpnessIds: [],
}

export function PalicoSkillsCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [queryInput, setQueryInput] = useState(query)
  const selected = numberParam(params.get('skill'))
  const target = numberParam(params.get('target'))
  const monster = numberParam(params.get('monster'))
  const memoryCost = numberParam(params.get('memory'))
  const generationGroup = groupParam(params.get('group'))
  const learnLevel = numberParam(params.get('level'))
  const unlockKind = unlockParam(params.get('unlock'))
  const [items, setItems] = useState<PalicoSkillSummary[]>([])
  const [detail, setDetail] = useState<PalicoSkillDetail | null>(null)
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
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, skill: undefined, target: undefined }), 280)
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
    const filters: PalicoSkillFilters = {
      gameId: 'mhgu', targetPalicoSkillId: target, query, memoryCost, generationGroup, learnLevel, unlockKind,
    }
    setLoading(true)
    setError(undefined)
    void window.mhSaveEditor.catalog.searchPalicoSkills(filters)
      .then((rows) => {
        if (!active) return
        setItems(rows)
        if (selected == null && rows[0]) update({ skill: rows[0].palicoSkillId })
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '随从技能读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
    // Selecting a row must not rerun the list query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, query, memoryCost, generationGroup, learnLevel, unlockKind, target, update])

  useEffect(() => {
    if (game.id !== 'mhgu' || selected == null) return
    const request = ++detailRequest.current
    setDetailLoading(true)
    void window.mhSaveEditor.catalog.getPalicoSkill({ gameId: 'mhgu', palicoSkillId: selected })
      .then((value) => {
        if (request === detailRequest.current) setDetail(value)
      })
      .catch((cause) => {
        if (request === detailRequest.current) setError(cause instanceof Error ? cause.message : '随从技能详情读取失败')
      })
      .finally(() => {
        if (request === detailRequest.current) setDetailLoading(false)
      })
  }, [game.id, selected])

  if (game.id !== 'mhgu') return <Navigate to={`/game/${game.id}/overview`} replace />

  return (
    <div className="palico-skills-catalog-page">
      <PalicoCatalogToolbar query={queryInput} onQueryChange={setQueryInput} onReset={() => { setQueryInput(''); setParams({}) }}>
        <PalicoToolbarField label="分组">
          <SearchableSelect ariaLabel="筛选随从技能分组" value={generationGroup ?? ''} options={[{ value: '', label: '全部分组' }, ...facets.generationGroups.map((value) => ({ value, label: `${value} 组（随机池）` })), { value: 'fixed', label: '不参与随机分组', keywords: ['固定', '特殊', '固有'] }]} onChange={(value) => update({ group: value || undefined, skill: undefined, target: undefined })} />
        </PalicoToolbarField>
        {facets.memoryCosts.length > 0 && (
          <PalicoToolbarField label="记忆槽">
            <SearchableSelect ariaLabel="筛选记忆槽" value={String(memoryCost ?? '')} options={[{ value: '', label: '全部' }, ...facets.memoryCosts.map((value) => ({ value: String(value), label: `${value} 槽` }))]} onChange={(value) => update({ memory: value || undefined, skill: undefined, target: undefined })} />
          </PalicoToolbarField>
        )}
        {facets.learnLevels.length > 0 && (
          <PalicoToolbarField label="等级">
            <SearchableSelect ariaLabel="筛选学习等级" value={String(learnLevel ?? '')} options={[{ value: '', label: '全部等级' }, ...facets.learnLevels.map((value) => ({ value: String(value), label: `Lv ${value}` }))]} onChange={(value) => update({ level: value || undefined, skill: undefined, target: undefined })} />
          </PalicoToolbarField>
        )}
        {facets.unlockKinds.length > 0 && (
          <PalicoToolbarField label="解锁">
            <SearchableSelect ariaLabel="筛选解锁方式" value={unlockKind ?? ''} options={[{ value: '', label: '全部方式' }, ...facets.unlockKinds.map((value) => ({ value, label: palicoUnlockKindLabels[value] }))]} onChange={(value) => update({ unlock: value || undefined, skill: undefined, target: undefined })} />
          </PalicoToolbarField>
        )}
      </PalicoCatalogToolbar>
      <div className="palico-skills-catalog-page__layout">
        <div className="palico-skills-catalog-page__list-slot">
          <PalicoEntryList entries={items.map((item) => ({ id: item.palicoSkillId, nameCn: item.nameCn, nameEn: item.nameEn, meta: palicoGenerationLabel(item.generationGroup, true) }))} selectedId={selected} loading={loading} error={error} label="随从技能" onSelect={(id) => update({ skill: id, target: undefined })} />
        </div>
        <PalicoAbilityDetailPanel kind="skill" detail={detail} loading={detailLoading} error={error} onSelectMonster={(id) => update({ monster: id })} />
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

function unlockParam(value: string | null): PalicoUnlockKind | undefined {
  return value === 'initial' || value === 'innate' || value === 'monster' || value === 'level' || value === 'distribution' ? value : undefined
}
