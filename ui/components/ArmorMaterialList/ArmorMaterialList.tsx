import type { ArmorMaterial } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './ArmorMaterialList.css'

export function ArmorMaterialList({ materials, onSelectItem }: { materials: ArmorMaterial[]; onSelectItem?: (saveId: number) => void }) {
  return <DetailSection title="制作材料" className="armor-material-list">{materials.length?<ul>{materials.map(material=><li key={`${material.saveId}-${material.quantity}`}>{onSelectItem?<button type="button" onClick={()=>onSelectItem(material.saveId)}>{material.nameCn}</button>:<span>{material.nameCn}</span>}<strong>× {material.quantity}</strong></li>)}</ul>:<p>没有收录制作材料。</p>}</DetailSection>
}
