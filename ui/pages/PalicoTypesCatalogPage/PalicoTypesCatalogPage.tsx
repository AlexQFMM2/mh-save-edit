import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { PalicoTypeDetail, PalicoTypeSummary } from '../../../api/catalog/types'
import { PalicoEntryList } from '../../components/PalicoEntryList/PalicoEntryList'
import { PalicoCatalogToolbar } from '../../components/PalicoCatalogToolbar/PalicoCatalogToolbar'
import { PalicoSupportMoveDetailDrawer } from '../../components/PalicoSupportMoveDetailDrawer/PalicoSupportMoveDetailDrawer'
import { PalicoTypeDetailPanel } from '../../components/PalicoTypeDetailPanel/PalicoTypeDetailPanel'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './PalicoTypesCatalogPage.css'

export function PalicoTypesCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [queryInput, setQueryInput] = useState(query)
  const selected = numberParam(params.get('type'))
  const move = numberParam(params.get('move'))
  const [items, setItems] = useState<PalicoTypeSummary[]>([])
  const [detail, setDetail] = useState<PalicoTypeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const request = useRef(0)
  const setParamsRef = useRef(setParams)
  setParamsRef.current = setParams

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return items
    return items.filter(item => `${item.typeId} 0x${item.typeId.toString(16)} ${item.nameCn} ${item.nameEn} ${item.nameJp} ${item.descriptionCn}`.toLocaleLowerCase().includes(needle))
  }, [items, query])

  const update = useCallback((changes: Record<string, string | number | undefined>) => {
    setParamsRef.current((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value == null) next.delete(key)
        else next.set(key, String(value))
      }
      return next
    })
  }, [])

  useEffect(() => {
    setQueryInput(query)
  }, [query])

  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, type: undefined, move: undefined }), 240)
    return () => window.clearTimeout(timer)
  }, [queryInput, query, update])

  useEffect(() => {
    if (game.id !== 'mhgu') return
    let active = true
    setLoading(true)
    setError(undefined)
    void window.mhSaveEditor.catalog.searchPalicoTypes()
      .then((rows) => {
        if (!active) return
        setItems(rows)
        if (selected == null && rows[0]) update({ type: rows[0].typeId })
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '支援倾向读取失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
    // A selected row only changes the detail request; the eight-row index is static.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, update])

  useEffect(() => {
    if (!filteredItems.length) {
      if (selected != null) update({ type: undefined, move: undefined })
      return
    }
    if (!filteredItems.some(item => item.typeId === selected)) update({ type: filteredItems[0].typeId, move: undefined })
  }, [filteredItems, selected, update])

  useEffect(() => {
    if (game.id !== 'mhgu' || selected == null) return
    const id = ++request.current
    setDetailLoading(true)
    void window.mhSaveEditor.catalog.getPalicoType({ gameId: 'mhgu', typeId: selected })
      .then((value) => {
        if (id === request.current) setDetail(value)
      })
      .catch((cause) => {
        if (id === request.current) setError(cause instanceof Error ? cause.message : '支援倾向详情读取失败')
      })
      .finally(() => {
        if (id === request.current) setDetailLoading(false)
      })
  }, [game.id, selected])

  if (game.id !== 'mhgu') return <Navigate to={`/game/${game.id}/overview`} replace />

  return (
    <div className="palico-types-catalog-page">
      <PalicoCatalogToolbar query={queryInput} onQueryChange={setQueryInput} onReset={() => { setQueryInput(''); setParams({}) }} placeholder="名称、英文名、日文名或 ID" />
      <div className="palico-types-catalog-page__layout">
        <div className="palico-types-catalog-page__list-slot">
          <PalicoEntryList
            entries={filteredItems.map((item) => ({ id: item.typeId, nameCn: item.nameCn, nameEn: item.nameEn }))}
            selectedId={selected}
            loading={loading}
            error={error}
            label="支援倾向"
            onSelect={(id) => update({ type: id })}
          />
        </div>
        <PalicoTypeDetailPanel
          detail={detail}
          loading={detailLoading}
          error={error}
          onSelectMove={(id) => update({ move: id })}
        />
      </div>
      <PalicoSupportMoveDetailDrawer supportMoveId={move ?? null} onClose={() => update({ move: undefined })} />
    </div>
  )
}

function numberParam(value: string | null) {
  const parsed = Number(value)
  return value != null && Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}
