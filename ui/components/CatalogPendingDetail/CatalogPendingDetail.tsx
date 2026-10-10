import type { ItemRelation } from '../../../api/catalog/types'
import './CatalogPendingDetail.css'
export type PendingCatalogTarget = NonNullable<ItemRelation['pendingTarget']>
const names = { weapon:'武器', armor:'防具', decoration:'装饰品', monster:'怪物', quest:'任务' }
export function CatalogPendingDetail({ target }: { target: PendingCatalogTarget }) {
  return <div className="catalog-pending-detail"><p className="catalog-pending-detail__kind">{names[target.kind]}</p><h2 className="catalog-pending-detail__name">{target.name}</h2><p className="catalog-pending-detail__status" role="status">资料完善中</p></div>
}
