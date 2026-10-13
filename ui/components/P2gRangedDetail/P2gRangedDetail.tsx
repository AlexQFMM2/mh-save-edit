import { useState } from 'react'
import type { ItemIdentity } from '../../../api/catalog/types'
import type { P2gWeaponSpecial } from '../../../api/catalog/p2gWeaponTypes'
import { p2gRapidRecoilLabels, p2gRecoilLabels, p2gReloadLabels } from '../../../api/catalog/p2gWeaponPresentation'
import { DetailSection } from '../DetailSection/DetailSection'
import { DetailStatGrid } from '../DetailStatGrid/DetailStatGrid'
import './P2gRangedDetail.css'

type Props = { special: Extract<P2gWeaponSpecial, { kind: 'bow' | 'bowgun' }>; onSelectItem?: (identity: ItemIdentity) => void }
const shotNames: Record<string, string> = { rapid: '连射', pierce: '贯通', scatter: '扩散' }
export function P2gRangedDetail({ special, onSelectItem }: Props) {
  const [showUnavailable, setShowUnavailable] = useState(false)
  if (special.kind === 'bow') return <DetailSection title="蓄力与瓶" className="p2g-ranged-detail">
    <DetailStatGrid items={[{ label: '基础蓄力上限', value: `${special.baseChargeCount} 段` }, { label: '装填数 UP 后', value: `${special.loadUpChargeCount} 段` }]} />
    <ul className="p2g-ranged-detail__rows">{special.charges.map(c => <li className="p2g-ranged-detail__row" key={c.level}><span className="p2g-ranged-detail__label">蓄力 {c.level}</span><span className="p2g-ranged-detail__data">{shotNames[c.typeCode] || c.typeCode} Lv.{c.shotLevel}</span><small className="p2g-ranged-detail__hint">{!c.available ? '不可用' : c.requiresLoadUp ? '需要装填数 UP' : '基础可用'}</small></li>)}</ul>
    <h4 className="p2g-ranged-detail__heading">可用瓶</h4>
    <ul className="p2g-ranged-detail__rows">{special.coatings?.map(c => <li className="p2g-ranged-detail__row" key={c.nameJp}><button className="p2g-ranged-detail__link" type="button" disabled={!c.item || !onSelectItem} onClick={() => c.item && onSelectItem?.(c.item)}>{c.item?.nameCn || c.nameJp}</button><span className="p2g-ranged-detail__hint">{c.available ? '可用' : '不可用'}</span></li>)}</ul>
  </DetailSection>
  const visible = special.ammo.filter(a => a.available || showUnavailable)
  return <DetailSection title={special.weaponKind === 'light' ? '装填与速射' : '装填与弹种'} className="p2g-ranged-detail">
    <DetailStatGrid items={[{ label: '装填速度', value: p2gReloadLabels[special.reloadRaw] || `未知（${special.reloadRaw}）` }, { label: '反动', value: p2gRecoilLabels[special.recoilRaw] || `未知（${special.recoilRaw}）` }]} />
    <label className="p2g-ranged-detail__check"><input type="checkbox" checked={showUnavailable} onChange={e => setShowUnavailable(e.target.checked)} />显示不可装填弹种</label>
    <ul className="p2g-ranged-detail__rows">{visible.map(a => <li className="p2g-ranged-detail__ammo" key={a.ammoIndex}>
      <div className="p2g-ranged-detail__row"><button className="p2g-ranged-detail__link" type="button" disabled={!a.item || !onSelectItem} onClick={() => a.item && onSelectItem?.(a.item)}>{a.item?.nameCn || a.code}</button><span className="p2g-ranged-detail__data">{a.available ? `${a.loadQuantity ?? '未知'} 发` : '不可装填'}</span></div>
      {!a.available && <small className="p2g-ranged-detail__hint">容量模板 {a.capacityTemplate}；需另行满足追加弹种技能</small>}
      {special.rapidFire.filter(r => r.ammoIndex === a.ammoIndex).map(r => <small className="p2g-ranged-detail__rapid" key={r.profileIndex}>速射 <span className="p2g-ranged-detail__data">{r.shots} 发 · 每发 ×{r.damageMultiplier}</span> · 反动{p2gRapidRecoilLabels[r.recoilRaw] || '未知'}</small>)}
    </li>)}</ul>
  </DetailSection>
}
