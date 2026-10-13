import { useCallback, useEffect, useRef, useState } from 'react'
import type { CharmValidationResult, LoadoutCalculationSnapshot, LoadoutFacets, LoadoutSlot } from '../../../api/loadout/types'
import { CharmEditorForm, type EditableCharm } from '../CharmEditorForm/CharmEditorForm'
import { EquipmentPickerContent, type EquipmentPickerCandidate } from '../EquipmentPickerContent/EquipmentPickerContent'
import './AutoLoadoutEquipmentView.css'

export type AutoLoadoutEquipmentValue = EquipmentPickerCandidate | EditableCharm
type Props = { slot: LoadoutSlot; snapshot: LoadoutCalculationSnapshot; current: AutoLoadoutEquipmentValue | null; onApply(value: AutoLoadoutEquipmentValue | null): void; onBack(): void; onOpenCatalog(path: string): void }

/** Content subview only: the owning auto drawer keeps the sole portal and focus trap. */
export function AutoLoadoutEquipmentView({ slot, snapshot, current, onApply, onBack, onOpenCatalog }: Props) {
  const view = useRef<HTMLDivElement>(null)
  useEffect(() => { view.current?.focus() }, [])
  const [selected, setSelected] = useState<AutoLoadoutEquipmentValue | null>(current)
  const [blocked, setBlocked] = useState(false)
  const [facets, setFacets] = useState<LoadoutFacets>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (slot === 'charm') return
    let active = true
    setError(undefined)
    void window.mhSaveEditor.loadout.getFacets(snapshot.gameId).then(value => { if (active) setFacets(value) }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : '筛选资料读取失败') })
    return () => { active = false }
  }, [slot, snapshot.gameId, attempt])
  const select = useCallback((value: EquipmentPickerCandidate | null) => { setSelected(value); setBlocked(value?.instance?.encoding === 'blocked') }, [])
  const editCharm = useCallback((value: EditableCharm, validation: CharmValidationResult) => { setSelected(value); setBlocked(validation.encoding === 'blocked') }, [])
  return <div className="auto-loadout-equipment-view" ref={view} tabIndex={-1}>
    <p className="auto-loadout-equipment-view__notice">仅编辑搜索条件。应用后返回条件；返回或 Escape 放弃本次选择，不影响主配装或已有任务。更换装备不自动迁移旧珠；{snapshot.gameId === 'mhp2g' ? '防具是否固定由条件页单独设置。' : '防具和护石是否固定由条件页单独设置。'}</p>
    <div className="auto-loadout-equipment-view__content">
      {slot === 'charm' ? <CharmEditorForm snapshot={snapshot} current={current?.kind === 'charm' ? current : null} onChange={editCharm} /> : error ? <div role="alert" className="auto-loadout-equipment-view__error">{error}<button type="button" className="auto-loadout-equipment-view__action" onClick={() => setAttempt(value => value + 1)}>重试</button></div> : !facets ? <p role="status">正在读取筛选资料…</p> : <EquipmentPickerContent gameId={snapshot.gameId} slot={slot} facets={facets} relicLookups={snapshot.relicLookups} decorations={snapshot.decorations} current={current?.kind !== 'charm' ? current : null} onSelectionChange={select} onOpenCatalog={onOpenCatalog} />}
    </div>
    <footer className="auto-loadout-equipment-view__footer">
      <button className="auto-loadout-equipment-view__action" type="button" onClick={onBack}>返回条件</button>
      <button className="auto-loadout-equipment-view__action" type="button" disabled={!current} onClick={() => onApply(null)}>清空此槽</button>
      <button className="auto-loadout-equipment-view__action" type="button" disabled={!selected || blocked || (slot !== 'charm' && (!facets || Boolean(error)))} onClick={() => selected && onApply(selected)}>应用到搜索条件</button>
    </footer>
  </div>
}
