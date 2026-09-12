import { PackagePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GameId } from '../../../api/core/loadout'
import { SAVE_BOX_ITEM_STACK_MAX, type SaveBoxWriteTarget, type SaveCatalogItemWritePreview } from '../../../api/save/types'
import { CatalogWriteDrawer } from '../CatalogWriteDrawer/CatalogWriteDrawer'
import { useOptionalSaveSession } from '../SaveSessionProvider/SaveSessionProvider'
import './CatalogWriteControl.css'

type Props =
  | { gameId: GameId; kind: 'item'; saveId: number; maxCount?: number | null }
  | { gameId: GameId; kind: 'equipment'; saveType: number; saveId: number; level?: number; domain?: 'hunter-equipment' | 'palico-equipment'; appearanceId?: number }

export function CatalogWriteControl(props: Props) {
  const save = useOptionalSaveSession()
  const [open, setOpen] = useState(false)
  // Catalog maxStack describes carried-item limits. A box cell has its own
  // stack rule, so never let a carried limit or a larger encoding width leak
  // into the catalog-to-box quantity editor.
  const catalogMaximum = props.kind === 'item' ? SAVE_BOX_ITEM_STACK_MAX : 1
  const session = save?.session ?? null
  const maximum = props.kind === 'item' ? Math.min(SAVE_BOX_ITEM_STACK_MAX, session?.capabilities.itemCountMax ?? SAVE_BOX_ITEM_STACK_MAX) : 1
  const [count, setCount] = useState(Math.min(catalogMaximum, 99))
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState<SaveBoxWriteTarget | null>(null)
  const [itemPreview, setItemPreview] = useState<SaveCatalogItemWritePreview | null>(null)
  const [targetError, setTargetError] = useState<string | null>(null)
  const domain = props.kind === 'item' ? 'items' : props.domain ?? 'hunter-equipment'
  useEffect(() => { setCount(value => Math.min(Math.max(1, value), maximum)) }, [maximum])
  useEffect(() => {
    if (!open || !session || session.contentGameId !== props.gameId || session.state === 'selectingCharacter') return
    let live = true
    setTarget(null); setItemPreview(null)
    setTargetError(null)
    const preview = props.kind === 'item'
      ? window.mhSaveEditor.save.previewCatalogItemWrite({ sessionId: session.sessionId, revision: session.revision, gameId: props.gameId, saveId: props.saveId, count, targetSlot: undefined })
      : window.mhSaveEditor.save.previewBoxWriteTarget({ sessionId: session.sessionId, revision: session.revision, domain })
    void preview.then(value => {
      if (!live) return
      if (props.kind === 'item') setItemPreview(value as SaveCatalogItemWritePreview)
      else setTarget(value as SaveBoxWriteTarget)
    }).catch(cause => {
      if (live) setTargetError(cause instanceof Error ? cause.message : '无法读取箱子剩余空间')
    })
    return () => { live = false }
  }, [count, domain, open, props.gameId, props.kind, props.saveId, session?.contentGameId, session?.revision, session?.sessionId, session?.state])
  if (!save) return null
  const { notify } = save
  if (!session) return <div className="catalog-write-control"><button type="button" disabled title="请先在修改页读取存档"><PackagePlus aria-hidden="true" />读取存档后可加入</button></div>
  if (session.contentGameId !== props.gameId) return <div className="catalog-write-control"><button type="button" disabled title={`当前读取的是 ${session.contentGameId.toUpperCase()} 存档`}><PackagePlus aria-hidden="true" />当前存档版本不匹配</button></div>
  if (session.state === 'selectingCharacter') return <div className="catalog-write-control"><button type="button" disabled title="请先选择要修改的角色"><PackagePlus aria-hidden="true" />选择角色后可加入</button></div>
  if (session.readOnly) return <div className="catalog-write-control"><button type="button" disabled title="当前存档处于只读保护"><PackagePlus aria-hidden="true" />只读存档不可加入</button></div>
  const capacity = domain === 'items' ? session.capabilities.itemCapacity : domain === 'palico-equipment' ? session.capabilities.palicoEquipmentCapacity : session.capabilities.hunterEquipmentCapacity
  const label = props.kind === 'item' ? '加入道具箱' : domain === 'palico-equipment' ? '加入猫装备箱' : '加入装备箱'
  const apply = async () => {
    setBusy(true)
    try {
      const result = props.kind === 'item'
        ? await window.mhSaveEditor.save.addCatalogItem({ sessionId: session.sessionId, revision: session.revision, gameId: props.gameId, saveId: props.saveId, count, targetSlot: itemPreview?.targets[0]?.slot })
        : await window.mhSaveEditor.save.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: props.gameId, domain: props.domain ?? 'hunter-equipment', saveType: props.saveType, saveId: props.saveId, level: props.level, appearanceId: props.appearanceId, targetSlot: target?.slot ?? undefined })
      notify(result.message)
      setOpen(false)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '加入箱子失败', 'error')
    } finally {
      setBusy(false)
    }
  }
  const ready = props.kind === 'item' ? Boolean(itemPreview?.targets.length) : Boolean(target && !target.full)
  const destination = props.kind === 'item' ? itemPreview?.targets.map(value => `第 ${value.page} 页 · 第 ${value.cell} 格（+${value.addedCount}）`).join('、') : target && (target.full ? '箱子已满' : `第 ${target.page} 页 · 第 ${target.cell} 格`)
  return <div className="catalog-write-control">
    <button type="button" onClick={() => setOpen(true)}><PackagePlus aria-hidden="true" />{label}</button>
    {open && <CatalogWriteDrawer title={label} busy={busy} onClose={() => setOpen(false)} footer={<><button type="button" onClick={() => setOpen(false)}>取消</button><button type="button" disabled={busy || !ready || capacity <= 0 || props.kind === 'item' && (count < 1 || count > maximum)} onClick={() => void apply()}>确认加入</button></>}>
      <div className="catalog-write-control__drawer">
        <PackagePlus aria-hidden="true" />
        <h3>{label}</h3>
        <dl><dt>目标版本</dt><dd>{session.contentGameId.toUpperCase()}</dd><dt>目标箱域</dt><dd>{domain === 'items' ? '道具箱' : domain === 'palico-equipment' ? '猫装备箱' : '猎人装备箱'}</dd><dt>箱子容量</dt><dd>{itemPreview ? `${itemPreview.nonEmptyCount} / ${itemPreview.capacity} 格` : target ? `${target.nonEmptyCount} / ${target.capacity} 格` : `${capacity} 格`}</dd><dt>剩余空间</dt><dd>{itemPreview ? `${itemPreview.capacity - itemPreview.nonEmptyCount} 格` : target ? `${target.capacity - target.nonEmptyCount} 格` : '读取中…'}</dd><dt>写入位置</dt><dd>{destination ?? targetError ?? '正在生成写入预览…'}</dd></dl>
        {props.kind === 'item' && <label>加入数量<input autoFocus type="number" min="1" max={maximum} value={count} onChange={event => setCount(Number(event.target.value))} /><small>箱格允许范围：1～{maximum}（图鉴中的携带上限不适用于箱子）</small></label>}
        {targetError && <p className="catalog-write-control__error" role="alert">{targetError}</p>}
        <p>确认后只写入内存修改和撤销栈；成功提示会给出页/格，仍需在修改页保存文件。</p>
      </div>
    </CatalogWriteDrawer>}
  </div>
}
