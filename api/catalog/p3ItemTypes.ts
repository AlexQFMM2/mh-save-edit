import type { ItemRelation } from './types'

export type P3ItemCategory = 'general' | 'ammo' | 'coating' | 'decoration'
export type P3QuantityKind = 'count' | 'infinite' | 'reusable-cooldown' | 'internal'
export type P3ItemIdentity = { gameId: 'mhp3'; itemId: number; saveId?: never }
export type P3ItemSkill = { id: number; nameCn: string; nameJp: string; nameEn: string; points: number }
export type P3ItemDecoration = { slots: number; skills: P3ItemSkill[] }
export type P3ItemInfo = { category: P3ItemCategory; quantityKind: P3QuantityKind; decoration: P3ItemDecoration | null }
export type P3ItemLink = P3ItemIdentity & { nameCn: string; nameEn: string; nameJp: string; p3Decoration?: P3ItemDecoration }
export type P3ItemRecipe = { index: number; output: P3ItemLink; materials: (P3ItemLink & { quantity: number })[] }
export type P3ItemDetailInfo = P3ItemInfo & {
  recipes: P3ItemRecipe[]
  coverage: Partial<Record<ItemRelation['sourceKind'], 'complete' | 'partial' | 'not-collected'>>
}
