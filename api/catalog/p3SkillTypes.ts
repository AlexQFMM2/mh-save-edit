import type { ArmorPartId } from './types'

export type P3SkillArmorIdentity = { gameId: 'mhp3'; armorKey: string }
export type P3SkillPoint = { skillId: number; points: number; kind: 'signed-points' | 'torso-copy-marker' }
export type P3SkillArmorSummary = P3SkillArmorIdentity & {
  nativeType: number; nativeId: number
  nameCn: string; nameEn: string; nameJp: string; part: ArmorPartId
  rarity: number; slots: number; iconPath: string
  acquisitionStatus: 'not-audited' | 'obtainable' | 'unknown' | 'special'
  referenceCoverage: 'matching-independent-record-values' | 'native-only-acquisition-unverified'
}
export type P3SkillArmorRelation = P3SkillArmorSummary & Pick<P3SkillPoint, 'points' | 'kind'>
export type P3SkillArmorDetail = P3SkillArmorSummary & {
  skills: (P3SkillPoint & { nameCn: string; nameJp: string; nameEn: string })[]
}
export type P3SkillCharmSource = {
  sourceKey: string; sourceKind: 'random-pool' | 'special-gift'
  label: string; nameJp: string; skillId: number; position: 'A' | 'B'
  minPoints: number; maxPoints: number; slots: number | null; note: string
}
export type P3SkillData = { armorCatalog?: 'full' | 'preview'; charmSources: P3SkillCharmSource[]; source: string }
