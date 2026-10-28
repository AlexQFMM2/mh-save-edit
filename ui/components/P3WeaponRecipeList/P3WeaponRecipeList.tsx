import type { ItemIdentity } from '../../../api/catalog/types'
import type { P3ItemWeaponUsage, P3WeaponLink, P3WeaponMaterial, P3WeaponRecipe } from '../../../api/catalog/p3WeaponTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import './P3WeaponRecipeList.css'

type Props = { recipes: P3WeaponRecipe[]; usages?: P3ItemWeaponUsage[]; showOutputs?: boolean; onSelectItem?: (item: ItemIdentity)=>void; onSelectWeapon?: (weapon: P3WeaponLink)=>void }
const kinds = { production:'生产',upgrade:'升级',appraisal:'鉴定' }
export function P3WeaponRecipeList({ recipes, usages = [], showOutputs = false, onSelectItem, onSelectWeapon }: Props) {
  if (!recipes.length && !usages.length) return null
  const material = (m: P3WeaponMaterial) => <li className="p3-weapon-recipe-list__row" key={m.position}><button className="p3-weapon-recipe-list__link" type="button" disabled={!onSelectItem} onClick={()=>onSelectItem?.({gameId:'mhp3',itemId:m.itemId})}>{m.nameCn || m.nameJp}</button><span className="p3-weapon-recipe-list__data">{m.quantity == null ? '数量未收录' : `× ${m.quantity}`}</span></li>
  const body = <>{recipes.map((r,i)=><section className="p3-weapon-recipe-list__recipe" key={r.recipeKey} aria-label={`${kinds[r.kind]}路线 ${i+1}`}>
    {showOutputs && <button className="p3-weapon-recipe-list__link" type="button" disabled={!onSelectWeapon} onClick={()=>onSelectWeapon?.(r.weapon)}>{r.weapon.nameCn}</button>}
    <h4 className="p3-weapon-recipe-list__heading">{kinds[r.kind]}路线 {recipes.filter(x=>x.kind===r.kind && x.weapon.weaponKey===r.weapon.weaponKey).findIndex(x=>x.recipeKey===r.recipeKey)+1}<span className="p3-weapon-recipe-list__data">{r.cost == null ? '费用未收录' : `${r.cost.toLocaleString()} z`}</span></h4>
    {recipes.filter(x=>x.kind===r.kind && x.weapon.weaponKey===r.weapon.weaponKey).length>1 && <p className="p3-weapon-recipe-list__hint">任选一条路线</p>}
    {r.kind==='appraisal' && <p className="p3-weapon-recipe-list__hint">P3 Wiki 记载的鉴定取得；结果概率未收录。</p>}
    <ul className="p3-weapon-recipe-list__materials">{r.materials.map(material)}</ul>
    {r.byproducts.length>0 && <details><summary className="p3-weapon-recipe-list__toggle">获得端材</summary><ul className="p3-weapon-recipe-list__materials">{r.byproducts.map(material)}</ul></details>}
  </section>)}
  {usages.map(u=><div className="p3-weapon-recipe-list__recipe" key={`${u.weapon.weaponKey}:${u.role}`}><button className="p3-weapon-recipe-list__link" type="button" disabled={!onSelectWeapon} onClick={()=>onSelectWeapon?.(u.weapon)}>{u.weapon.nameCn}</button><p className="p3-weapon-recipe-list__hint">{u.role==='boost'?'攻击强化材料':u.role==='ammo'?'可装填弹药':'可用瓶'}{u.requiresSkill?'（需对应追加技能）':''}</p></div>)}</>
  return showOutputs ? <details className="p3-weapon-recipe-list"><summary className="p3-weapon-recipe-list__toggle">相关武器与配方（{recipes.length+usages.length}）</summary><div className="p3-weapon-recipe-list__body">{body}</div></details> : <DetailSection title="制作、升级与取得" className="p3-weapon-recipe-list">{body}</DetailSection>
}
