import { ItemSkillTags } from '../ItemSkillTags/ItemSkillTags'
import { p3QuantityLabel } from '../../utils/p3ItemPresentation'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import type { CatalogItemSummary } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import './ItemListRow.css'

type ItemListRowProps = { item: CatalogItemSummary; selected: boolean; onSelect: (saveId: number) => void }
export function ItemListRow({ item, selected, onSelect }: ItemListRowProps) {
  return <button className="item-list-row" type="button" aria-pressed={selected} onClick={() => onSelect(itemNumber(item))}>
    <CatalogIcon path={item.iconPath} name={item.nameCn} />
    <span className="item-list-row__identity"><strong>{item.nameCn}</strong><small>{item.gameId === 'mhp3' ? item.nameJp : item.nameEn || (item.gameId === 'mhp2g' ? '未知' : '—')}</small>{item.gameId === 'mhp3' && <ItemSkillTags decoration={item.p3.decoration} />}{item.terminology?.matchedAlias && <span className="item-list-row__alias" title={item.terminology.matchedAlias}>命中别名：{item.terminology.matchedAlias}</span>}{item.matchReason && <span className="item-list-row__alias">{item.matchReason}</span>}</span>
    <span className="item-list-row__stat"><small>RARE</small>{item.rarity ?? '—'}</span>
    <span className="item-list-row__stat"><small>持有</small>{item.gameId === 'mhp3' ? p3QuantityLabel(item.p3.quantityKind,item.maxStack) : item.maxStack ?? '—'}</span>
  </button>
}
