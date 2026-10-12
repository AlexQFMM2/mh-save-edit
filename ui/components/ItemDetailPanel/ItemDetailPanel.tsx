import { itemNumber } from '../../../api/catalog/itemIdentity'
import type { ArmorRelationTarget, CatalogItemDetail, ItemIdentity, ItemRelation, MonsterRelationTarget, PalicoEquipmentRelationTarget, QuestRelationTarget, WeaponRelationTarget } from '../../../api/catalog/types'
import { useSearchParams } from 'react-router-dom'
import { itemTranslationSourceLabel } from '../../utils/itemTerminologyPresentation'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { ItemRelationSection } from '../ItemRelationSection/ItemRelationSection'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { DetailActionBar } from '../DetailActionBar/DetailActionBar'
import './ItemDetailPanel.css'

type ItemDetailPanelProps = { item: CatalogItemDetail | null; loading: boolean; error?: string; allowCatalogWrite?: boolean; onSelectItem?: (saveId: number) => void; onSelectCatalogItem?: (identity: ItemIdentity) => void; onSelectPending?: (target: NonNullable<ItemRelation['pendingTarget']>) => void; onSelectDecoration?: (saveId: number) => void; onSelectWeapon?: (weapon: WeaponRelationTarget) => void; onSelectArmor?: (armor: ArmorRelationTarget) => void; onSelectMonster?: (monster: MonsterRelationTarget) => void; onSelectQuest?: (quest: QuestRelationTarget) => void; onSelectPalicoEquipment?: (equipment: PalicoEquipmentRelationTarget) => void }
const sections = [
  ['combination','调合'], ['shop','商店购买'], ['monster','怪物获取'], ['location','地图采集'], ['quest','任务奖励'], ['exchange','山菜爷'],
  ['weapon','武器用途'], ['armor','防具用途'], ['decoration','装饰珠用途'], ['palico-weapon','猫武器用途'], ['palico-armor','猫防具用途'], ['kinsect','猎虫用途'],
] as const
// P2G color commands stay in the source for the later patch, not in readable text.
const p2gDescription = (text: string) => text.replace(/~C[0-9A-F]{2}/g, '')

export function ItemDetailPanel({ item, loading, error, allowCatalogWrite = true, onSelectItem, onSelectCatalogItem, onSelectPending, onSelectDecoration, onSelectWeapon, onSelectArmor, onSelectMonster, onSelectQuest, onSelectPalicoEquipment }: ItemDetailPanelProps) {
  const [params, setParams] = useSearchParams()
  const selectRelatedItem = (saveId: number) => { if (onSelectItem) { onSelectItem(saveId); return }; const next = new URLSearchParams(params); next.set('item', String(saveId)); setParams(next) }
  if (loading) return <aside className="item-detail-panel item-detail-panel--state" aria-live="polite">正在读取详细资料…</aside>
  if (error) return <aside className="item-detail-panel item-detail-panel--state" role="alert">{error}</aside>
  if (!item) return <aside className="item-detail-panel item-detail-panel--state">从左侧选择一个道具查看详情。</aside>
  const grouped = new Map<string, ItemRelation[]>(); for (const relation of item.relations) grouped.set(relation.sourceKind, [...(grouped.get(relation.sourceKind) ?? []), relation])
  return <aside className="item-detail-panel" aria-label={`${item.nameCn}详情`}>
    <div className="item-detail-panel__scroll">
      <header className="item-detail-panel__header"><CatalogIcon path={item.iconPath} name={item.nameCn} size="large" /><div><small>{item.gameId === 'mhp2g' ? `道具编号 ${item.itemId}` : `道具 #${item.saveId} · 0x${item.hexId ?? item.saveId.toString(16).padStart(4,'0')}`}</small><h2>{item.nameCn}</h2><p>{item.nameEn || (item.gameId === 'mhp2g' ? '英文名：未知' : '')}</p>{item.nameJp && <p>{item.nameJp}</p>}</div></header>
      {item.terminology && item.terminology.originalName !== item.nameCn && <p className="item-detail-panel__translation">原译名：{item.terminology.originalName} · 当前采用：{itemTranslationSourceLabel(item.terminology.source)}</p>}
      {item.localization && (!item.terminology || item.terminology.originalName === item.nameCn) && <p className="item-detail-panel__translation">名称来源：{itemTranslationSourceLabel(item.localization.nameSource)}</p>}
      {item.localization?.descriptionPending && <p className="item-detail-panel__translation">日文说明</p>}
      {item.description && <p className="item-detail-panel__description">{item.gameId === 'mhp2g' ? p2gDescription(item.description) : item.description}</p>}
      {item.gameId === 'mhp2g' && item.localization?.descriptionJp && !item.localization.descriptionPending && <details className="item-detail-panel__original" key={item.itemId}>
        <summary className="item-detail-panel__original-toggle">查看日文说明</summary>
        <p className="item-detail-panel__description" lang="ja">{p2gDescription(item.localization.descriptionJp)}</p>
      </details>}
      <dl className="item-detail-panel__stats"><div><dt>稀有度</dt><dd>{item.rarity ?? '—'}</dd></div><div><dt>持有上限</dt><dd>{item.maxStack ?? '—'}</dd></div><div><dt>买入</dt><dd>{item.buyPrice == null ? '—' : `${item.buyPrice} z`}</dd></div><div><dt>卖出</dt><dd>{item.sellPrice == null ? '—' : `${item.sellPrice} z`}</dd></div></dl>
      {item.decoration&&onSelectDecoration&&<button type="button" className="item-detail-panel__decoration-link" onClick={()=>onSelectDecoration(item.decoration!.itemId)}>查看装饰品详情与技能</button>}
      <div className="item-detail-panel__relations">{sections.map(([kind,title]) => <ItemRelationSection key={`${itemNumber(item)}-${kind}`} title={title} relations={grouped.get(kind) ?? []} onSelectItem={selectRelatedItem} onSelectCatalogItem={onSelectCatalogItem} onSelectPending={onSelectPending} onSelectDecoration={onSelectDecoration} onSelectWeapon={onSelectWeapon} onSelectArmor={onSelectArmor} onSelectMonster={onSelectMonster} onSelectQuest={onSelectQuest} onSelectPalicoEquipment={onSelectPalicoEquipment} />)}</div>
    </div>
    {allowCatalogWrite && item.gameId !== 'mhp2g' && <DetailActionBar className="item-detail-panel__actions"><CatalogWriteControl gameId={item.gameId} kind="item" saveId={item.saveId} maxCount={item.maxStack} /></DetailActionBar>}
  </aside>
}
