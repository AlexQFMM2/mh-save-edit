import type { WeaponKind } from '../../../api/catalog/types'
import './WeaponListColumns.css'

export function weaponSpecialColumnLabel(kind?: WeaponKind): string {
  if (!kind) return '类型'
  if (kind === 'huntingHorn') return '斩味 / 音色'
  if (kind === 'gunlance') return '斩味 / 炮击'
  if (kind === 'phialWeapon') return '斩味 / 瓶'
  if (kind === 'insectGlaive') return '斩味 / 猎虫'
  if (kind === 'bowgun') return '弩属性 / 特殊弹'
  if (kind === 'bow') return '蓄力 / 瓶'
  return '斩味'
}

export function WeaponListColumns({ kind, nativeIdentity }: { kind?: WeaponKind; nativeIdentity?: boolean }) {
  return <div className="weapon-list-columns" aria-hidden="true"><span>武器名称</span><span>稀有</span><span>攻击</span><span>属性</span><span>{nativeIdentity ? '原始会心' : '会心'}</span><span>孔</span><span>生产</span><span>{weaponSpecialColumnLabel(kind)}</span></div>
}
