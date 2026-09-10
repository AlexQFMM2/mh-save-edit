import type { LoadoutResult, LoadoutSlot, LogicalLoadout } from '../../../api/loadout/types'
import { LoadoutEquipmentRow } from '../LoadoutEquipmentRow/LoadoutEquipmentRow'
import './LoadoutEquipmentTable.css'
type Props = { slots: readonly LoadoutSlot[]; loadout: LogicalLoadout; result: LoadoutResult; onChoose: (slot: LoadoutSlot) => void; onClear: (slot: LoadoutSlot) => void; onDecorate: (slot: LoadoutSlot) => void; onToggleLock: (slot: LoadoutSlot) => void }
export function LoadoutEquipmentTable({ slots, loadout, result, onChoose, onClear, onDecorate, onToggleLock }: Props) {
  const remaining = result.slots.reduce((sum, item) => sum + Math.max(0, item.remainingSlots), 0)
  const resistance = result.resistances
  return <section className="loadout-equipment-table" aria-label="七槽装备与属性">
    <div className="loadout-equipment-table__title"><strong className="loadout-equipment-table__title-label">当前装备</strong><span className="loadout-equipment-table__summary">防御 <b className="loadout-equipment-table__data">{result.defense}</b> / <b className="loadout-equipment-table__data">{result.maxDefense}</b> · 剩余孔 <b className="loadout-equipment-table__data">{remaining}</b> · 火 <b className="loadout-equipment-table__data">{resistance.fire}</b> 水 <b className="loadout-equipment-table__data">{resistance.water}</b> 雷 <b className="loadout-equipment-table__data">{resistance.thunder}</b> 冰 <b className="loadout-equipment-table__data">{resistance.ice}</b> 龙 <b className="loadout-equipment-table__data">{resistance.dragon}</b></span></div>
    <div className="loadout-equipment-table__scroller">
      <div className="loadout-equipment-table__header"><span>部位</span><span>装备</span><span>装饰珠</span><span>孔位</span><span>职业</span><span>防御</span><span>最大</span><span>火</span><span>水</span><span>雷</span><span>冰</span><span>龙</span><span>状态</span><span>操作</span></div>
      <div className="loadout-equipment-table__body">{slots.map(slot => <LoadoutEquipmentRow key={slot} slot={slot} item={slot === 'weapon' ? loadout.weapon : slot === 'charm' ? loadout.charm : loadout.armor[slot] ?? null} result={result.slots.find(item => item.slot === slot)} armorStats={result.armorStats.find(item => item.part === slot)} onChoose={() => onChoose(slot)} onClear={() => onClear(slot)} onDecorate={() => onDecorate(slot)} onToggleLock={() => onToggleLock(slot)} />)}</div>
    </div>
  </section>
}
