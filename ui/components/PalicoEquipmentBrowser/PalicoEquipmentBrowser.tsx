import type { KeyboardEvent } from 'react'
import type { PalicoArmorSummary, PalicoWeaponSummary } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { PalicoSharpnessLevel } from '../PalicoSharpnessLevel/PalicoSharpnessLevel'
import './PalicoEquipmentBrowser.css'

type Props =
  | { mode: 'weapon'; items: PalicoWeaponSummary[]; selectedId?: number; loading: boolean; onSelect: (id: number) => void }
  | { mode: 'armor'; items: PalicoArmorSummary[]; selectedId?: number; loading: boolean; onSelect: (id: number) => void }

export function PalicoEquipmentBrowser(props: Props) {
  if (props.loading && !props.items.length) return <div className="palico-equipment-browser__state" role="status">正在读取猫装备…</div>
  if (!props.items.length) return <div className="palico-equipment-browser__state">没有符合条件的猫装备。</div>

  if (props.mode === 'weapon') {
    return (
      <div className="palico-equipment-browser">
        <div className="palico-equipment-browser__table palico-equipment-browser__table--weapon" role="table" aria-label="猫武器列表">
          <div className="palico-equipment-browser__header" role="row">
            {['图标', '名称', '稀有度', '类型 / 特化', '近战', '远程', '属性/异常', '斩味', '防御'].map((label) => <span role="columnheader" key={label}>{label}</span>)}
          </div>
          {props.items.map((item, index) => (
            <button
              className={`palico-equipment-browser__row${props.selectedId === item.equipmentId ? ' palico-equipment-browser__row--selected' : ''}`}
              role="row"
              type="button"
              tabIndex={props.selectedId === item.equipmentId || props.selectedId == null && index === 0 ? 0 : -1}
              key={item.equipmentId}
              onClick={() => props.onSelect(item.equipmentId)}
              onKeyDown={(event) => handleRowKeys(event, item.equipmentId, props.items.map((value) => value.equipmentId), props.onSelect)}
            >
              <span className="palico-equipment-browser__icon-cell" role="cell"><CatalogIcon path={item.iconPath} name={item.nameCn} /></span>
              <span className="palico-equipment-browser__name" role="cell"><strong className="palico-equipment-browser__primary-name">{item.nameCn}</strong><small className="palico-equipment-browser__secondary-name">{item.nameEn}</small></span>
              <span className="palico-equipment-browser__data" role="cell">{item.rarity}</span>
              <span className="palico-equipment-browser__data" role="cell">{item.attackType === 'cut' ? '斩击' : '打击'} · {item.specializationCn}</span>
              <span className="palico-equipment-browser__data" role="cell">{item.meleeAttack} / {signed(item.meleeAffinity)}%</span>
              <span className="palico-equipment-browser__data" role="cell">{item.rangedAttack} / {signed(item.rangedAffinity)}%</span>
              <span className="palico-equipment-browser__data" role="cell">{item.specialAttackCn ? `${item.specialAttackCn} ${item.specialAttackValue ?? ''}` : '—'}</span>
              <span className="palico-equipment-browser__sharpness-cell" role="cell"><PalicoSharpnessLevel value={item.sharpnessId} /></span>
              <span className="palico-equipment-browser__data" role="cell">{item.defense}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="palico-equipment-browser">
      <div className="palico-equipment-browser__table palico-equipment-browser__table--armor" role="table" aria-label="猫防具列表">
        <div className="palico-equipment-browser__header" role="row">
          {['图标', '名称', '部位', '稀有度', '防御', '火', '水', '雷', '冰', '龙'].map((label) => <span role="columnheader" key={label}>{label}</span>)}
        </div>
        {props.items.map((item, index) => (
          <button
            className={`palico-equipment-browser__row${props.selectedId === item.equipmentId ? ' palico-equipment-browser__row--selected' : ''}`}
            role="row"
            type="button"
            tabIndex={props.selectedId === item.equipmentId || props.selectedId == null && index === 0 ? 0 : -1}
            key={item.equipmentId}
            onClick={() => props.onSelect(item.equipmentId)}
            onKeyDown={(event) => handleRowKeys(event, item.equipmentId, props.items.map((value) => value.equipmentId), props.onSelect)}
          >
            <span className="palico-equipment-browser__icon-cell" role="cell"><CatalogIcon path={item.iconPath} name={item.nameCn} /></span>
            <span className="palico-equipment-browser__name" role="cell"><strong className="palico-equipment-browser__primary-name">{item.nameCn}</strong><small className="palico-equipment-browser__secondary-name">{item.nameEn}</small></span>
            {[item.part === 'head' ? '头部' : '身体', item.rarity, item.defense, signed(item.fireRes), signed(item.waterRes), signed(item.thunderRes), signed(item.iceRes), signed(item.dragonRes)].map((value, valueIndex) => <span className="palico-equipment-browser__data" role="cell" key={valueIndex}>{value}</span>)}
          </button>
        ))}
      </div>
    </div>
  )
}

function handleRowKeys(event: KeyboardEvent<HTMLButtonElement>, id: number, ids: number[], onSelect: (id: number) => void) {
  const current = ids.indexOf(id)
  let next = current
  if (event.key === 'ArrowDown') next = Math.min(current + 1, ids.length - 1)
  else if (event.key === 'ArrowUp') next = Math.max(current - 1, 0)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = ids.length - 1
  else return
  event.preventDefault()
  const nextId = ids[next]
  const container = event.currentTarget.parentElement
  onSelect(nextId)
  requestAnimationFrame(() => container?.querySelectorAll<HTMLButtonElement>('.palico-equipment-browser__row')[next]?.focus())
}

const signed = (value: number) => value > 0 ? `+${value}` : String(value)
