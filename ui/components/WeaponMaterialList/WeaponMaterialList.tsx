import type { WeaponMaterial } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './WeaponMaterialList.css'

export function WeaponMaterialList({ materials, productionPrice, upgradePrice, onSelectItem }: { materials: WeaponMaterial[]; productionPrice: number | null; upgradePrice: number | null; onSelectItem?: (saveId: number) => void }) {
  const groups = [['production', '生产材料', productionPrice], ['upgrade', '强化材料', upgradePrice]] as const
  return <DetailSection title="制作方式" className="weapon-material-list">{groups.map(([kind, label, price]) => {
    const rows = materials.filter((material) => material.kind === kind)
    if (!rows.length && price == null) return null
    return <div key={kind} className="weapon-material-list__group"><header><strong>{label}</strong><span>{price == null ? '价格未收录' : `${price} z`}</span></header>{rows.length ? rows.map((material, index) => <button type="button" key={`${material.saveId}-${index}`} onClick={() => onSelectItem?.(material.saveId)}><span>{material.nameCn}<small>{material.nameEn}</small></span><strong>×{material.quantity}</strong></button>) : <p>未收录材料</p>}</div>
  })}</DetailSection>
}
