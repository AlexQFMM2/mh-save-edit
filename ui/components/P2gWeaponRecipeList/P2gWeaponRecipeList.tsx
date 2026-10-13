import type { ItemIdentity } from '../../../api/catalog/types'
import type { P2gWeaponLink, P2gWeaponRecipe } from '../../../api/catalog/p2gWeaponTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gWeaponRecipeList.css'

type Props = { recipes: P2gWeaponRecipe[]; showOutputs?: boolean; onSelectItem?: (identity: ItemIdentity) => void; onSelectWeapon?: (weapon: P2gWeaponLink) => void }
const kinds = { production: '生产', upgrade: '强化', shard: '锈块鉴定' }
export function P2gWeaponRecipeList({ recipes, showOutputs = false, onSelectItem, onSelectWeapon }: Props) {
  if (!recipes.length) return null
  const body = <>{recipes.map((recipe, index) => <section className="p2g-weapon-recipe-list__recipe" key={recipe.recipeKey} aria-label={`${kinds[recipe.kind]}配方 ${index + 1}`}>
      <h4 className="p2g-weapon-recipe-list__heading">{kinds[recipe.kind]}配方 {recipes.filter(r => r.kind === recipe.kind).findIndex(r => r.recipeKey === recipe.recipeKey) + 1}<span className="p2g-weapon-recipe-list__data">{recipe.cost.toLocaleString()} z</span></h4>
      {recipe.kind === 'production' && recipes.filter(r => r.kind === 'production').length > 1 && <p className="p2g-weapon-recipe-list__hint">任选一组材料</p>}
      <ul className="p2g-weapon-recipe-list__materials">{recipe.materials.map(m => <li className="p2g-weapon-recipe-list__row" key={m.position}><button className="p2g-weapon-recipe-list__link" type="button" disabled={!onSelectItem} onClick={() => onSelectItem?.({ gameId: 'mhp2g', itemId: m.itemId })}>{m.nameCn || m.nameJp}</button><span className="p2g-weapon-recipe-list__data">× {m.quantity}</span></li>)}</ul>
      {(showOutputs || recipe.kind === 'shard') && <ul className="p2g-weapon-recipe-list__outputs">{recipe.outputs.map(o => <li className="p2g-weapon-recipe-list__output" key={o.weaponKey}><button className="p2g-weapon-recipe-list__link" type="button" disabled={!onSelectWeapon} onClick={() => onSelectWeapon?.(o)}>{o.nameCn || o.nameJp}</button>{o.rngModulo100Range && <small className="p2g-weapon-recipe-list__hint">取模 100 区间 <span className="p2g-weapon-recipe-list__data">{o.rngModulo100Range.join('–')}</span> · 概率未知</small>}</li>)}</ul>}
    </section>)}</>
  return showOutputs
    ? <details className="p2g-weapon-recipe-list"><summary className="p2g-weapon-recipe-list__toggle">武器用途与配方（{recipes.length}）</summary><div className="p2g-weapon-recipe-list__body">{body}</div></details>
    : <DetailSection title="制作与强化" className="p2g-weapon-recipe-list">{body}</DetailSection>
}
