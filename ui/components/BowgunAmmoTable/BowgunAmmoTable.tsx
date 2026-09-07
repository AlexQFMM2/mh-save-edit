import type { BowgunAmmoRow } from '../../../api/catalog/types'
import './BowgunAmmoTable.css'

export function BowgunAmmoTable({ rows, title = '弹种', onSelectItem }: { rows: BowgunAmmoRow[]; title?: string; onSelectItem?: (saveId: number) => void }) {
  if (!rows.length) return null
  return <section className="bowgun-ammo-table"><h3>{title}</h3><div className="bowgun-ammo-table__scroll"><table><thead><tr><th>名称</th><th>装填</th><th>追加</th><th>动作</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.itemDexId}-${index}`}><td>{row.itemSaveId != null && onSelectItem ? <button type="button" onClick={() => onSelectItem(row.itemSaveId!)}>{row.nameCn}</button> : row.nameCn}<small>{row.nameEn}</small></td><td>{row.loadQuantity}</td><td>{row.loadQuantityPlus ?? '—'}</td><td>{actionLabel(row)}</td></tr>)}</tbody></table></div></section>
}
function actionLabel(row: BowgunAmmoRow): string { return row.actionKind === 'rapid-fire' ? `速射${row.specialFireQuantity ? ` ×${row.specialFireQuantity}` : ''}` : row.actionKind === 'siege-fire' ? `蹲射${row.specialFireQuantity ? ` ×${row.specialFireQuantity}` : ''}` : row.actionKind === 'coating' ? '瓶' : '普通' }
