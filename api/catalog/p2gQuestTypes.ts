import type { ItemIdentity, MonsterRelationTarget, QuestRelationTarget } from './types'

export type P2gQuestCondition = {
  kind: 'condition' | 'all' | 'any' | 'not'
  text?: string
  children?: P2gQuestCondition[]
  questKey?: string
  monsterIds?: number[]
}
export type P2gQuestSupply = { item: ItemIdentity & { nameCn: string; nameEn: string }; quantity: number }
export type P2gQuestData = {
  source: 'native' | 'wiki'
  descriptionCn: string | null; descriptionJp: string | null
  failureCn: string | null; failureJp: string | null
  clientCn: string | null; clientJp: string | null
  monsterTextCn: string; monsterTextJp: string
  noteCn?: string; noteJp?: string
  condition: P2gQuestCondition
  conditionQuests: QuestRelationTarget[]
  conditionMonsters: MonsterRelationTarget[]
  rewardGroups: { key: string; label: string; draws: { kind: string; count?: number } | null; firstDraw: { unconditionalGuarantee: boolean } | null }[]
  supplies: P2gQuestSupply[] | null
  largeGroups: { monsterId: number; quantity: number; actorVariant: number }[][] | null
  smallGroups: { index: number; monsterIds: number[] }[] | null
  sequential: boolean
  transitions: { nextGroupIndex: number; condition: { kind: string; monsterId?: number; requiredEvents?: number; itemId?: number; count?: number; minimum?: number; threshold?: number; quantity?: number } }[]
  transitionItems: (ItemIdentity & { nameCn: string; nameEn: string })[]
  wait: { questId: number; waitTicks: number; tickRate: number; introFlagBeforeTimer: number | null } | null
  appearances: { monster: MonsterRelationTarget; fields: { label: string; value: string }[]; sourceNote: string }[]
  keyPrerequisite: boolean
  translationSources: Record<string, { status: string; basis: string }>
}
