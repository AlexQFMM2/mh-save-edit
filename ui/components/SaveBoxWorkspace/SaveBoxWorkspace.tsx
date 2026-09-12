import { ChevronLeft, ChevronRight, Copy, Download, Eraser, Gem, PackageOpen, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameId } from '../../../api/core/loadout'
import type { SaveBoxSection, SaveEquipmentCell, SaveItemCell } from '../../../api/save/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import { SaveEquipmentEmbeddedDetail } from '../SaveEquipmentEmbeddedDetail/SaveEquipmentEmbeddedDetail'
import './SaveBoxWorkspace.css'

const isItem = (value: SaveItemCell | SaveEquipmentCell): value is SaveItemCell => 'itemId' in value
const isCharm = (value: SaveItemCell | SaveEquipmentCell): value is SaveEquipmentCell => !isItem(value) && value.kind === 'charm'
export type SaveBoxViewFilter = 'all' | 'non-empty' | 'matching' | 'diagnostic'

type Props = {
  gameId: GameId; section: SaveBoxSection; busy: boolean; editable?: boolean; onPage(page: number): void
  itemCountMax?: number
  selectedSlot?: number; query?: string; onSelectionChange?(slot: number): void; onQueryChange?(query: string): void
  viewFilter?: SaveBoxViewFilter; onViewFilterChange?(filter: SaveBoxViewFilter): void
  onFindNext?(query: string, afterSlot: number): void
  onReplaceItem(cell: SaveItemCell): void; onEditEquipment(cell: SaveEquipmentCell): void
  onSetCount(cell: SaveItemCell, count: number): void; onClear(slot: number): void
  onCopy(source: number): void; onImport(): void; onExport(): void
}

