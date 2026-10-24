import type { P3ItemCategory, P3QuantityKind } from '../../api/catalog/p3ItemTypes'
export const p3ItemCategories: Record<P3ItemCategory,string> = { general:'一般道具',ammo:'弹药',coating:'瓶类',decoration:'装饰品' }
export const p3QuantityKinds: Record<P3QuantityKind,string> = { count:'普通数量',infinite:'无限弹量','reusable-cooldown':'重复使用（有冷却）',internal:'内部占位' }
export const p3QuantityLabel = (kind: P3QuantityKind, count: number | null) => kind === 'count' ? String(count ?? '—') : p3QuantityKinds[kind]
