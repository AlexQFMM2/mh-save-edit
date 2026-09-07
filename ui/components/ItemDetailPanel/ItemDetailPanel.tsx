import type { ItemDetail, ItemRelation, WeaponRelationTarget } from '../../../api/catalog/types'
import { useSearchParams } from 'react-router-dom'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { ItemRelationSection } from '../ItemRelationSection/ItemRelationSection'
import './ItemDetailPanel.css'

type ItemDetailPanelProps = { item: ItemDetail | null; loading: boolean; error?: string; onSelectItem?: (saveId: number) => void; onSelectDecoration?: (saveId: number) => void; onSelectWeapon?: (weapon: WeaponRelationTarget) => void }
const sections = [
  ['combination','调合'], ['monster','怪物获取'], ['location','地图采集'], ['quest','任务奖励'], ['exchange','山菜爷'],
  ['weapon','武器用途'], ['armor','防具用途'], ['decoration','装饰珠用途'], ['palico-weapon','猫武器用途'], ['palico-armor','猫防具用途'], ['kinsect','猎虫用途'],
] as const

export function ItemDetailPanel({ item, loading, error, onSelectItem, onSelectDecoration, onSelectWeapon }: ItemDetailPanelProps) {
  const [params, setParams] = useSearchParams()
  const selectRelatedItem = (saveId: number) => { if (onSelectItem) { onSelectItem(saveId); return }; const next = new URLSearchParams(params); next.set('item', String(saveId)); setParams(next) }
  if (loading) return <aside className="item-detail-panel item-detail-panel--state" aria-live="polite">正在读取详细资料…</aside>
  if (error) return <aside className="item-detail-panel item-detail-panel--state" role="alert">{error}</aside>
  if (!item) return <aside className="item-detail-panel item-detail-panel--state">从左侧选择一个道具查看详情。</aside>
  const grouped = new Map<string, ItemRelation[]>(); for (const relation of item.relations) grouped.set(relation.sourceKind, [...(grouped.get(relation.sourceKind) ?? []), relation])
  return <aside className="item-detail-panel" aria-label={`${item.nameCn}详情`}>
    <header className="item-detail-panel__header"><CatalogIcon path={item.iconPath} name={item.nameCn} size="large" /><div><small>道具 #{item.saveId} · 0x{item.hexId ?? item.saveId.toString(16).padStart(4,'0')}</small><h2>{item.nameCn}</h2><p>{item.nameEn}</p>{item.nameJp && <p>{item.nameJp}</p>}</div></header>
    <dl className="item-detail-panel__stats"><div><dt>稀有度</dt><dd>{item.rarity ?? '—'}</dd></div><div><dt>持有上限</dt><dd>{item.maxStack ?? '—'}</dd></div><div><dt>买入</dt><dd>{item.buyPrice == null ? '—' : `${item.buyPrice} z`}</dd></div><div><dt>卖出</dt><dd>{item.sellPrice == null ? '—' : `${item.sellPrice} z`}</dd></div></dl>
    <div className="item-detail-panel__relations">{sections.map(([kind,title]) => <ItemRelationSection key={`${item.saveId}-${kind}`} title={title} relations={grouped.get(kind) ?? []} onSelectItem={selectRelatedItem} onSelectDecoration={onSelectDecoration} onSelectWeapon={onSelectWeapon} />)}</div>
  </aside>
}
