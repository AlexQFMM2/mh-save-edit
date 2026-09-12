import type { DecorationDetail } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { DecorationMaterialList } from '../DecorationMaterialList/DecorationMaterialList'
import { DecorationSkillSection } from '../DecorationSkillSection/DecorationSkillSection'
import './DecorationDetailPanel.css'

export function DecorationDetailPanel({ item, loading, error, allowCatalogWrite = true, onSelectMaterial, onSelectSkill }: { item: DecorationDetail | null; loading: boolean; error?: string; allowCatalogWrite?: boolean; onSelectMaterial?: (material: DecorationDetail['materials'][number]) => void; onSelectSkill?: (skillId: number) => void }) {
  if (loading) return <aside className="decoration-detail-panel decoration-detail-panel--state" aria-live="polite">正在读取详细资料…</aside>
  if (error) return <aside className="decoration-detail-panel decoration-detail-panel--state" role="alert">{error}</aside>
  if (!item) return <aside className="decoration-detail-panel decoration-detail-panel--state">从左侧选择装饰品查看详情。</aside>
  return <aside className="decoration-detail-panel" aria-label={`${item.nameCn}详情`}><header><CatalogIcon path={item.iconPath} name={item.nameCn} size="large"/><div><small>装饰品 #{item.saveId}{item.dexIds.length ? ` · Dex ${item.dexIds.join(' / ')}` : ''}</small><h2>{item.nameCn}</h2><p>{item.nameEn}</p></div></header><dl><div><dt>孔位</dt><dd><EquipmentSlotIndicator slots={item.slots}/></dd></div><div><dt>价格</dt><dd>{item.price == null ? '—' : `${item.price} z`}</dd></div></dl>{allowCatalogWrite && item.itemSaveId != null && <CatalogWriteControl gameId={item.gameId} kind="item" saveId={item.itemSaveId} maxCount={99}/>}<div className="decoration-detail-panel__scroll"><DecorationSkillSection skills={item.skills} onSelectSkill={onSelectSkill}/><DecorationMaterialList materials={item.materials} onSelectMaterial={onSelectMaterial}/></div></aside>
}
