import type { P2gArmorLink, P2gArmorRecipe } from '../../../api/catalog/p2gArmorTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gArmorRecipeList.css'

type Props = { recipes: P2gArmorRecipe[]; showOutputs?: boolean; onSelectItem?: (id:number)=>void; onSelectArmor?: (armor:P2gArmorLink)=>void }
export function P2gArmorRecipeList({recipes,showOutputs=false,onSelectItem,onSelectArmor}:Props) {
  if(!recipes.length)return null
  const content=<div className="p2g-armor-recipe-list__body">{recipes.map((r,i)=><section className="p2g-armor-recipe-list__recipe" key={r.recipeKey} aria-label={`制作配方 ${i+1}`}>
    <h4 className="p2g-armor-recipe-list__heading">制作配方 {i+1}<span className="p2g-armor-recipe-list__data">{r.cost.toLocaleString()} z</span></h4>
    {!showOutputs&&recipes.length>1&&<p className="p2g-armor-recipe-list__hint">任选一组材料</p>}
    {showOutputs&&<button className="p2g-armor-recipe-list__link" type="button" disabled={!onSelectArmor} onClick={()=>onSelectArmor?.(r.armor)}>{r.armor.nameCn}</button>}
    <ul className="p2g-armor-recipe-list__materials">{r.materials.map(m=><li className="p2g-armor-recipe-list__material" key={m.position}><button className="p2g-armor-recipe-list__link" type="button" disabled={!onSelectItem} onClick={()=>onSelectItem?.(m.itemId)}>{m.nameCn||m.nameJp}</button><span className="p2g-armor-recipe-list__data">× {m.quantity}</span></li>)}</ul>
  </section>)}</div>
  return showOutputs?<details className="p2g-armor-recipe-list"><summary className="p2g-armor-recipe-list__toggle">防具用途与配方（{recipes.length}）</summary>{content}</details>:<DetailSection title="制作配方" className="p2g-armor-recipe-list">{content}</DetailSection>
}