export function SaveBoxWorkspace({ gameId, section, busy, editable = true, itemCountMax = 0xffff, selectedSlot: controlledSlot, query: controlledQuery, viewFilter = 'all', onSelectionChange, onQueryChange, onViewFilterChange, onFindNext, onPage, onReplaceItem, onEditEquipment, onSetCount, onClear, onCopy, onImport, onExport }: Props) {
  const [internalSlot, setInternalSlot] = useState(section.cells.find(cell => !cell.empty)?.slot ?? section.cells[0]?.slot ?? 0)
  const [internalQuery, setInternalQuery] = useState(''); const selectedSlot = controlledSlot ?? internalSlot; const query = controlledQuery ?? internalQuery
  const setSelectedSlot = (slot: number) => { setInternalSlot(slot); onSelectionChange?.(slot) }
  const setQuery = (value: string) => { setInternalQuery(value); onQueryChange?.(value) }
  const [count, setCount] = useState(1); const grid = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (section.cells.some(cell => cell.slot === selectedSlot)) return
    const fallback = section.cells[0]?.slot ?? 0
    setInternalSlot(fallback)
    // A controlled selection may intentionally point at the page currently
    // being loaded (full-box search and PageUp/PageDown both do this). Do not
    // push the old page's fallback back into the parent while that transition
    // is in flight.
    if (controlledSlot == null) onSelectionChange?.(fallback)
  }, [controlledSlot, onSelectionChange, section.cells, selectedSlot])
  const selected = section.cells.find(cell => cell.slot === selectedSlot) ?? section.cells[0]
  useEffect(() => { if (selected && isItem(selected)) setCount(selected.count) }, [selected])
  const normalized = query.trim().toLocaleLowerCase()
  const resolvedQuery = section.query?.trim().toLocaleLowerCase() ?? ''
  const matches = useMemo(() => new Set(resolvedQuery === normalized && section.matchingSlots ? section.matchingSlots : section.cells.filter(cell => !normalized || `${cell.nameCn} ${cell.nameEn} ${isItem(cell) ? cell.itemId : `${cell.saveType} ${cell.saveId}`}`.toLocaleLowerCase().includes(normalized)).map(cell => cell.slot)), [normalized, resolvedQuery, section.cells, section.matchingSlots])
  const passesViewFilter = (cell: SaveItemCell | SaveEquipmentCell) => viewFilter === 'all'
    || viewFilter === 'non-empty' && !cell.empty
    || viewFilter === 'matching' && (!normalized || matches.has(cell.slot))
    || viewFilter === 'diagnostic' && cell.diagnostics.length > 0
  const filteredOnPage = section.cells.filter(passesViewFilter).length
  const selectNextMatch = () => {
    if (onFindNext && normalized) { onFindNext(query, selectedSlot); return }
    const ordered = section.cells.filter(cell => matches.has(cell.slot))
    if (!ordered.length) return
    const current = ordered.findIndex(cell => cell.slot === selectedSlot)
    const value = ordered[(current + 1 + ordered.length) % ordered.length]
    setSelectedSlot(value.slot)
    grid.current?.querySelector<HTMLButtonElement>(`[data-slot="${value.slot}"]`)?.focus()
  }
  const move = (event: React.KeyboardEvent, slot: number) => {
    const index = slot - (section.page - 1) * 100; let next = index
    if (event.key === 'ArrowLeft') next -= 1; else if (event.key === 'ArrowRight') next += 1; else if (event.key === 'ArrowUp') next -= 10; else if (event.key === 'ArrowDown') next += 10
    else if (event.key === 'Home') next = Math.floor(index / 10) * 10; else if (event.key === 'End') next = Math.min(Math.floor(index / 10) * 10 + 9, section.cells.length - 1)
    else if (event.key === 'PageUp' || event.key === 'PageDown') { const page = Math.max(1, Math.min(section.pageCount, section.page + (event.key === 'PageDown' ? 1 : -1))); event.preventDefault(); setSelectedSlot((page - 1) * 100 + index); onPage(page); return }
    else if (event.key === 'Enter') { if (editable && selected) isItem(selected) ? onReplaceItem(selected) : onEditEquipment(selected); return } else return
    event.preventDefault(); next = Math.max(0, Math.min(section.cells.length - 1, next)); const value = section.cells[next]
    if (value) { setSelectedSlot(value.slot); grid.current?.querySelector<HTMLButtonElement>(`[data-slot="${value.slot}"]`)?.focus() }
  }
  const iconFor = (cell: SaveItemCell | SaveEquipmentCell) => isCharm(cell) ? Gem : undefined
  return <div className="save-box-workspace">
    <section className="save-box-workspace__box"><header><label><Search aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); selectNextMatch() } }} placeholder="搜索整个箱子（Enter 跳到下一项）" /></label><SearchableSelect ariaLabel="箱格突出显示" value={viewFilter} options={[{ value: 'all', label: '全部格子' }, { value: 'non-empty', label: '突出非空' }, { value: 'matching', label: '突出匹配', disabled: !normalized }, { value: 'diagnostic', label: '突出诊断' }]} onChange={value => onViewFilterChange?.(value as SaveBoxViewFilter)} /><span title={viewFilter === 'all' ? undefined : `当前页 ${filteredOnPage} 格符合突出条件；物理位置不变`}>{normalized ? `${resolvedQuery === normalized ? section.matchingCount ?? matches.size : matches.size} 项匹配${resolvedQuery === normalized ? '' : '（当前页）'} · ` : ''}{section.nonEmptyCount} / {section.totalSlots}</span><button type="button" disabled={busy || !editable} title={!editable ? '当前存档处于只读保护' : undefined} onClick={onImport}><Upload aria-hidden="true" />导入</button><button type="button" onClick={onExport}><Download aria-hidden="true" />导出</button></header>
      <div ref={grid} className="save-box-workspace__grid" role="grid" aria-label={`第 ${section.page} 页物理箱格`}>{section.cells.map(cell => <button type="button" role="gridcell" data-slot={cell.slot} tabIndex={cell.slot === selected?.slot ? 0 : -1} aria-selected={cell.slot === selected?.slot} aria-label={`第 ${cell.slot + 1} 格，${cell.nameCn}${isItem(cell) && !cell.empty ? `，数量 ${cell.count}` : ''}`} className={`${cell.empty ? 'is-empty' : ''}${matches.has(cell.slot) && passesViewFilter(cell) ? '' : ' is-dimmed'}`} key={cell.slot} title={`${cell.slot + 1}. ${cell.nameCn}`} onClick={() => setSelectedSlot(cell.slot)} onDoubleClick={() => { if (editable) isItem(cell) ? onReplaceItem(cell) : onEditEquipment(cell) }} onKeyDown={event => move(event, cell.slot)}><small>{cell.slot + 1}</small><CatalogIcon path={cell.iconPath} name={cell.nameCn} fallbackIcon={iconFor(cell)} />{isItem(cell) && !cell.empty && <strong>×{cell.count}</strong>}</button>)}</div>
      <footer><button type="button" disabled={section.page <= 1} onClick={() => onPage(section.page - 1)}><ChevronLeft aria-hidden="true" />上一页</button><span>第 {section.page} / {section.pageCount} 页</span><button type="button" disabled={section.page >= section.pageCount} onClick={() => onPage(section.page + 1)}>下一页<ChevronRight aria-hidden="true" /></button></footer>
    </section>
    <aside className="save-box-workspace__detail">{selected ? <><header><CatalogIcon path={selected.iconPath} name={selected.nameCn} size="large" fallbackIcon={iconFor(selected)} /><div><span>第 {section.page} 页 · 第 {selected.slot % 100 + 1} 格</span><h2>{selected.nameCn}</h2><p>{selected.nameEn || (selected.empty ? '空格' : '—')}</p></div></header><div className="save-box-workspace__detail-scroll">{isItem(selected) ? <ItemDetail cell={selected} count={count} countMax={Math.min(itemCountMax, selected.maxStack ?? itemCountMax)} busy={busy} editable={editable} onCount={setCount} onApply={() => onSetCount(selected, count)} onReplace={() => onReplaceItem(selected)} /> : <EquipmentDetail gameId={gameId} cell={selected} editable={editable} />}{selected.diagnostics.map(issue => <p className="save-box-workspace__diagnostic" key={`${issue.code}-${issue.path}`}>{issue.message}</p>)}</div><section className="save-box-workspace__operations"><h3>箱格操作</h3><p>{editable ? '复制会自动使用当前箱域的第一个空物理格。' : '当前存档处于只读保护，可浏览和导出，但不能修改箱格。'}</p>{!isItem(selected) && <button type="button" className="save-box-workspace__primary" disabled={busy || !editable} onClick={() => onEditEquipment(selected)}>更换 / 编辑装备</button>}<button type="button" disabled={busy || !editable || selected.empty || section.nonEmptyCount >= section.totalSlots} onClick={() => onCopy(selected.slot)}><Copy aria-hidden="true" />复制到首个空格</button><button type="button" disabled={busy || !editable || selected.empty} onClick={() => onClear(selected.slot)}><Eraser aria-hidden="true" />清空格子</button></section></> : <div className="save-box-workspace__empty"><PackageOpen aria-hidden="true" />没有可显示的箱格</div>}</aside>
  </div>
}

