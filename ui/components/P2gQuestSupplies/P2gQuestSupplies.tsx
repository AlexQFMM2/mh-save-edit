import type { P2gQuestData } from '../../../api/catalog/p2gQuestTypes'
import type { ItemIdentity } from '../../../api/catalog/types'
import { DetailSection } from '../DetailSection/DetailSection'
import './P2gQuestSupplies.css'

export function P2gQuestSupplies({ data, onSelectItem }: { data: P2gQuestData; onSelectItem: (item: ItemIdentity) => void }) {
  return <DetailSection title="支给品"><div className="p2g-quest-supplies">
    {data.supplies == null ? <p className="p2g-quest-supplies__note">支给品未收录。</p> : !data.supplies.length ? <p className="p2g-quest-supplies__note">无支给品配置。</p> : <><p className="p2g-quest-supplies__note">按原配置顺序列出每一格；到达时机以游戏内为准。</p><table className="p2g-quest-supplies__table"><thead><tr><th>格</th><th>道具</th><th>数量</th></tr></thead><tbody>{data.supplies.map((r, index) => <tr key={index}><td className="p2g-quest-supplies__data">{index + 1}</td><th><button className="p2g-quest-supplies__link" type="button" onClick={() => onSelectItem(r.item)}>{r.item.nameCn}</button></th><td className="p2g-quest-supplies__data">{r.quantity}</td></tr>)}</tbody></table></>}
  </div></DetailSection>
}
