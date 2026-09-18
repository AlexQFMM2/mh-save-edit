import type { SaveEquipmentCell } from '../../../api/save/types'
import { armorPartForSaveType } from '../../../api/save/armorParts'
import { ArmorAppearanceIcon } from '../ArmorAppearanceIcon/ArmorAppearanceIcon'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import './ArmorAppearanceComparison.css'

export function ArmorAppearanceComparison({ cell }: { cell: SaveEquipmentCell }) {
  const part = armorPartForSaveType('mhgu', cell.saveType)
  return <section className="armor-appearance-comparison" aria-label="实际装备与幻化外观">
    <div className="armor-appearance-comparison__entry"><CatalogIcon path={cell.iconPath} name={cell.nameCn} size="large" /><div className="armor-appearance-comparison__text"><strong>实际装备</strong><span>{cell.nameCn}</span><small>技能、防御与孔位的来源</small></div></div>
    <div className="armor-appearance-comparison__entry">{part && <ArmorAppearanceIcon part={part} name={cell.appearance?.nameCn ?? '未知外观'} fallbackPath={cell.iconPath} size="large" />}<div className="armor-appearance-comparison__text"><strong>幻化外观</strong><span>{cell.appearance?.nameCn ?? '未知外观（原值保留）'}</span><small>外观 ID <b className="armor-appearance-comparison__data">{cell.appearanceId}</b> · 仅改变显示</small></div></div>
    <p className="armor-appearance-comparison__note">渐变图标表示幻化部位，不是该防具的独立模型缩略图。</p>
  </section>
}
