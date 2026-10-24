import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { ItemIdentity, HunterArtIdentity, QuestCatalogFacets, QuestCatalogFilters, QuestDetail, QuestDetailTab, QuestSummary } from '../../../api/catalog/types'
import { HunterArtDetailDrawer } from '../../components/HunterArtDetailDrawer/HunterArtDetailDrawer'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { ItemPagination } from '../../components/ItemPagination/ItemPagination'
import { MonsterDetailDrawer } from '../../components/MonsterDetailDrawer/MonsterDetailDrawer'
import { QuestCatalogToolbar } from '../../components/QuestCatalogToolbar/QuestCatalogToolbar'
import { QuestDetailDrawer } from '../../components/QuestDetailDrawer/QuestDetailDrawer'
import { QuestDetailPanel } from '../../components/QuestDetailPanel/QuestDetailPanel'
import { QuestList } from '../../components/QuestList/QuestList'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './QuestCatalogPage.css'

const tabs: QuestDetailTab[] = ['info', 'rewards', 'unlocks']
const emptyFacets: QuestCatalogFacets = { systems: [], levels: [], ranks: [], questTypes: [], locations: [], availabilities: [] }

export function QuestCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const target = params.get('target') ?? undefined
  const selected = params.get('quest') ?? target
  const page = positive(params.get('page')) ?? 1
  const tab = tabs.includes(params.get('tab') as QuestDetailTab) ? params.get('tab') as QuestDetailTab : 'info'
  const [queryInput, setQueryInput] = useState(query)
  const [facets, setFacets] = useState<QuestCatalogFacets>(emptyFacets)
  const [result, setResult] = useState({ items: [] as QuestSummary[], page: 1, pageSize: 100, total: 0, hasNext: false })
  const [detail, setDetail] = useState<QuestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()
  const [itemDrawer, setItemDrawer] = useState<ItemIdentity | null>(null)
  const [monsterDrawer, setMonsterDrawer] = useState<number | null>(null)
  const [questDrawer, setQuestDrawer] = useState<string | null>(null)
  const [artDrawer, setArtDrawer] = useState<HunterArtIdentity['hunterArtId'] | null>(null)
  const detailRequest = useRef(0)
  const filters: QuestCatalogFilters = {
    gameId: game.id,
    query,
    system: params.get('system') ?? undefined,
    levelId: numberParam(params.get('level')),
    rank: rankParam(params.get('rank')),
    questTypeId: numberParam(params.get('type')),
    locationId: numberParam(params.get('map')),
    keyStatus: keyParam(params.get('key')),
    availability: availabilityParam(params.get('availability')),
    includePlaceholders: params.get('debug') === '1',
    page,
    pageSize: 100,
  }

  const update = useCallback((changes: Record<string, string | number | undefined>) => {
    setParams(current => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value == null || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      return next
    })
  }, [setParams])

  // Selection and detail tabs must not restart list loading.
  const selectionRef = useRef({ selected, update })
  useLayoutEffect(() => { selectionRef.current = { selected, update } }, [selected, update])

  const closeDrawers = () => {
    setItemDrawer(null)
    setMonsterDrawer(null)
    setQuestDrawer(null)
    setArtDrawer(null)
  }

  const reset = useCallback(() => {
    setQueryInput('')
    closeDrawers()
    setParams({})
  }, [setParams])

  useEffect(() => setQueryInput(query), [query])
  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, target: undefined, quest: undefined, page: undefined }), 280)
    return () => window.clearTimeout(timer)
  }, [queryInput, query, update])

  useEffect(() => {
    let active = true
    void window.mhSaveEditor.catalog.getQuestFacets(game.id).then(value => {
      if (active) setFacets(value)
    }).catch(cause => { if (active) {setFacets(emptyFacets); setError(cause instanceof Error ? cause.message : '任务筛选读取失败')} })
    return () => { active = false }
  }, [game.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    void window.mhSaveEditor.catalog.searchQuests({ ...filters, targetQuestKey: target })
      .then(value => {
        if (!active) return
        setResult(value)
        const selection = selectionRef.current
        if (selection.selected == null && value.items[0]) selection.update({ quest: value.items[0].questKey })
        else if (selection.selected == null && value.items.length === 0) setDetail(null)
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : '任务列表读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [game.id, query, filters.system, filters.levelId, filters.rank, filters.questTypeId, filters.locationId, filters.keyStatus, filters.availability, filters.includePlaceholders, page, target])

  useEffect(() => {
    const request = ++detailRequest.current
    setDetail(null)
    setDetailError(undefined)
    if (!selected) { setDetailLoading(false); return }
    closeDrawers()
    setDetailLoading(true)
    setDetailError(undefined)
    void window.mhSaveEditor.catalog.getQuest({ gameId: game.id, questKey: selected })
      .then(value => {
        if (request === detailRequest.current) setDetail(value)
      })
      .catch(cause => {
        if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : '任务详情读取失败')
      })
      .finally(() => {
        if (request === detailRequest.current) setDetailLoading(false)
      })
    return () => { ++detailRequest.current }
  }, [game.id, selected])

  const changeFilter = (key: string, value: string | undefined) => update({ [key]: value, target: undefined, quest: undefined, page: undefined })
  return (
    <div className="quest-catalog-page">
      <QuestCatalogToolbar query={queryInput} filters={filters} facets={facets} showAvailability={game.id === 'mhgu'} onQueryChange={setQueryInput} onChange={changeFilter} onReset={reset} />
      <div className="quest-catalog-page__layout">
        <div className="quest-catalog-page__browser">
          <QuestList items={result.items} selectedKey={detail?.questKey ?? selected} loading={loading} error={error} onSelect={questKey => update({ quest: questKey, target: undefined })} />
          <ItemPagination page={result.page} pageSize={result.pageSize} total={result.total} hasNext={result.hasNext} ariaLabel="任务列表分页" onPageChange={value => update({ page: value })} />
        </div>
        <QuestDetailPanel
          quest={detail}
          loading={detailLoading}
          error={detailError}
          tab={tab}
          onTabChange={value => update({ tab: value })}
          onSelectItem={value => { closeDrawers(); setItemDrawer(value) }}
          onSelectMonster={value => { closeDrawers(); setMonsterDrawer(value) }}
          onSelectQuest={value => { closeDrawers(); setQuestDrawer(value) }}
          onSelectHunterArt={value => { closeDrawers(); setArtDrawer(value) }}
        />
      </div>
      <ItemDetailDrawer identity={itemDrawer} onClose={() => setItemDrawer(null)} />
      <MonsterDetailDrawer gameId={game.id} monsterId={monsterDrawer} onClose={() => setMonsterDrawer(null)} />
      <QuestDetailDrawer gameId={game.id} questKey={questDrawer} onClose={() => setQuestDrawer(null)} />
      {game.id === 'mhgu' && <HunterArtDetailDrawer gameId="mhgu" hunterArtId={artDrawer} onClose={() => setArtDrawer(null)} />}
    </div>
  )
}

function numberParam(value: string | null) {
  if (!value) return undefined
  const result = Number(value)
  return Number.isInteger(result) ? result : undefined
}

function positive(value: string | null) {
  const result = numberParam(value)
  return result && result > 0 ? result : undefined
}

function rankParam(value: string | null): QuestCatalogFilters['rank'] {
  return ['low', 'high', 'g', 'other'].includes(value ?? '') ? value as QuestCatalogFilters['rank'] : undefined
}

function keyParam(value: string | null): QuestCatalogFilters['keyStatus'] {
  return ['normal', 'key', 'urgent'].includes(value ?? '') ? value as QuestCatalogFilters['keyStatus'] : undefined
}

function availabilityParam(value: string | null): QuestCatalogFilters['availability'] {
  return ['common', 'mhgu', 'mhxx'].includes(value ?? '') ? value as QuestCatalogFilters['availability'] : undefined
}
