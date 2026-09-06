import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { ItemDetail, ItemSummary } from '../../../api/catalog/types'
import { ItemCatalogToolbar } from '../../components/ItemCatalogToolbar/ItemCatalogToolbar'
import { ItemDetailPanel } from '../../components/ItemDetailPanel/ItemDetailPanel'
import { ItemFilterBar } from '../../components/ItemFilterBar/ItemFilterBar'
import { ItemList } from '../../components/ItemList/ItemList'
import { ItemPagination } from '../../components/ItemPagination/ItemPagination'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './ItemCatalogPage.css'

type Sort = 'saveId' | 'name' | 'rarity'
const parseNumber = (value: string | null) => value == null || value === '' ? undefined : Number(value)

export function ItemCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [, setParams] = useSearchParams()
  const [params] = useSearchParams()
  const [queryInput, setQueryInput] = useState(params.get('q') ?? '')
  const query = params.get('q') ?? ''
  const sort = (params.get('sort') as Sort | null) ?? 'saveId'
  const rarity = parseNumber(params.get('rarity'))
  const maxStack = parseNumber(params.get('stack'))
  const source = params.get('source') ?? undefined
  const usage = params.get('usage') ?? undefined
  const includePlaceholders = params.get('debug') === '1'
  const page = parseNumber(params.get('page')) ?? 1
  const selectedId = parseNumber(params.get('item'))
  const [items, setItems] = useState<ItemSummary[]>([])
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  const [facets, setFacets] = useState<{ rarities: number[]; maxStacks: number[]; relations: { sourceKind: string; usageKind: string | null }[] }>({ rarities: [], maxStacks: [], relations: [] })
  const [resultMeta, setResultMeta] = useState({ total: 0, pageSize: 100, hasNext: false })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) { if (value == null || value === '') next.delete(key); else next.set(key, String(value)) }
    setParams(next)
  }
  useEffect(() => { const timer = window.setTimeout(() => updateParams({ q: queryInput || undefined, page: undefined, item: undefined }), 280); return () => window.clearTimeout(timer) }, [queryInput])
  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError(undefined)
      try {
        const api = window.mhSaveEditor?.catalog
        if (!api) throw new Error('图鉴 API 尚未连接，请在 Electron 应用中打开。')
        const result = await api.searchItems({ gameId: game.id, query, rarity, maxStack, sourceKinds: source ? [source as never] : undefined, usageKinds: usage ? [usage as never] : undefined, includePlaceholders, sort, page, pageSize: 100 })
        if (!active) return
        setItems(result.items)
        setResultMeta({ total: result.total, pageSize: result.pageSize, hasNext: result.hasNext })
        if (selectedId == null && result.items[0]) updateParams({ item: result.items[0].saveId })
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : '道具查询失败') } finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [game.id, query, rarity, maxStack, source, usage, includePlaceholders, sort, page])
  useEffect(() => {
    let active = true
    const api = window.mhSaveEditor?.catalog
    if (!api) return () => { active = false }
    void api.getItemFacets(game.id).then((result) => { if (active) setFacets(result) }).catch(() => undefined)
    return () => { active = false }
  }, [game.id])
  useEffect(() => {
    if (selectedId == null) { setDetail(null); return }
    let active = true
    setDetailLoading(true); setDetailError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setDetailLoading(false); return () => { active = false } }
    void api.getItem({ gameId: game.id, saveId: selectedId }).then((result) => { if (active) setDetail(result) }).catch((cause) => { if (active) setDetailError(cause instanceof Error ? cause.message : '详情读取失败') }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [game.id, selectedId])

  const selectedVisible = useMemo(() => items.some((item) => item.saveId === selectedId), [items, selectedId])
  const availableSources = useMemo(() => [...new Set(facets.relations.filter((value) => !value.usageKind).map((value) => value.sourceKind))], [facets])
  const availableUsages = useMemo(() => [...new Set(facets.relations.map((value) => value.usageKind).filter((value): value is string => Boolean(value)))], [facets])
  return <div className="item-catalog-page">
    <ItemCatalogToolbar query={queryInput} sort={sort} onQueryChange={setQueryInput} onSortChange={(value) => updateParams({ sort: value, page: undefined, item: undefined })} />
    <ItemFilterBar rarities={facets.rarities} maxStacks={facets.maxStacks} availableSources={availableSources} availableUsages={availableUsages} rarity={rarity} maxStack={maxStack} source={source} usage={usage} includePlaceholders={includePlaceholders} onChange={(key, value) => updateParams({ [key]: value, page: undefined, item: undefined })} />
    <div className="item-catalog-page__layout">
      <section className="item-catalog-page__list" aria-label="道具列表"><ItemList items={items} selectedId={selectedVisible ? selectedId : undefined} loading={loading} error={error} onSelect={(id) => updateParams({ item: id })} /><ItemPagination page={page} pageSize={resultMeta.pageSize} total={resultMeta.total} hasNext={resultMeta.hasNext} onPageChange={(value) => updateParams({ page: value, item: undefined })} /></section>
      <ItemDetailPanel item={detail} loading={detailLoading} error={detailError} />
    </div>
  </div>
}
