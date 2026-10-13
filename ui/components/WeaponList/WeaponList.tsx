import type { CatalogGameId } from '../../../api/catalog/types'
import type { CatalogWeaponSummary } from '../../utils/catalogWeapon'
import type { SharpnessStage, WeaponKind } from '../../../api/catalog/types'
import { WeaponListColumns } from '../WeaponListColumns/WeaponListColumns'
import { WeaponListRow } from '../WeaponListRow/WeaponListRow'
import './WeaponList.css'

type Props = { mode?: 'browse' | 'select'; gameId: CatalogGameId; items: CatalogWeaponSummary[]; selectedKey?: string; selectedKind?: WeaponKind; sharpnessStage: SharpnessStage; loading: boolean; error?: string; onSelect: (weaponKey: string) => void }

export function WeaponList(props: Props) {
  if (props.loading && !props.items.length) return <div className="weapon-list__state" role="status">正在检索武器资料…</div>
  if (props.error) return <div className="weapon-list__state weapon-list__state--error" role="alert">{props.error}</div>
  if (!props.items.length) return <div className="weapon-list__state">没有符合当前条件的武器。</div>
  return <div className={`weapon-list${props.selectedKind ? ' weapon-list--typed' : ''}`}>
    <WeaponListColumns nativeIdentity={props.gameId === 'mhp2g'} kind={props.selectedKind} />
    <div className="weapon-list__rows" role="listbox" aria-label={props.mode === 'select' ? '选择武器候选' : '武器列表'} aria-busy={props.loading}>{props.items.map((item) => <WeaponListRow key={item.weaponKey} gameId={props.gameId} item={item} selected={item.weaponKey === props.selectedKey} selectedKind={props.selectedKind} sharpnessStage={props.sharpnessStage} onSelect={props.onSelect} />)}</div>
  </div>
}
