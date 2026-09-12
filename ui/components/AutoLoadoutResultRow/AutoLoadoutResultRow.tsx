import { Check } from 'lucide-react'
import { LOADOUT_SLOTS, type AutoLoadoutResult, type LoadoutSlot } from '../../../api/loadout/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { LoadoutSlotIcon } from '../LoadoutSlotIcon/LoadoutSlotIcon'
import './AutoLoadoutResultRow.css'

const slotLabels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头', chest: '胸', arms: '腕', waist: '腰', legs: '腿', charm: '护石' }

type Props = {
  index: number
  result: AutoLoadoutResult
  selected: boolean
  onSelect: () => void
}

export function AutoLoadoutResultRow({ index, result, selected, onSelect }: Props) {
  const remaining = result.calculation.slots.reduce((sum, item) => sum + Math.max(0, item.remainingSlots), 0)
  const resistance = result.calculation.resistances
  return <article className="auto-loadout-result-row" data-selected={selected || undefined}>
    <button type="button" className="auto-loadout-result-row__selector" aria-pressed={selected} onClick={onSelect}>
      <span className="auto-loadout-result-row__identity">结果 {index}</span>
      <span className="auto-loadout-result-row__summary">防御 <b className="auto-loadout-result-row__data">{result.calculation.defense}</b> / <b className="auto-loadout-result-row__data">{result.calculation.maxDefense}</b></span>
      <span className="auto-loadout-result-row__summary">剩余孔 <b className="auto-loadout-result-row__data">{remaining}</b></span>
      <span className="auto-loadout-result-row__summary">火 <b className="auto-loadout-result-row__data">{resistance.fire}</b></span>
      <span className="auto-loadout-result-row__summary">水 <b className="auto-loadout-result-row__data">{resistance.water}</b></span>
      <span className="auto-loadout-result-row__summary">雷 <b className="auto-loadout-result-row__data">{resistance.thunder}</b></span>
      <span className="auto-loadout-result-row__summary">冰 <b className="auto-loadout-result-row__data">{resistance.ice}</b></span>
      <span className="auto-loadout-result-row__summary">龙 <b className="auto-loadout-result-row__data">{resistance.dragon}</b></span>
      <span className="auto-loadout-result-row__legality">{result.calculation.legality === 'confirmed' ? '自然合法' : '包含固定风险输入'}</span>
      <span className="auto-loadout-result-row__selection"><Check className="auto-loadout-result-row__selection-icon" aria-hidden="true" />{selected ? '已选择' : '选择此结果'}</span>
    </button>
    <div className="auto-loadout-result-row__table-scroller">
      <table className="auto-loadout-result-row__table" aria-label={`结果 ${index} 七槽装备明细`}>
        <thead><tr><th className="auto-loadout-result-row__column auto-loadout-result-row__column--part">部位</th><th className="auto-loadout-result-row__column">装备</th><th className="auto-loadout-result-row__column auto-loadout-result-row__column--decorations">装饰珠</th><th className="auto-loadout-result-row__column auto-loadout-result-row__column--slots">孔位</th></tr></thead>
        <tbody>{LOADOUT_SLOTS.map(slot => {
          const item = result.calculation.slots.find(value => value.slot === slot)
          const equipment = slot === 'weapon' ? result.loadout.weapon : slot === 'charm' ? result.loadout.charm : result.loadout.armor[slot]
          const empty = !item
          return <tr className={`auto-loadout-result-row__equipment-row${empty ? ' auto-loadout-result-row__equipment-row--empty' : ''}`} key={slot}>
            <th className="auto-loadout-result-row__cell auto-loadout-result-row__part" scope="row"><LoadoutSlotIcon gameId={result.loadout.gameId} slot={slot} item={equipment} size="small" /><span className="auto-loadout-result-row__part-hidden">{slotLabels[slot]}</span></th>
            <td className="auto-loadout-result-row__cell auto-loadout-result-row__equipment">{item?.nameCn ?? '未选择'}</td>
            <td className="auto-loadout-result-row__cell auto-loadout-result-row__decorations">{item?.decorations.length ? item.decorations.map(value => value.nameCn).join('、') : '无珠'}</td>
            <td className="auto-loadout-result-row__cell auto-loadout-result-row__slots"><EquipmentSlotIndicator slots={item?.naturalSlots ?? 0} usedSlots={item?.usedSlots ?? 0} compact /></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </article>
}
