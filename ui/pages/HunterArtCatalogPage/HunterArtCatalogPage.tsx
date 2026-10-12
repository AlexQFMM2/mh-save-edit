import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtDetail, HunterArtSummary, HunterArtUnlockKind } from '../../../api/catalog/types'
import { HunterArtCatalogToolbar } from '../../components/HunterArtCatalogToolbar/HunterArtCatalogToolbar'
import { HunterArtDetailPanel } from '../../components/HunterArtDetailPanel/HunterArtDetailPanel'
import { HunterArtList } from '../../components/HunterArtList/HunterArtList'
import { MonsterDetailDrawer } from '../../components/MonsterDetailDrawer/MonsterDetailDrawer'
import { QuestDetailDrawer } from '../../components/QuestDetailDrawer/QuestDetailDrawer'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './HunterArtCatalogPage.css'

const emptyFacets: HunterArtCatalogFacets = { weaponTypes: [], levels: [], unlockKinds: [] }

export function HunterArtCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const target = numberParam(params.get('target'))
  const selected = numberParam(params.get('art')) ?? target
  const [queryInput, setQueryInput] = useState(query)
  const [facets, setFacets] = useState<HunterArtCatalogFacets>(emptyFacets)
  const [items, setItems] = useState<HunterArtSummary[]>([])
  const [detail, setDetail] = useState<HunterArtDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()
  const [questDrawer, setQuestDrawer] = useState<string | null>(null)
  const [monsterDrawer, setMonsterDrawer] = useState<number | null>(null)
  const detailRequest = useRef(0)
  const filters: HunterArtCatalogFilters = {
    gameId: game.id,
    query,
    weaponTypeId: numberParam(params.get('weapon')),
    level: levelParam(params.get('level')),
    unlockKind: unlockParam(params.get('unlock')),
    includePlaceholders: params.get('debug') === '1',
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

  const selectionRef = useRef({ selected, update })
  useLayoutEffect(() => { selectionRef.current = { selected, update } }, [selected, update])

  const reset = useCallback(() => {
    setQueryInput('')
    setQuestDrawer(null)
    setMonsterDrawer(null)
    setParams({})
  }, [setParams])

  useEffect(() => setQueryInput(query), [query])
  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, target: undefined, art: undefined }), 280)
    return () => window.clearTimeout(timer)
  }, [queryInput, query, update])

  useEffect(() => {
    if (game.id !== 'mhgu') return
    let active = true
    void window.mhSaveEditor.catalog.getHunterArtFacets(game.id).then(value => {
      if (active) setFacets(value)
    })
    return () => { active = false }
  }, [game.id])

  useEffect(() => {
    if (game.id !== 'mhgu') return
    let active = true
    setLoading(true)
    setError(undefined)
    void window.mhSaveEditor.catalog.searchHunterArts({ ...filters, targetHunterArtId: target })
      .then(rows => {
        if (!active) return
        setItems(rows)
        const selection = selectionRef.current
        if (selection.selected == null && rows[0]) selection.update({ art: rows[0].hunterArtId })
        else if (selection.selected == null && rows.length === 0) setDetail(null)
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : '狩技列表读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [game.id, query, filters.weaponTypeId, filters.level, filters.unlockKind, filters.includePlaceholders, target])

  useEffect(() => {
    if (game.id !== 'mhgu' || selected == null) {
      return
    }
    const request = ++detailRequest.current
    setDetailLoading(true)
    setDetailError(undefined)
    void window.mhSaveEditor.catalog.getHunterArt({ gameId: 'mhgu', hunterArtId: selected })
      .then(value => {
        if (request === detailRequest.current) setDetail(value)
      })
      .catch(cause => {
        if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : '狩技详情读取失败')
      })
      .finally(() => {
        if (request === detailRequest.current) setDetailLoading(false)
      })
  }, [game.id, selected])

  if (game.id !== 'mhgu') return <Navigate to={`/game/${game.id}/overview`} replace />

  const closeDrawers = () => {
    setQuestDrawer(null)
    setMonsterDrawer(null)
  }

  return (
    <div className="hunter-art-catalog-page">
      <HunterArtCatalogToolbar
        query={queryInput}
        filters={filters}
        facets={facets}
        onQueryChange={setQueryInput}
        onChange={(key, value) => update({ [key]: value, target: undefined, art: undefined })}
        onReset={reset}
      />
      <div className="hunter-art-catalog-page__layout">
        <HunterArtList items={items} selectedId={selected} loading={loading} error={error} onSelect={id => update({ art: id, target: undefined })} />
        <HunterArtDetailPanel
          art={detail}
          loading={detailLoading}
          error={detailError}
          onSelectQuest={key => { closeDrawers(); setQuestDrawer(key) }}
          onSelectMonster={id => { closeDrawers(); setMonsterDrawer(id) }}
        />
      </div>
      <QuestDetailDrawer gameId="mhgu" questKey={questDrawer} onClose={() => setQuestDrawer(null)} />
      <MonsterDetailDrawer gameId="mhgu" monsterId={monsterDrawer} onClose={() => setMonsterDrawer(null)} />
    </div>
  )
}

function numberParam(value: string | null) {
  if (!value) return undefined
  const result = Number(value)
  return Number.isInteger(result) && result >= 0 ? result : undefined
}

function levelParam(value: string | null): HunterArtCatalogFilters['level'] {
  return value === 'none' ? 'none' : numberParam(value)
}

function unlockParam(value: string | null): HunterArtUnlockKind | undefined {
  return ['initial', 'quest', 'hunterRank', 'contribution', 'palicoLevel', 'monster', 'npc', 'compound', 'other'].includes(value ?? '') ? value as HunterArtUnlockKind : undefined
}
