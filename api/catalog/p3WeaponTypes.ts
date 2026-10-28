import type { PageResult, WeaponAttribute, WeaponCatalogFilters, WeaponKind } from './types'
import type { P3ItemLink } from './p3ItemTypes'

/** Content identity only; no save or Dex identity is implied. */
export type P3WeaponIdentity = { gameId: 'mhp3'; weaponKey: string }
export type P3WeaponScope = 'obtainable' | 'special' | 'unknown' | 'all'
export type P3WeaponType = { nativeType: number; typeId: number; nameCn: string; nameEn: string; kind: Extract<WeaponKind, 'standardMelee' | 'gunlance' | 'huntingHorn' | 'bowgun' | 'bow'> | 'switchAxe'; sortOrder: number }
export type P3WeaponSummary = P3WeaponIdentity & {
  nativeType: number; nativeId: number; typeId: number; typeNameCn: string; typeNameEn: string; kind: P3WeaponType['kind']
  nameCn: string; nameJp: string; nameEn: string; rarity: number; displayAttack: number; trueRawAttack: number
  affinity: number; defense: number; slots: number; attributes: WeaponAttribute[]
  sharpness: { base: number[]; handicraft: number[] } | null
  isDirectlyProducible: boolean; isFinalForm: boolean; iconPath: string; acquisitionStatus: Exclude<P3WeaponScope, 'all'>
  specialSummary?: string[]; matchReason?: string
}
export type P3WeaponLink = P3WeaponIdentity & Pick<P3WeaponSummary, 'typeId' | 'nameCn' | 'nameJp' | 'nameEn'>
export type P3WeaponMaterial = P3ItemLink & { quantity: number | null; position: number }
export type P3WeaponRecipe = {
  recipeKey: string; kind: 'production' | 'upgrade' | 'appraisal'; cost: number | null; source: string
  weapon: P3WeaponLink; materials: P3WeaponMaterial[]; byproducts: P3WeaponMaterial[]
}
export type P3HornTiming = { seconds: number; maestroSeconds: number; mode: 'extend' | 'replace' }
export type P3HornSong = {
  songKey: string; notes: string[]; effectCn: string; repeatEffectCn: string | null; notesCn: string
  duration: P3HornTiming | null; repeatDuration: P3HornTiming | null; source: string
}
export type P3WeaponSpecial = { source: string } & (
  | { kind: 'standardMelee' }
  | { kind: 'switchAxe'; phialName: string; phialValue: number | null; swordAttributeValue: number | null }
  | { kind: 'gunlance'; shellingType: string; level: number }
  | { kind: 'huntingHorn'; notes: string[]; songs: P3HornSong[] }
  | { kind: 'bowgun'; weaponKind: 'light' | 'heavy'; reload: string; recoil: string; deviation: string
      ammo: { itemId: number; item?: P3ItemLink; available: boolean; requiresSkill: boolean; capacity: number | null; skillCapacity: number | null }[]
      rapidFire: { itemId: number; item?: P3ItemLink; shots: number; recoil: string; multiplierText: string | null }[]
      crouchFire: { itemId: number; item?: P3ItemLink; capacity: number }[]
      attachments: { kind: 'barrel' | 'silencer' | 'shield' | 'scope'; name: string; cost: number; baseAttack: number; boostedAttack: number; effect: string }[] }
  | { kind: 'bow'; arcType: string; charges: { level: number; typeCode: string | null; shotLevel: number | null; available: boolean; requiresLoadUp: boolean }[]
      coatings: { itemId: number; item?: P3ItemLink; available: boolean; enhanced: boolean }[] }
)
export type P3WeaponDetail = P3WeaponSummary & {
  nameSource: string; aliases: string[]; acquisition: string; acquisitionSource: string; nativeRowSha256: string
  boost: { attack: number; cost: number; material: { itemId: number; quantity: number; item?: P3ItemLink } }
  fieldSources: Record<string, string>; special: P3WeaponSpecial
  recipes: P3WeaponRecipe[]; parents: P3WeaponLink[]; children: P3WeaponLink[]
}
export type P3WeaponFilters = Omit<WeaponCatalogFilters, 'gameId' | 'sort' | 'sharpnessStage' | 'includeHiddenAttributes' | 'includePlaceholders'> & {
  gameId: 'mhp3'; scope?: P3WeaponScope
  sort?: 'nativeId' | Exclude<NonNullable<WeaponCatalogFilters['sort']>, 'saveId'>; sharpnessStage?: 'base' | 'handicraft1'
}
export type P3WeaponFacets = {
  weaponTypes: P3WeaponType[]; attributes: Pick<WeaponAttribute, 'attributeId' | 'kind' | 'nameCn' | 'nameEn' | 'isHidden'>[]
  rarities: number[]; slots: number[]; sharpnessStages: ('base' | 'handicraft1')[]
}
export type P3WeaponTree = {
  gameId: 'mhp3'; weaponTypeId: number; dataVersion: string; nodes: (P3WeaponSummary & { isCrossType: boolean })[]
  edges: { parentWeaponKey: string; childWeaponKey: string; branchOrder: number; isCrossType: boolean }[]
}
export type P3WeaponPage = PageResult<P3WeaponSummary>
export type P3ItemWeaponUsage = { weapon: P3WeaponLink; role: 'boost' | 'ammo' | 'coating'; requiresSkill: boolean }
