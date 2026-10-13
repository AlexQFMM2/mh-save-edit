import type { PageResult, WeaponAttribute, WeaponCatalogFilters, WeaponKind } from './types'

/** Native catalog identity only. No P2G save equipment encoding is implied. */
export type P2gWeaponIdentity = { gameId: 'mhp2g'; weaponKey: string }
export type P2gWeaponType = {
  typeId: number
  nativeClassId: number
  nameCn: string
  nameEn: string
  kind: Extract<WeaponKind, 'standardMelee' | 'huntingHorn' | 'gunlance' | 'bowgun' | 'bow'>
  sortOrder: number
}
export type P2gWeaponSummary = P2gWeaponIdentity & {
  nativeTable: 'weapon_blademaster' | 'weapon_ranged'
  nativeIndex: number
  typeId: number
  typeNameCn: string
  typeNameEn: string
  kind: P2gWeaponType['kind']
  nameCn: string
  nameJp: string
  nameEn: string
  rarity: number
  displayAttack: number
  trueRawAttack: number
  /** The unmodified native affinity; sharpness never overwrites this value. */
  affinity: number
  defense: number
  slots: number
  attributes: WeaponAttribute[]
  sharpness: { base: number[]; handicraft: number[] } | null
  isDirectlyProducible: boolean
  isFinalForm: boolean
  iconPath: string
  specialSummary?: string[]
  matchReason?: string
}
export type P2gWeaponItemLink = { gameId: 'mhp2g'; itemId: number; nameCn: string; nameJp: string; nameEn: string }
export type P2gWeaponMaterial = {
  gameId: 'mhp2g'
  itemId: number
  nameCn: string
  nameJp: string
  nameEn: string
  quantity: number
  position: number
}
export type P2gWeaponLink = P2gWeaponIdentity & { typeId: number; nameCn: string; nameJp: string; nameEn: string }
export type P2gWeaponRecipe = {
  recipeKey: string
  kind: 'production' | 'upgrade' | 'shard'
  cost: number
  materials: P2gWeaponMaterial[]
  outputs: (P2gWeaponLink & { rngModulo100Range: [number, number] | null })[]
}
export type P2gHornTiming = {
  initialSeconds: number
  repeatSeconds: number
  repeatCapSeconds: number
  repeatMode: 'extend' | 'replace'
}
export type P2gHornPerformance = {
  effectCn: string
  repeatEffectCn: string
  maestroEffectCn: string
  conditions: string[]
  precedingNoteNot: number | null
} & ({ kind: 'timed'; normal: P2gHornTiming; maestro: P2gHornTiming } | { kind: 'instant'; normal: null; maestro: null })
export type P2gHornSong = {
  patternIndex: number
  effectIndex: number
  notes: number[]
  nativePatternNewestFirst: number[]
  effectNameJp: string
  /** Legacy fields retained for older catalogs; reviewed semantics live in performance. */
  duration: null
  repeatEffect: null
  skillDuration: null
  performance?: P2gHornPerformance
}
export type P2gWeaponSpecial =
  | { kind: 'standardMelee' }
  | { kind: 'gunlance'; shelling: { typeJa: string; level: number } }
  | { kind: 'huntingHorn'; notes: number[]; songs: P2gHornSong[] }
  | { kind: 'bowgun'; weaponKind: 'light' | 'heavy'; reloadRaw: number; recoilRaw: number; ammo: { ammoIndex: number; code: string; item?: P2gWeaponItemLink | null; available: boolean; capacityTemplate: number; loadQuantity: number | null }[]; rapidFire: { profileIndex: number; ammoIndex: number; shots: number; damageMultiplier: number; recoilRaw: number }[] }
  | { kind: 'bow'; baseChargeCount: number; loadUpChargeCount: number; charges: { level: number; typeCode: string; shotLevel: number; available: boolean; requiresLoadUp: boolean }[]; coatingMaskRaw: number; coatings?: { item: P2gWeaponItemLink | null; nameJp: string; available: boolean }[] }
export type P2gWeaponDetail = P2gWeaponSummary & {
  nameSource: string
  nativeRowSha256: string
  raw: Record<string, number | null>
  special: P2gWeaponSpecial
  recipes: P2gWeaponRecipe[]
  parents: P2gWeaponLink[]
  children: P2gWeaponLink[]
}
export type P2gWeaponFilters = Omit<WeaponCatalogFilters, 'gameId' | 'sort' | 'sharpnessStage' | 'includeHiddenAttributes' | 'includePlaceholders'> & {
  gameId: 'mhp2g'
  sort?: 'nativeId' | Exclude<NonNullable<WeaponCatalogFilters['sort']>, 'saveId'>
  sharpnessStage?: 'base' | 'handicraft1'
}
export type P2gWeaponFacets = {
  weaponTypes: P2gWeaponType[]
  attributes: Pick<WeaponAttribute, 'attributeId' | 'kind' | 'nameCn' | 'nameEn' | 'isHidden'>[]
  rarities: number[]
  slots: number[]
  sharpnessStages: ('base' | 'handicraft1')[]
}
export type P2gWeaponTree = {
  gameId: 'mhp2g'
  weaponTypeId: number
  dataVersion: string
  nodes: (P2gWeaponSummary & { isCrossType: boolean })[]
  edges: { parentWeaponKey: string; childWeaponKey: string; branchOrder: number; isCrossType: boolean }[]
}
export type P2gWeaponPage = PageResult<P2gWeaponSummary>
