import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { DecorationSkill, DecorationSummary } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { DecorationList } from '../DecorationList/DecorationList'
import { ItemPagination } from '../ItemPagination/ItemPagination'
import './P3DecorationSkillDrawer.css'

/** Only the verified jewel/skill-point relationship; no unverified activation data. */
export function P3DecorationSkillDrawer({ skill, onClose }: { skill: Pick<DecorationSkill, 'skillId' | 'nameCn' | 'nameEn' | 'nameJp'> | null; onClose: () => void }) {
  const navigate = useNavigate(), [items, setItems] = useState<DecorationSummary[]>([])
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState<string>()
  const [meta, setMeta] = useState({ total: 0, hasNext: false })
  const id = skill?.skillId
  useEffect(() => { setPage(1) }, [id])
  useEffect(() => {
    if (id == null) return
    let active = true
    setLoading(true); setError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    void api.searchDecorations({ gameId: 'mhp3', skillId: id, sort: 'skillPoints', page, pageSize: 100 })
      .then(result => { if (active) { setItems(result.items); setMeta({ total: result.total, hasNext: result.hasNext }) } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '关联装饰品读取失败') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, page, retry])
  if (!skill) return null
  const go = (query: string) => { onClose(); navigate(`/game/mhp3/catalog/decorations?${query}`) }
  return createPortal(<DetailDrawer title="关联技能" onClose={onClose}>
    <section className="p3-decoration-skill-drawer" aria-label={`${skill.nameCn}装饰品技能点`}>
      <header className="p3-decoration-skill-drawer__header">
        <h2 className="p3-decoration-skill-drawer__title">{skill.nameCn}</h2>
        <p className="p3-decoration-skill-drawer__subtitle">{skill.nameJp} · {skill.nameEn}</p>
        <p className="p3-decoration-skill-drawer__note">已收录的装饰品技能点（含负点），按点数排序。发动阈值与完整效果尚未收录。</p>
        <button className="p3-decoration-skill-drawer__filter" type="button" onClick={() => go(`skill=${skill.skillId}&sort=skillPoints`)}>在装饰品图鉴筛选此技能</button>
      </header>
      <DecorationList items={items} loading={loading} error={error} onRetry={() => setRetry(n => n + 1)} onSelect={itemId => go(`target=${itemId}&item=${itemId}`)} />
      <ItemPagination ariaLabel="关联技能装饰品分页" page={page} pageSize={100} total={meta.total} hasNext={meta.hasNext} onPageChange={setPage} />
    </section>
  </DetailDrawer>, document.body)
}
