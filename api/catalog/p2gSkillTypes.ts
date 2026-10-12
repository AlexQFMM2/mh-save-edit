import type { ArmorPartId, ItemIdentity } from './types'

export type P2gSkillEquipmentIdentity = { gameId: 'mhp2g'; equipmentKey: string }
export type P2gSkillEquipmentSummary = P2gSkillEquipmentIdentity & {
  decorationItemId?: number
  kind: 'armor' | 'decoration'; nameCn: string; nameJp: string; nameSource: string
  part: ArmorPartId | null; slots: number; iconPath: string | null; points: number
}
export type P2gSkillEquipmentDetail = Omit<P2gSkillEquipmentSummary, 'points'> & {
  itemId: number | null
  skills: { skillId: number; nameCn: string; nameJp: string; points: number }[]
  recipes: { recipeKey: string; materials: { item: ItemIdentity & { nameCn: string; nameJp: string }; quantity: number }[] }[]
}
export type P2gSkillData = {
  sourceUrl: string; nameSource: string
  specialRule: { descriptionCn: string; descriptionJp: string } | null
  equipment: P2gSkillEquipmentSummary[]
}
