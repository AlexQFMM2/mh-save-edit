import { Gem, Lock, Replace, Trash2, Unlock } from 'lucide-react'
import type { LoadoutArmor, LoadoutCharm, LoadoutResult, LoadoutSlot, LoadoutSlotResult, LoadoutWeapon } from '../../../api/loadout/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { LoadoutSlotIcon } from '../LoadoutSlotIcon/LoadoutSlotIcon'
import './LoadoutEquipmentRow.css'

type LoadoutItem = LoadoutWeapon | LoadoutArmor | (LoadoutCharm & { lock: LoadoutSlotResult['lock'] })
type Props = { slot: LoadoutSlot; item: LoadoutItem | null; result?: LoadoutSlotResult; armorStats?: LoadoutResult['armorStats'][number]; onChoose: () => void; onClear: () => void; onDecorate: () => void; onToggleLock: () => void }
const labels: Record<LoadoutSlot, string> = { weapon: '武器', head: '头', chest: '胸', arms: '腕', waist: '腰', legs: '腿', charm: '护石' }

export function LoadoutEquipmentRow({ slot, item, result, armorStats, onChoose, onClear, onDecorate, onToggleLock }: Props) {
  const locked = result?.lock !== 'unlocked'
  const combat = armorStats ? armorStats.combat === 'both' ? '通用' : armorStats.combat === 'gunner' ? '远程' : '近战' : '—'
  const data = [armorStats?.baseDefense, armorStats?.maxDefense, armorStats?.fireRes, armorStats?.waterRes, armorStats?.thunderRes, armorStats?.iceRes, armorStats?.dragonRes]
  return <div className="loadout-equipment-row">
    <div className="loadout-equipment-row__slot"><LoadoutSlotIcon slot={slot} item={item} /><span className="loadout-equipment-row__slot-hidden">{labels[slot]}</span></div>
    <button type="button" className="loadout-equipment-row__name" onClick={onChoose}><span className="loadout-equipment-row__name-text">{result?.nameCn ?? '未选择'}</span>{result && <small className="loadout-equipment-row__lock-text">{result.lock === 'equipment' ? '固定装备' : result.lock === 'equipmentAndDecorations' ? '固定装备和珠子' : '未固定'}</small>}</button>
    <span className="loadout-equipment-row__decorations" title={result?.decorations.map(value => value.nameCn).join('、')}>{result?.decorations.length ? result.decorations.map(value => value.nameCn).join('、') : '—'}</span>
    <span className="loadout-equipment-row__slots"><EquipmentSlotIndicator slots={result?.naturalSlots ?? 0} usedSlots={result?.usedSlots ?? 0} /><small className="loadout-equipment-row__slot-usage">{result ? `${result.usedSlots}/${result.naturalSlots}` : '—'}</small></span>
    <span>{combat}</span>{data.map((value, index) => <b className="loadout-equipment-row__data" key={index}>{value ?? '—'}</b>)}
    <span className={`loadout-equipment-row__state loadout-equipment-row__state--${result?.legality ?? 'unknown'}`}>{result?.legality === 'confirmed' ? '合法' : result?.legality === 'invalid' ? '风险' : '未选择'}</span>
    <div className="loadout-equipment-row__actions">
      <button className="loadout-equipment-row__action" type="button" onClick={onChoose} aria-label={`${result ? '更换' : '选择'}${labels[slot]}`} title={result ? '更换装备' : '选择装备'}><Replace className="loadout-equipment-row__action-icon" aria-hidden="true" /></button>
      <button className="loadout-equipment-row__action" type="button" onClick={onDecorate} disabled={!result} aria-label={`编辑${labels[slot]}装饰珠`} title="编辑装饰珠"><Gem className="loadout-equipment-row__action-icon" aria-hidden="true" /></button>
      <button className="loadout-equipment-row__action" type="button" onClick={onToggleLock} disabled={!result} aria-label={locked ? `解锁${labels[slot]}` : `固定${labels[slot]}`}>{locked ? <Unlock className="loadout-equipment-row__action-icon" aria-hidden="true" /> : <Lock className="loadout-equipment-row__action-icon" aria-hidden="true" />}</button>
      <button className="loadout-equipment-row__action" type="button" onClick={onClear} disabled={!result} aria-label={`清空${labels[slot]}`}><Trash2 className="loadout-equipment-row__action-icon" aria-hidden="true" /></button>
    </div>
  </div>
}
