import type { ItemIdentity, P3ItemDetail } from '../../../api/catalog/types'
import { p3ItemCategories } from '../../utils/p3ItemPresentation'
import { ItemSkillTags } from '../ItemSkillTags/ItemSkillTags'
import './P3ItemDetails.css'

export function P3ItemDetails({ item, onSelectItem }: { item: P3ItemDetail; onSelectItem?: (identity: ItemIdentity) => void }) {
  const combination = item.relations.some(r => r.sourceKind === 'combination')
  const usage = item.relations.some(r => r.usageKind === 'decoration')
  return <section className="p3-item-details" aria-label="P3 道具资料">
    <p className="p3-item-details__note">分类：{p3ItemCategories[item.p3.category]}</p>
    <ItemSkillTags decoration={item.p3.decoration} />
    {item.p3.recipes.length > 0 && <section className="p3-item-details__recipes" aria-label="装饰品制作材料">
      <h3 className="p3-item-details__heading">装饰品制作材料</h3>
      <p className="p3-item-details__note">各路线可择一制作，出现条件与加工费用尚未收录。</p>
      {item.p3.recipes.map((recipe,index) => <div className="p3-item-details__recipe" key={recipe.index}>
        <strong className="p3-item-details__route">路线 {index+1}</strong>
        {recipe.materials.map(material => <button className="p3-item-details__material" type="button" key={material.itemId} disabled={!onSelectItem} onClick={() => onSelectItem?.(material)}>
          <span className="p3-item-details__name">{material.nameCn}<ItemSkillTags decoration={material.p3Decoration}/></span><span className="p3-item-details__quantity">× {material.quantity}</span>
        </button>)}
      </div>)}
    </section>}
    <details className="p3-item-details__coverage">
      <summary className="p3-item-details__coverage-toggle">资料收录范围</summary>
      <p className="p3-item-details__note">调合表、装饰品制作材料已收录。{!combination && '已确认不涉及本作调合表。'}{!usage && '已确认不用于本作装饰品制作。'}</p>
      {item.p3.coverage.armor==='complete'&&<p className="p3-item-details__note">防具制作材料已收录。{!item.p3.armorRecipes?.length&&'已确认不用于本作防具制作表。'}</p>}
      <p className="p3-item-details__note">商店仅展示已确认的商品与价格；未列出不代表没有出售。解锁条件、采集、掉落、任务奖励、交换及{item.p3.coverage.armor==='complete'?'武器等其他装备用途':'其他装备用途'}尚未收录。</p>
    </details>
  </section>
}
