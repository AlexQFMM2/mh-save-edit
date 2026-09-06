import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ItemPagination.css'

type ItemPaginationProps = { page: number; pageSize: number; total: number; hasNext: boolean; onPageChange: (page: number) => void }
export function ItemPagination({ page, pageSize, total, hasNext, onPageChange }: ItemPaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return <nav className="item-pagination" aria-label="道具列表分页">
    <span>{start}–{end} / {total}</span>
    <div><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="上一页"><ChevronLeft /></button><strong>第 {page} 页</strong><button type="button" disabled={!hasNext} onClick={() => onPageChange(page + 1)} aria-label="下一页"><ChevronRight /></button></div>
  </nav>
}
