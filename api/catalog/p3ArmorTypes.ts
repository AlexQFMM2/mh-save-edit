import type { ArmorCombatType, ArmorGender, ArmorSetSummary, ArmorSkill, ArmorSummary } from './types'
import type { P2gArmorFilters, P2gArmorSetFilters } from './p2gArmorTypes'
import type { P3SkillPoint } from './p3SkillTypes'
import type { P3ItemLink } from './p3ItemTypes'

export type P3ArmorIdentity = { gameId: 'mhp3'; armorKey: string }
export type P3ArmorScope = 'obtainable' | 'unknown' | 'special' | 'all'
export type P3ArmorSummary = Omit<ArmorSummary, 'gameId' | 'dexId' | 'skills'> & P3ArmorIdentity & {
  nativeType: number; nativeId: number
  acquisitionStatus: Exclude<P3ArmorScope, 'all'>
  skills: (ArmorSkill & P3SkillPoint & { nameJp: string })[]
  matchReason?: string
}
export type P3ArmorLink = P3ArmorIdentity & Pick<P3ArmorSummary, 'part' | 'nameCn' | 'nameJp' | 'nameEn'>
export type P3ArmorRecipe = { recipeKey: string; cost: number | null; armor: P3ArmorLink; materials: (P3ItemLink & { position: number; quantity: number })[] }
export type P3ArmorDetail = P3ArmorSummary & {
  nameSource: string; nativeRowSha256: string; acquisition: string; acquisitionSource: string
  recipes: P3ArmorRecipe[]
}
export type P3ArmorFilters = Omit<P2gArmorFilters, 'gameId'> & { gameId: 'mhp3'; scope?: P3ArmorScope }
export type P3ArmorSetFilters = Omit<P2gArmorSetFilters, 'gameId'> & { gameId: 'mhp3'; scope?: P3ArmorScope }
export type P3ArmorSetRow = { combat: ArmorCombatType; nameCn: string; members: Partial<Record<P3ArmorSummary['part'], P3ArmorSummary>> }
export type P3ArmorSetSummary = Omit<ArmorSetSummary, 'gameId' | 'rows'> & {
  gameId: 'mhp3'; rows: P3ArmorSetRow[]; nameJp: string; gender: ArmorGender; standalone: boolean; matchReason?: string
}
