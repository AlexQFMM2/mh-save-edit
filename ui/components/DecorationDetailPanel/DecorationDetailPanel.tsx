import type { DecorationDetail, ItemIdentity } from '../../../api/catalog/types'
import { decorationNumber } from '../../../api/catalog/decorationIdentity'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { DecorationMaterialList } from '../DecorationMaterialList/DecorationMaterialList'
import { DecorationSkillSection } from '../DecorationSkillSection/DecorationSkillSection'
import { P2gDecorationInfo } from '../P2gDecorationInfo/P2gDecorationInfo'
import './DecorationDetailPanel.css'

type Props = { item: DecorationDetail | null; loading: boolean; error?: string; allowCatalogWrite?: boolean; onSelectMaterial?: (material: DecorationDetail['materials'][number]) => void; onSelectSkill?: (skillId: number) => void; onSelectItem?: (item:ItemIdentity)=>void }
export function DecorationDetailPanel({ item, loading, error, allowCatalogWrite = true, onSelectMaterial, onSelectSkill, onSelectItem }: Props) {
  if (loading) return <aside className="decoration-detail-panel decoration-detail-panel--state" aria-live="polite">正在读取详细资料…</aside>
  if (error) return <aside className="decoration-detail-panel decoration-detail-panel--state" role="alert">{error}</aside>
  if (!item) return <aside className="decoration-detail-panel decoration-detail-panel--state">从左侧选择装饰品查看详情。</aside>
  const price=item.p2g?item.p2g.sellPrice:item.price
  return <aside className="decoration-detail-panel" aria-label={`${item.nameCn}详情`}>
    <header className="decoration-detail-panel__header"><CatalogIcon path={item.iconPath} name={item.nameCn} size="large"/><div>
      <small className="decoration-detail-panel__identity">{item.gameId==='mhp2g'?'道具编号':'装饰品'} #{decorationNumber(item)}{item.dexIds.length ? ` · Dex ${item.dexIds.join(' / ')}` : ''}</small>
      <h2 className="decoration-detail-panel__title">{item.nameCn}</h2><p className="decoration-detail-panel__subtitle">{item.nameJp||item.nameEn}</p>
    </div></header>
    <dl className="decoration-detail-panel__stats"><div className="decoration-detail-panel__stat"><dt className="decoration-detail-panel__label">孔位</dt><dd className="decoration-detail-panel__value"><EquipmentSlotIndicator slots={item.slots}/></dd></div><div className="decoration-detail-panel__stat"><dt className="decoration-detail-panel__label">{item.p2g?'卖出价格':'价格'}</dt><dd className="decoration-detail-panel__value">{price==null?(item.p2g?'未收录':'—'):`${price} z`}</dd></div></dl>
    {allowCatalogWrite && item.gameId === 'mhp2g' && <CatalogWriteControl gameId="mhp2g" kind="item" saveId={item.itemId} maxCount={99}/>}
    {allowCatalogWrite && item.gameId!=='mhp2g' && item.itemSaveId != null && <CatalogWriteControl gameId={item.gameId} kind="item" saveId={item.itemSaveId} maxCount={99}/>}
    <div className="decoration-detail-panel__scroll">
      <DecorationSkillSection skills={item.skills} onSelectSkill={onSelectSkill}/>
      <DecorationMaterialList materials={item.materials} onSelectMaterial={onSelectMaterial}/>
      {item.p2g&&<P2gDecorationInfo data={item.p2g}/>}
      {item.gameId==='mhp2g'&&onSelectItem&&<button type="button" className="decoration-detail-panel__item-link" onClick={()=>onSelectItem({gameId:'mhp2g',itemId:item.itemId})}>查看道具详情与获取来源</button>}
    </div>
  </aside>
}
