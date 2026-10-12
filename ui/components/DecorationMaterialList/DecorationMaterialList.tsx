import type { DecorationMaterial } from '../../../api/catalog/types'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import { DetailSection } from '../DetailSection/DetailSection'
import './DecorationMaterialList.css'
export function DecorationMaterialList({ materials, onSelectMaterial }: { materials: DecorationMaterial[]; onSelectMaterial?: (material: DecorationMaterial) => void }) {
  if(!materials.length)return <DetailSection title="制作材料" className="decoration-material-list"><p className="decoration-material-list__empty">没有收录制作材料。</p></DetailSection>
  const recipes=new Map<number,DecorationMaterial[]>()
  for(const m of materials)recipes.set(m.recipeIndex,[...(recipes.get(m.recipeIndex)??[]),m])
  return <DetailSection title="制作材料" className="decoration-material-list"><div className="decoration-material-list__recipes">{[...recipes].map(([recipe,list])=><div key={recipe} className="decoration-material-list__recipe">
    {recipes.size>1&&<h4 className="decoration-material-list__title">配方 {recipe}</h4>}
    {list.map((m,i)=><button className="decoration-material-list__material" type="button" key={`${itemNumber(m)}-${i}`} onClick={()=>onSelectMaterial?.(m)}><span className="decoration-material-list__name">{m.nameCn}<small className="decoration-material-list__secondary">{m.nameJp||m.nameEn}</small></span><strong className="decoration-material-list__quantity">×{m.quantity}</strong></button>)}
  </div>)}</div></DetailSection>
}
