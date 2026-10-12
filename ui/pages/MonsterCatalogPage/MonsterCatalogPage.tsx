import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { ItemIdentity, MonsterCatalogTab, MonsterDetail, MonsterSummary, QuestAvailability } from '../../../api/catalog/types'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { MonsterDetailPanel } from '../../components/MonsterDetailPanel/MonsterDetailPanel'
import { MonsterSearchList } from '../../components/MonsterSearchList/MonsterSearchList'
import { P2gMonsterQuestDrawer } from '../../components/P2gMonsterQuestDrawer/P2gMonsterQuestDrawer'
import { QuestDetailDrawer } from '../../components/QuestDetailDrawer/QuestDetailDrawer'
import type { ShellOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './MonsterCatalogPage.css'

const tabs: MonsterCatalogTab[] = ['weakness', 'ailments', 'drops', 'quests']
export function MonsterCatalogPage() {
  const { game } = useOutletContext<ShellOutletContext>()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [queryInput, setQueryInput] = useState(query)
  const selected = numberParam(params.get('monster'))
  const target = numberParam(params.get('target'))
  const tab = tabs.includes(params.get('tab') as MonsterCatalogTab) ? params.get('tab') as MonsterCatalogTab : 'weakness'
  const dropDirection = params.get('dropDirection') === 'asc' ? 'asc' : 'desc'
  const taskAvailability = (['common', 'mhgu', 'mhxx'].includes(params.get('taskAvailability') ?? '') ? params.get('taskAvailability') : 'all') as 'all' | QuestAvailability
  const includePlaceholders = params.get('debug') === '1'
  const questKey = params.get('quest')
  const [monsters, setMonsters] = useState<MonsterSummary[]>([])
  const [detail, setDetail] = useState<MonsterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()
  const [itemDrawer, setItemDrawer] = useState<ItemIdentity | null>(null)
  const update = useCallback((changes: Record<string, string | number | undefined>) => setParams(current => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    return next
  }), [setParams])
  // List queries depend on filters, while automatic selection reads the latest URL.
  const selectionRef = useRef({ selected, update })
  useLayoutEffect(() => { selectionRef.current = { selected, update } }, [selected, update])
  const closeQuest = useCallback(() => update({ quest: undefined }), [update])
  const closeItem = useCallback(() => setItemDrawer(null), [])
  const reset = useCallback(() => { setQueryInput(''); setItemDrawer(null); setParams({}) }, [setParams])
  useEffect(() => setQueryInput(query), [query])
  useEffect(() => {
    if (queryInput === query) return
    const timer = window.setTimeout(() => update({ q: queryInput || undefined, target: undefined, monster: undefined, quest: undefined }), 280)
    return () => window.clearTimeout(timer)
  }, [queryInput, query, update])
  useEffect(() => {
    let active = true
    setLoading(true); setError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    void api.searchMonsters({ gameId: game.id, targetMonsterId: target, query, includePlaceholders }).then(rows => {
      if (!active) return
      setMonsters(rows)
      const selection = selectionRef.current
      if (selection.selected == null && rows[0]) selection.update({ monster: rows[0].monsterId })
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '怪物列表读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [game.id, target, query, includePlaceholders])
  useEffect(() => {
    setItemDrawer(null)
    if (selected == null) { setDetail(null); setDetailLoading(false); return }
    let active = true
    setDetailLoading(true); setDetailError(undefined)
    // Keep the preceding selection while loading, but never carry it across games.
    setDetail(previous => previous?.gameId === game.id ? previous : null)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setDetailLoading(false); return }
    void api.getMonster({ gameId: game.id, monsterId: selected }).then(value => { if (active) setDetail(value) })
      .catch(cause => { if (active) setDetailError(cause instanceof Error ? cause.message : '怪物详情读取失败') })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [game.id, selected])
  const visible = monsters.some(monster => monster.monsterId === selected)
  const currentDetail = detail?.gameId === game.id && detail.monsterId === selected ? detail : null
  return <div className="monster-catalog-page"><div className="monster-catalog-page__layout">
    <MonsterSearchList monsters={monsters} selectedId={visible ? selected : undefined} query={queryInput}
      loading={loading} error={error} includePlaceholders={includePlaceholders} onQueryChange={setQueryInput}
      onPlaceholderChange={value => update({ debug: value ? '1' : undefined, target: undefined, monster: undefined, quest: undefined })}
      onReset={reset} onSelect={monsterId => update({ monster: monsterId, quest: undefined })} />
    <MonsterDetailPanel gameId={game.id} monster={detail} loading={detailLoading} error={detailError} tab={tab}
      dropDirection={dropDirection} taskAvailability={taskAvailability} onTabChange={value => update({ tab: value })}
      onDropDirectionChange={value => update({ dropSort: 'probability', dropDirection: value })}
      onTaskAvailabilityChange={value => update({ taskAvailability: value === 'all' ? undefined : value })}
      onSelectItem={item => { closeQuest(); setItemDrawer(item) }}
      onSelectQuest={key => { if (currentDetail) { closeItem(); update({ quest: key }) } }} />
  </div>
    <ItemDetailDrawer identity={itemDrawer} onClose={closeItem} />
    {game.id === 'mhp2g' && currentDetail?.p2gQuests?.some(q => q.questKey === questKey && !q.linked)
      ? <P2gMonsterQuestDrawer questKey={detailLoading ? null : questKey} quest={currentDetail?.p2gQuests?.find(quest => quest.questKey === questKey)} monster={currentDetail} onClose={closeQuest} />
      : <QuestDetailDrawer gameId={game.id} questKey={questKey} onClose={closeQuest} />}
  </div>
}
function numberParam(value: string | null) {
  if (!value) return undefined
  const result = Number(value)
  return Number.isInteger(result) && result > 0 ? result : undefined
}
