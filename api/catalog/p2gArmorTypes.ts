import type { ArmorCatalogFilters, ArmorSetFilters, ArmorSetSummary, ArmorSkill, ArmorSummary } from './types'
import type { P2gWeaponMaterial } from './p2gWeaponTypes'

/** Read-only native identity. It is neither a Dex ID nor a save encoding. */
export type P2gArmorIdentity = { gameId: 'mhp2g'; armorKey: string }
export type P2gArmorSummary = Omit<ArmorSummary, 'gameId' | 'dexId' | 'skills'> & P2gArmorIdentity & {
  skills: (ArmorSkill & { nameJp:string })[]
  nativeIndex: number
  matchReason?: string
}
export type P2gArmorLink = P2gArmorIdentity & Pick<P2gArmorSummary, 'part' | 'nameCn' | 'nameJp' | 'nameEn'>
export type P2gArmorRecipe = { recipeKey: string; cost: number; materials: P2gWeaponMaterial[]; armor: P2gArmorLink }
export type P2gArmorDetail = P2gArmorSummary & {
  nameSource: string
  nativeRowSha256: string
  maxBeforeFinalUnlock: number
  acquisition: string
  skills: (ArmorSkill & { nameJp: string })[]
  recipes: P2gArmorRecipe[]
}
export type P2gArmorFilters = Omit<ArmorCatalogFilters, 'gameId' | 'targetDexId' | 'sort' | 'includePlaceholders'> & {
  gameId: 'mhp2g'
  targetArmorKey?: string
  sort?: 'nativeId' | Exclude<ArmorCatalogFilters['sort'], 'dexId'>
}
export type P2gArmorSetFilters = Omit<P2gArmorFilters, 'part' | 'sort'> & { sort?: ArmorSetFilters['sort'] }
export type P2gArmorSetRow = { combat: 'blademaster' | 'gunner'; nameCn: string; members: Partial<Record<P2gArmorSummary['part'], P2gArmorSummary>> }
export type P2gArmorSetSummary = Omit<ArmorSetSummary, 'gameId' | 'rows'> & { gameId: 'mhp2g'; rows: P2gArmorSetRow[]; nameJp: string; matchReason?: string }
