import type { ItemSummary } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import './ItemListRow.css'

type ItemListRowProps = { item: ItemSummary; selected: boolean; onSelect: (saveId: number) => void }
export function ItemListRow({ item, selected, onSelect }: ItemListRowProps) {
  return <button className="item-list-row" type="button" aria-pressed={selected} onClick={() => onSelect(item.saveId)}>
    <CatalogIcon path={item.iconPath} name={item.nameCn} />
    <span className="item-list-row__identity"><strong>{item.nameCn}</strong><small>{item.nameEn || '—'}</small></span>
    <span className="item-list-row__stat"><small>RARE</small>{item.rarity ?? '—'}</span>
    <span className="item-list-row__stat"><small>持有</small>{item.maxStack ?? '—'}</span>
  </button>
}
