import { useEffect, useState } from 'react'
import type { ItemCatalogGameId } from '../../../api/catalog/types'
import type { ItemTermPage } from '../../../api/terminology/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'
import { ItemTermCard } from '../ItemTermCard/ItemTermCard'
import './ItemTerminology.css'

const gameOptions = [
  { value: '', label: '全部游戏', keywords: ['all'] },
  { value: 'mhp3', label: 'P3', keywords: ['MHP3', 'Portable 3rd', '怪物猎人携带版3'] },
  { value: 'mhp2g', label: 'P2G', keywords: ['怪物猎人携带版2G', 'Portable 2nd G'] },
  { value: 'mh3g', label: '3G', keywords: ['MH3G', '3U', 'Tri Ultimate'] },
  { value: 'mh4g', label: '4G', keywords: ['MH4G', '4U', 'Ultimate'] },
  { value: 'mhgu', label: 'GU', keywords: ['MHGU', 'XX', 'Generations Ultimate'] },
]

export function ItemTerminology({ currentGame, onClose }: { currentGame?: ItemCatalogGameId; onClose(): void }) {
  const [query, setQuery] = useState(''), [gameId, setGameId] = useState(currentGame ?? '')
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0)
  const [result, setResult] = useState<ItemTermPage>(), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const timer = setTimeout(() => {
      Promise.resolve().then(() => window.mhSaveEditor.catalog.searchItemTerms({ query, gameId: gameId ? gameId as ItemCatalogGameId : undefined, page, pageSize: 30 }))
        .then(value => { if (active) setResult(value) })
        .catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : '词典读取失败'); setResult(undefined) } })
        .finally(() => { if (active) setLoading(false) })
    }, 180)
    return () => { active = false; clearTimeout(timer) }
  }, [query, gameId, page, retry])
  const changeQuery = (value: string) => { setQuery(value); setPage(1) }
  return <WorkspaceDrawer title="译名词典" onClose={onClose} footer={<>
    <span className="item-terminology__count" aria-live="polite">{!loading && result?.available ? `${result.total} 个词条 · 第 ${page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))} 页` : ''}</span>
    <button type="button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button>
    <button type="button" disabled={loading || !result?.hasNext} onClick={() => setPage(value => value + 1)}>下一页</button>
  </>}>
    <section className="item-terminology" aria-label="道具译名对照">
      <p className="item-terminology__intro">当前收录道具译名。已确认的对应名称以 GU 官方简中为主，旧译名和日文均可搜索。</p>
      <div className="item-terminology__toolbar">
        <label className="item-terminology__search"><span className="item-terminology__label">搜索</span><input className="item-terminology__input" value={query} maxLength={120} placeholder="名称、旧译名或日文" onChange={event => changeQuery(event.target.value)} /></label>
        <div className="item-terminology__filter"><span className="item-terminology__label">游戏</span><SearchableSelect ariaLabel="词典游戏" options={gameOptions} value={gameId} onChange={value => { setGameId(value); setPage(1) }} /></div>
      </div>
      <div className="item-terminology__results" aria-busy={loading}>
        {loading ? <p className="item-terminology__state" role="status">正在读取词典…</p> : error ? <div className="item-terminology__state" role="alert">{error}<button type="button" className="item-terminology__retry" onClick={() => setRetry(value => value + 1)}>重试</button></div>
          : !result?.available ? <p className="item-terminology__state" role="status">{result?.message}</p>
          : result.items.length ? result.items.map(term => <ItemTermCard key={term.id} term={term} />)
          : <p className="item-terminology__state" role="status">没有匹配的译名。可以换用原译名、日文，或查看全部游戏。</p>}
      </div>
    </section>
  </WorkspaceDrawer>
}