function ItemDetail({ cell, count, countMax, busy, editable, onCount, onApply, onReplace }: { cell: SaveItemCell; count: number; countMax: number; busy: boolean; editable: boolean; onCount(value: number): void; onApply(): void; onReplace(): void }) {
  const valid = Number.isInteger(count) && count >= 1 && count <= countMax
  return <section><dl><dt>道具 ID</dt><dd>{cell.itemId} / 0x{cell.itemId.toString(16).toUpperCase()}</dd><dt>稀有度</dt><dd>{cell.rarity ?? '—'}</dd><dt>数量上限</dt><dd>{countMax}</dd></dl><label>数量<div><input type="number" min="1" max={countMax} value={count} aria-invalid={!valid} disabled={!editable} onChange={event => onCount(Number(event.target.value))} /><button type="button" disabled={busy || !editable || cell.empty || !valid || count === cell.count} onClick={onApply}>应用</button></div>{!valid && <small role="alert">数量必须在 1～{countMax} 范围内；清空请使用“清空格子”。</small>}</label><button type="button" className="save-box-workspace__primary" disabled={!editable} onClick={onReplace}>替换道具</button></section>
}

function EquipmentDetail({ gameId, cell, editable }: { gameId: GameId; cell: SaveEquipmentCell; editable: boolean }) {
  return <section><SaveEquipmentEmbeddedDetail gameId={gameId} cell={cell} /><p>{editable ? '编辑已确认字段时会保留未知位和保留字节。' : '当前存档处于只读保护。'}</p></section>
}
