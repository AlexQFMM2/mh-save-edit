import type { LoadoutSlot } from '../../../api/loadout/types'
import type { SaveLoadoutWritePreview } from '../../../api/save/types'
import { CatalogWriteDrawer } from '../CatalogWriteDrawer/CatalogWriteDrawer'
import './LoadoutSaveWriteDrawer.css'

const slotLabels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头部', chest: '胸部', arms: '腕部', waist: '腰部', legs: '腿部', charm: '护石' }

export function LoadoutSaveWriteDrawer({ preview, busy, onClose, onApply }: { preview: SaveLoadoutWritePreview; busy: boolean; onClose(): void; onApply(): void }) {
  return <CatalogWriteDrawer title="确认加入装备箱" busy={busy} onClose={onClose} footer={<><button type="button" onClick={onClose}>取消</button><button type="button" disabled={busy} onClick={onApply}>确认加入</button></>}>
    <div className="loadout-save-write-drawer">
      <h3>将写入 {preview.requiredSlots} 个装备实例</h3>
      <dl><dt>装备箱容量</dt><dd>{preview.capacity} 格</dd><dt>当前已用</dt><dd>{preview.nonEmptyCount} 格</dd><dt>剩余空间</dt><dd>{preview.capacity - preview.nonEmptyCount} 格</dd></dl>
      <ul>{preview.targets.map(value => <li key={`${value.loadoutSlot}-${value.slot}`}><strong>{slotLabels[value.loadoutSlot]} · {value.nameCn}</strong><span>第 {value.page} 页第 {value.cell} 格</span></li>)}</ul>
      <p>确认后只写入当前存档会话的内存修改和撤销栈，仍需在修改器页面点击保存。</p>
    </div>
  </CatalogWriteDrawer>
}
