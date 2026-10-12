import type { P2gSkillData } from './p2gSkillTypes'
import type { GameId } from '../core/loadout'
import type { ItemTermLabel } from '../terminology/types'

export type CatalogGameId = GameId | 'mhp2g'
export type LegacyItemIdentity = { gameId: GameId; saveId: number; itemId?: never }
export type P2gItemIdentity = { gameId: 'mhp2g'; itemId: number; saveId?: never }
export type ItemIdentity = LegacyItemIdentity | P2gItemIdentity
export type LegacyDecorationIdentity = { gameId: GameId; saveId: number; itemId?: never }
export type P2gDecorationIdentity = { gameId: 'mhp2g'; itemId: number; saveId?: never }
export type DecorationIdentity = LegacyDecorationIdentity | P2gDecorationIdentity
export type WeaponIdentity = { gameId: GameId; weaponKey: string }
export type ArmorIdentity = { gameId: GameId; dexId: number }
export type SkillIdentity = { gameId: CatalogGameId; skillId: number }
export type MonsterIdentity = { gameId: CatalogGameId; monsterId: number }
export type QuestIdentity = { gameId: CatalogGameId; questKey: string }
export type HunterArtIdentity = { gameId: 'mhgu'; hunterArtId: number }
export type ArmorPartId = 'head' | 'chest' | 'arms' | 'waist' | 'legs'
export type ArmorCombatType = 'both' | 'blademaster' | 'gunner'
export type ArmorGender = 'both' | 'male' | 'female'
export type ArmorViewMode = 'list' | 'set'
export type ArmorSort = 'dexId' | 'name' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense' | 'fireRes' | 'waterRes' | 'thunderRes' | 'iceRes' | 'dragonRes' | 'skillPoints'
export type ArmorSetSort = 'source' | 'name' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense' | 'skillPoints'
export type ItemSourceKind = 'combination' | 'monster' | 'location' | 'quest' | 'exchange' | 'shop'
export type ItemUsageKind = 'weapon' | 'armor' | 'decoration' | 'palico-weapon' | 'palico-armor' | 'kinsect'
export type ItemRelationTarget = LegacyItemIdentity & { nameCn: string; nameEn: string }
export type WeaponRelationTarget = WeaponIdentity & { typeId: number; nameCn: string; nameEn: string }
export type ArmorRelationTarget = ArmorIdentity & { part: ArmorPartId; nameCn: string; nameEn: string }
export type MonsterRelationTarget = MonsterIdentity & { nameCn: string; nameEn: string; iconPath: string | null }
export type QuestRelationTarget = QuestIdentity & { nameCn: string; nameEn: string }
export type PalicoEquipmentRelationTarget = { gameId: 'mhgu'; kind: 'weapon' | 'armor'; equipmentId: number; nameCn: string; nameEn: string; iconPath: string | null }
export type DecorationSkill = {
  nameJp?: string
  skillId: number
  nameCn: string
  nameEn: string
  points: number
  activeSkillNameCn: string | null
  activeSkillNameEn: string | null
}
export type DecorationMaterial = ItemIdentity & { nameCn: string; nameEn: string; nameJp?: string; quantity: number; recipeIndex: number }

export type DecorationSummary = DecorationIdentity & {
  nameJp?: string
  matchReason?: string
  dexId: number | null
  itemSaveId: number | null
  itemDexId: number | null
  nameCn: string
  nameEn: string
  slots: number
  price: number | null
  iconPath: string | null
  isPlaceholder: boolean
  skills: Pick<DecorationSkill, 'skillId' | 'nameCn' | 'nameEn' | 'points'>[]
}

export type DecorationDetail = DecorationSummary & {
  p2g?: { rarity: number | null; buyPrice: number | null; sellPrice: number | null; craftingCost: null; unlockCondition: null; nameSource: string }
  dexIds: number[]
  skills: DecorationSkill[]
  materials: DecorationMaterial[]
  mappingStatus: string
}

export type DecorationCatalogFilters = {
  gameId: CatalogGameId
  targetSaveId?: number
  targetItemId?: number
  query?: string
  skillId?: number
  slots?: number
  includePlaceholders?: boolean
  sort?: 'saveId' | 'itemId' | 'name' | 'slots' | 'skillPoints'
  page?: number
  pageSize?: number
}

export type DecorationCatalogFacets = {
  slots: number[]
  skills: (Pick<DecorationSkill, 'skillId' | 'nameCn' | 'nameEn'> & { nameJp?: string })[]
}

export type ItemSummary = LegacyItemIdentity & {
  matchReason?: string
  terminology?: ItemTermLabel
  dexId: number | null
  nameCn: string
  nameEn: string
  rarity: number | null
  maxStack: number | null
  iconPath: string | null
  isPlaceholder: boolean
}

export type CatalogItemSummary = ItemSummary | (P2gItemIdentity & Omit<ItemSummary, keyof LegacyItemIdentity>)

export type ItemRelation = {
  id: number
  sourceKind: ItemSourceKind | ItemUsageKind
  usageKind: ItemUsageKind | null
  targetId: number | null
  targetName: string
  quantity: number | null
  probability: number | null
  rank: number | null
  metadata: Record<string, string>
  relatedItems: (ItemIdentity & { nameCn: string; nameEn: string })[]
  relatedDecoration?: (P2gDecorationIdentity & { nameCn: string }) | null
  pendingTarget?: { kind: 'weapon' | 'armor' | 'decoration' | 'monster' | 'quest'; name: string } | null
  relatedWeapon?: WeaponRelationTarget | null
  relatedArmor?: ArmorRelationTarget | null
  relatedMonster?: MonsterRelationTarget | null
  relatedQuest?: QuestRelationTarget | null
  relatedPalicoWeapon?: PalicoEquipmentRelationTarget | null
  relatedPalicoArmor?: PalicoEquipmentRelationTarget | null
}

export type QuestAvailability = 'common' | 'mhgu' | 'mhxx'
export type QuestKeyStatus = 'normal' | 'key' | 'urgent'
export type QuestDetailTab = 'info' | 'rewards' | 'unlocks'
export type QuestRank = 'low' | 'high' | 'g' | 'other'
export type QuestSearchMatchKind = 'name' | 'id' | 'goal' | 'subGoal' | 'map' | 'monster' | 'reward' | 'supply' | 'hunterArt' | 'special' | 'relatedQuest'
export type MonsterCatalogTab = 'weakness' | 'ailments' | 'drops' | 'quests'
export type MonsterCatalogFilters = {
  gameId: CatalogGameId
  targetMonsterId?: number
  query?: string
  includePlaceholders?: boolean
}
export type MonsterSummary = MonsterIdentity & {
  matchReason?: string
  nameCn: string
  nameEn: string
  nameJp: string
  iconSmallPath: string | null
  iconLargePath: string | null
  isPlaceholder: boolean
}
export type MonsterWeakness = {
  id: number
  partId: number
  partOrder: number
  partNameCn: string
  partNameEn: string
  conditionCn: string
  conditionEn: string
  cut: number
  impact: number
  shot: number
  fire: number
  water: number
  thunder: number
  ice: number
  dragon: number
  stun: number
}
export type MonsterAilment = {
  id: number
  statusId: number
  nameCn: string
  nameEn: string
  toleranceInitial: number | null
  toleranceIncrease: number | null
  toleranceMax: number | null
  duration: number | null
  damage: number | null
  applicable?: boolean | null
}
export type MonsterTrap = {
  id: number
  trapId: number
  nameCn: string
  nameEn: string
  isEffective: boolean | null
  duration: number | null
  durationEnraged: number | null
  durationFatigued: number | null
  noteJp?: string
}
export type MonsterDrop = {
  id: number
  rankId: number
  rankNameCn: string
  rankNameEn: string
  methodId: number
  methodNameCn: string
  methodNameEn: string
  item: ItemIdentity & { nameCn: string; nameEn: string }
  quantity: number | null
  probability: number
}
export type QuestMonsterTarget = MonsterRelationTarget & { slot: number; sourceKind: string }
export type QuestModifier = { markerId: number; nameCn: string; slot: number }
export type MonsterQuestAppearance = QuestIdentity & {
  dexId: number | null
  nativeId: string | null
  availability: QuestAvailability
  nameCn: string
  nameEn: string
  nameJp: string
  goalCn: string
  goalEn: string
  subGoalCn: string
  subGoalEn: string
  levelId: number
  levelNameCn: string
  levelNameEn: string
  questTypeId: number
  questTypeNameCn: string
  questTypeNameEn: string
  locationId: number
  locationNameCn: string
  locationNameEn: string
  timeMinutes: number | null
  fee: number | null
  reward: number | null
  reward2: number | null
  hrp: number | null
  hrp2: number | null
  monsters: QuestMonsterTarget[]
  modifiers: QuestModifier[]
}
export type QuestSearchMatch = { kind: QuestSearchMatchKind; label: string; reason: string }
export type QuestSummary = QuestIdentity & {
  dexId: number | null
  availability: QuestAvailability
  nameCn: string
  nameEn: string
  levelId: number
  levelNameCn: string
  systemKey: string
  systemNameCn: string
  rank: QuestRank
  star: number | null
  questTypeId: number
  questTypeNameCn: string
  locationId: number
  locationNameCn: string
  goalCn: string
  keyStatus: QuestKeyStatus
  isPlaceholder: boolean
  match: QuestSearchMatch | null
}
export type QuestReward = {
  id: number
  groupKey: string
  region: string
  item: ItemIdentity & { nameCn: string; nameEn: string }
  quantity: number | null
  probability: number | null
  guaranteed?: boolean | null
}
export type EvidenceStatus = 'verified' | 'wiki_only' | 'conflict'
export type QuestSpecialReward = {
  id: number
  kind: string
  nameCn: string
  nameEn: string
  nameJp: string
  hunterArt?: Pick<HunterArtIdentity, 'hunterArtId'> & { nameCn: string; nameEn: string } | null
  evidenceStatus: EvidenceStatus
}
export type QuestRelation = {
  id: number
  direction: 'prerequisite' | 'unlocks'
  operator: 'all' | 'any'
  quest: QuestRelationTarget
  sourceText: string
  evidenceStatus: EvidenceStatus
}
export type QuestDetail = MonsterQuestAppearance & {
  p2g?: import('./p2gQuestTypes').P2gQuestData
  keyStatus: QuestKeyStatus
  systemKey: string
  systemNameCn: string
  rank: QuestRank
  star: number | null
  rewards: QuestReward[]
  specialRewards: QuestSpecialReward[]
  relations: QuestRelation[]
}
export type QuestCatalogFilters = {
  gameId: CatalogGameId
  targetQuestKey?: string
  query?: string
  system?: string
  levelId?: number
  rank?: QuestRank
  questTypeId?: number
  locationId?: number
  keyStatus?: QuestKeyStatus
  availability?: QuestAvailability
  includePlaceholders?: boolean
  page?: number
  pageSize?: number
}
export type QuestCatalogFacets = {
  systems: { key: string; nameCn: string; keywords?: string }[]
  levels: { id: number; nameCn: string; keywords?: string }[]
  ranks: QuestRank[]
  questTypes: { id: number; nameCn: string; keywords?: string }[]
  locations: { id: number; nameCn: string; keywords?: string }[]
  availabilities: QuestAvailability[]
}

export type HunterArtUnlockKind = 'initial' | 'quest' | 'hunterRank' | 'contribution' | 'palicoLevel' | 'monster' | 'npc' | 'compound' | 'other'
export type HunterArtUnlockCondition =
  | { kind: 'initial' }
  | { kind: 'quest'; questKey: string; nameCn: string; nameEn: string; afterNpcConversation: boolean }
  | { kind: 'all' | 'any'; conditions: HunterArtUnlockCondition[] }
  | { kind: 'hunterRank'; minimum: number }
  | { kind: 'villageContribution'; village: string; minimum: number }
  | { kind: 'villageQuestCount'; village: string; minimum: number }
  | { kind: 'palicoLevel'; minimum: number }
  | { kind: 'huntMonster'; monsterId: number; nameCn: string; nameEn: string; quantity: number }
  | { kind: 'npcConversation'; npcName: string }
  | { kind: 'arenaQuest'; name: string }
  | { kind: 'sourceText'; text: string }
export type HunterArtUnlock = {
  id: number
  kind: HunterArtUnlockKind
  condition: HunterArtUnlockCondition
  sourceText: string
  evidenceStatus: EvidenceStatus
  sourceTitle: string
  sourceRevision: number
}
export type HunterArtSummary = HunterArtIdentity & {
  nameCn: string
  nameEn: string
  nameJp: string
  weaponTypeId: number
  weaponTypeNameCn: string
  weaponTypeNameEn: string
  level: number | null
  contentVariant: 'common'
  isPlaceholder: boolean
  unlockKind: HunterArtUnlockKind | null
  match: { kind: string; label: string; reason: string } | null
}
export type HunterArtDetail = HunterArtSummary & {
  shortDescriptionCn: string
  longDescriptionCn: string
  shortDescriptionEn: string
  longDescriptionEn: string
  shortDescriptionJp: string
  longDescriptionJp: string
  unlocks: HunterArtUnlock[]
  quests: (QuestRelationTarget & { relationOrder: number; operator: 'all' | 'any'; afterNpcConversation: boolean; evidenceStatus: EvidenceStatus })[]
}
export type HunterArtCatalogFilters = {
  gameId: GameId
  targetHunterArtId?: number
  query?: string
  weaponTypeId?: number
  level?: number | 'none'
  unlockKind?: HunterArtUnlockKind
  includePlaceholders?: boolean
}
export type HunterArtCatalogFacets = {
  weaponTypes: { id: number; nameCn: string; nameEn: string }[]
  levels: number[]
  unlockKinds: HunterArtUnlockKind[]
}
export type MonsterDetail = MonsterSummary & {
  weakness: MonsterWeakness[]
  ailments: MonsterAilment[]
  traps: MonsterTrap[]
  drops: MonsterDrop[]
  quests: MonsterQuestAppearance[]
  p2gQuests?: P2gMonsterQuest[]
}
export type P2gMonsterQuest = {
  questKey: string
  nameCn?: string
  sourceKey?: string
  sourceNote?: string
  linked?: boolean
  nameJp: string
  fields: { label: string; value: string }[]
}
export type MonsterCatalogFacets = {
  monsterCount: number
  statusNames: { statusId: number; nameCn: string; nameEn: string }[]
  trapNames: { trapId: number; nameCn: string; nameEn: string }[]
  questAvailabilities: QuestAvailability[]
}

export type ArmorSkill = {
  skillId: number
  nameCn: string
  nameEn: string
  points: number
  activeSkillNameCn: string | null
  activeSkillNameEn: string | null
}

export type ArmorMaterial = ItemRelationTarget & { quantity: number }
export type ArmorSaveIdentity = { saveType: number; saveId: number; mappingStatus: string }

export type ArmorSummary = ArmorIdentity & {
  nameCn: string
  nameEn: string
  nameJp: string
  part: ArmorPartId
  combat: ArmorCombatType
  gender: ArmorGender
  rarity: number
  slots: number
  baseDefense: number
  maxDefense: number
  fireRes: number
  waterRes: number
  thunderRes: number
  iceRes: number
  dragonRes: number
  price: number | null
  iconPath: string | null
  isPlaceholder: boolean
  skills: Pick<ArmorSkill, 'skillId' | 'nameCn' | 'nameEn' | 'points'>[]
}

export type ArmorDetail = ArmorSummary & {
  saveIdentities: ArmorSaveIdentity[]
  skills: ArmorSkill[]
  materials: ArmorMaterial[]
  mappingStatus: string
}

export type ArmorSetMember = Pick<ArmorSummary, 'gameId' | 'dexId' | 'nameCn' | 'nameEn' | 'part' | 'iconPath' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense'>
export type ArmorSetRow = { combat: 'blademaster' | 'gunner'; nameCn: string; members: Partial<Record<ArmorPartId, ArmorSetMember>> }
export type ArmorSetSummary = {
  gameId: GameId
  setKey: string
  sortOrder: number
  rows: ArmorSetRow[]
  rarity: number
  totalSlots: number
  totalBaseDefense: number
  totalMaxDefense: number
}

export type ArmorCatalogFilters = {
  gameId: GameId
  targetDexId?: number
  query?: string
  part?: ArmorPartId
  combat?: ArmorCombatType
  gender?: ArmorGender
  rarity?: number
  slots?: number
  skillId?: number
  includePlaceholders?: boolean
  sort?: ArmorSort
  direction?: SortDirection
  page?: number
  pageSize?: number
}

export type ArmorSetFilters = Omit<ArmorCatalogFilters, 'part' | 'sort'> & { sort?: ArmorSetSort }
export type ArmorCatalogFacets = {
  rarities: number[]
  slots: number[]
  skills: Pick<ArmorSkill, 'skillId' | 'nameCn' | 'nameEn'>[]
}

export type SkillActivationLink = { activationKey: string; skillId?: number; nameCn: string; nameEn: string; direction: 'positive' | 'negative' | 'special' }
export type SkillActivation = { activationKey: string; dexActivationId: number | null; threshold: number; direction: 'positive' | 'negative' | 'special'; nameCn: string; nameEn: string; nameJp: string; descriptionCn: string; descriptionEn: string; descriptionJp: string; wikiDetail?: { descriptionCn: string; sourceUrl: string; sourceVersion: string; reviewNote: string }; components: SkillActivationLink[] }
export type SkillDecorationRelation = LegacyDecorationIdentity & { nameCn: string; nameEn: string; points: number; slots: number; iconPath: string | null }
export type SkillArmorRelation = ArmorIdentity & { nameCn: string; nameEn: string; points: number; slots: number; part: ArmorPartId; iconPath: string | null }
export type SkillTalismanRelation = { rangeKey: string; skillId: number; skillNameCn: string; talismanId: number; talismanNameCn: string; talismanNameEn: string; position: 'A' | 'B'; slotCount: number | null; minPoints: number; maxPoints: number; maxSlots: number | null; rangeStatus: 'exact' | 'rule' | 'unknown'; source: string }
export type SkillCatalogTab = 'armor' | 'decoration' | 'talisman'
export type SkillDetail = SkillIdentity & {
  p2g?: P2gSkillData
  nameCn: string
  nameEn: string
  nameJp: string
  descriptionCn: string | null
  descriptionEn: string | null
  descriptionJp: string | null
  activations: SkillActivation[]
  components: SkillActivationLink[]
  decorations: SkillDecorationRelation[]
  armors: SkillArmorRelation[]
  talismans: SkillTalismanRelation[]
}
export type SkillSummary = SkillIdentity & { match?: string; nameCn: string; nameEn: string; nameJp: string; activationCount: number; positiveActivationCount: number; negativeActivationCount: number; specialActivationCount: number; armorCount: number; decorationCount: number; talismanCount: number; isPlaceholder: boolean }
export type SkillCatalogFilters = { gameId: CatalogGameId; targetSkillId?: number; query?: string; direction?: 'positive' | 'negative' | 'special'; source?: 'armor' | 'decoration' | 'talisman' | 'all'; includePlaceholders?: boolean; sort?: 'skillId' | 'name' | 'activationCount'; page?: number; pageSize?: number }
export type SkillCatalogFacets = { directions: ('positive' | 'negative' | 'special')[]; sources: ('armor' | 'decoration' | 'talisman')[] }

export type ItemDetail = ItemSummary & {
  decoration?: P2gDecorationIdentity
  localization?: { nameSource: string; namePending: boolean; descriptionSource: string; descriptionPending: boolean; descriptionJp?: string }
  description?: string
  nameJp: string
  sellPrice: number | null
  buyPrice: number | null
  hexId: string | null
  mappingStatus: string
  relations: ItemRelation[]
}

export type CatalogItemDetail = ItemDetail | (P2gItemIdentity & Omit<ItemDetail, keyof LegacyItemIdentity>)

export type ItemCatalogFilters = {
  gameId: CatalogGameId
  targetSaveId?: number
  targetItemId?: number
  query?: string
  rarity?: number
  maxStack?: number
  sourceKinds?: ItemSourceKind[]
  usageKinds?: ItemUsageKind[]
  includePlaceholders?: boolean
  sort?: 'saveId' | 'itemId' | 'name' | 'rarity'
  page?: number
  pageSize?: number
}

export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number; hasNext: boolean }

export type WeaponViewMode = 'list' | 'tree' | 'motion'
export type WeaponSort = 'saveId' | 'name' | 'rarity' | 'attack' | 'slots' | 'sharpness' | 'affinity'
export type SortDirection = 'asc' | 'desc'
export type SharpnessStage = 'base' | 'handicraft1' | 'handicraft2'
export type WeaponKind = 'standardMelee' | 'huntingHorn' | 'gunlance' | 'phialWeapon' | 'insectGlaive' | 'bowgun' | 'bow'
export type WeaponAttributeFilter = number | 'none'

export type WeaponTypeDefinition = {
  gameId: GameId
  typeId: number
  saveType: number
  nameCn: string
  nameEn: string
  sortOrder: number
  kind: WeaponKind
}

export type WeaponAttribute = {
  attributeId: number
  kind: string
  nameCn: string
  nameEn: string
  value: number
  isHidden: boolean
}

export type WeaponSharpnessProfile = {
  red: number
  orange: number
  yellow: number
  green: number
  blue: number
  white: number
  purple: number
  baseCutoff: number
  handicraft1Cutoff: number | null
  handicraft2Cutoff: number | null
  rawValue: string
}

export type WeaponSummary = WeaponIdentity & {
  typeId: number
  typeNameCn: string
  typeNameEn: string
  kind: WeaponKind
  saveType: number
  saveId: number
  saveLevel: number | null
  displayLevel: number | null
  dexId: number | null
  nameCn: string
  nameEn: string
  rarity: number | null
  displayAttack: number | null
  trueRawAttack: number | null
  affinity: number | null
  defense: number | null
  slots: number | null
  isDirectlyProducible: boolean
  isFinalForm: boolean
  iconPath: string | null
  isPlaceholder: boolean
  attributes: WeaponAttribute[]
  sharpness: WeaponSharpnessProfile | null
  specialSummary: string[]
}

export type WeaponMaterial = ItemRelationTarget & {
  kind: 'production' | 'upgrade'
  quantity: number
  dexId: number | null
}

export type WeaponLink = WeaponIdentity & {
  typeId: number
  nameCn: string
  nameEn: string
  displayLevel: number | null
}

export type HuntingHornNote = { id: number; nameCn: string; nameEn: string }
export type HuntingHornSong = {
  songId: number
  rankId: number
  notes: string
  effectNameCn: string
  effectNameEn: string
  encoreEffectNameCn: string | null
  encoreEffectNameEn: string | null
  duration: number | null
  encoreDuration: number | null
}
export type GunlanceShelling = { typeId: number; nameCn: string; nameEn: string }
export type WeaponPhial = { id: number; nameCn: string; nameEn: string }
export type KinsectType = { id: number; nameCn: string; nameEn: string }
export type BowgunStats = {
  reloadId: number
  reloadNameCn: string
  reloadNameEn: string
  recoilId: number
  recoilNameCn: string
  recoilNameEn: string
  steadinessId: number
  steadinessNameCn: string
  steadinessNameEn: string
}
export type BowgunAmmoRow = {
  itemSaveId: number | null
  itemDexId: number
  nameCn: string
  nameEn: string
  loadQuantity: number
  loadQuantityPlus: number | null
  maxCarry: number | null
  specialFireQuantity: number | null
  rapidFireGapNameCn: string | null
  rapidFireGapNameEn: string | null
  actionKind: 'standard' | 'rapid-fire' | 'siege-fire' | 'coating'
}
export type BowStats = { shotModeId: number; shotModeNameCn: string; shotModeNameEn: string; loadUpChargeLevel: number | null }
export type BowCharge = { level: number; shotTypeId: number; nameCn: string; nameEn: string; requiresLoadUp: boolean }

export type WeaponBaseDetail = WeaponSummary & {
  nameJp: string
  productionPrice: number | null
  upgradePrice: number | null
  mappingStatus: string
  materials: WeaponMaterial[]
  parents: WeaponLink[]
  children: WeaponLink[]
}

export type WeaponDetail = WeaponBaseDetail & (
  | { kind: 'standardMelee'; sharpness: WeaponSharpnessProfile }
  | { kind: 'huntingHorn'; sharpness: WeaponSharpnessProfile; notes: HuntingHornNote[]; songs: HuntingHornSong[] }
  | { kind: 'gunlance'; sharpness: WeaponSharpnessProfile; shelling: GunlanceShelling }
  | { kind: 'phialWeapon'; sharpness: WeaponSharpnessProfile; weaponKind: 'switchAxe' | 'chargeBlade'; phial: WeaponPhial }
  | { kind: 'insectGlaive'; sharpness: WeaponSharpnessProfile; kinsectType: KinsectType }
  | { kind: 'bowgun'; sharpness: null; weaponKind: 'light' | 'heavy'; gun: BowgunStats; ammo: BowgunAmmoRow[] }
  | { kind: 'bow'; sharpness: null; bow: BowStats; charges: BowCharge[]; coatings: BowgunAmmoRow[] }
)

export type WeaponCatalogFilters = {
  gameId: GameId
  targetWeaponKey?: string
  query?: string
  weaponTypeId?: number
  attributeId?: WeaponAttributeFilter
  includeHiddenAttributes?: boolean
  rarity?: number
  slots?: number
  directlyProducible?: boolean
  finalOnly?: boolean
  includePlaceholders?: boolean
  sort?: WeaponSort
  direction?: SortDirection
  sharpnessStage?: SharpnessStage
  page?: number
  pageSize?: number
}

export type WeaponCatalogFacets = {
  weaponTypes: WeaponTypeDefinition[]
  attributes: Pick<WeaponAttribute, 'attributeId' | 'kind' | 'nameCn' | 'nameEn' | 'isHidden'>[]
  rarities: number[]
  slots: number[]
  sharpnessStages: SharpnessStage[]
}

export type WeaponTreeNode = WeaponSummary & { matchesFilter: boolean }
export type WeaponTreeEdge = { parentWeaponKey: string; childWeaponKey: string; branchOrder: number }
export type WeaponTreeResult = {
  gameId: GameId
  weaponTypeId: number
  dataVersion: string
  nodes: WeaponTreeNode[]
  edges: WeaponTreeEdge[]
}

export type WeaponStyleId = 'guild' | 'striker' | 'aerial' | 'adept' | 'alchemy' | 'valor'
export type WeaponMotionCategory = 'standard' | 'style' | 'hunterArt'
export type WeaponMotionSort = 'source' | 'motionValue' | 'stun' | 'exhaust'

export type WeaponMotionFilters = {
  gameId: 'mhgu'
  weaponTypeId: number
  query?: string
  styleIds?: WeaponStyleId[]
  category?: WeaponMotionCategory
  sort?: WeaponMotionSort
  direction?: SortDirection
}

export type WeaponMotionHit = {
  sequence: number
  motionValue: number | null
  attackType: string | null
  sharpnessModifier: number | null
  exhaust: number | null
  stun: number | null
  isDamage: boolean
}

export type WeaponMotionVariant = {
  variantId: string
  labelCn: string
  conditionCn: string
  styleId: WeaponStyleId | null
  motionValueTotal: number | null
  hits: WeaponMotionHit[]
}

export type WeaponMotionBase = {
  gameId: 'mhgu'
  motionKey: string
  weaponTypeId: number
  nativeActionId: string
  nameCn: string
  nameEn: string
  nameJp: string
  category: WeaponMotionCategory
  styles: WeaponStyleId[]
  hitCountMin: number
  hitCountMax: number
  motionValueMin: number | null
  motionValueMax: number | null
  motionValueTotal: number | null
  notes: string
  hunterArtId: number | null
  evidenceStatus: string
  variants: WeaponMotionVariant[]
}

export type MeleeWeaponMotion = WeaponMotionBase & {
  resultKind: 'melee'
  attackType: string | null
  sharpnessModifier: number | null
  exhaust: number | null
  stun: number | null
}

export type BowgunWeaponMotion = WeaponMotionBase & {
  resultKind: 'bowgun'
  projectileKind: string
  rapidFireModifier: number | null
  siegeModifier: number | null
  nativeModifierText: string
}

export type BowWeaponMotion = WeaponMotionBase & {
  resultKind: 'bow'
  shotType: string | null
  chargeLevel: number | null
  chargeModifier: number | null
  coatingModifier: number | null
  distanceModifier: string | null
}

export type WeaponMotionCatalogResult =
  | { kind: 'melee'; weaponType: WeaponTypeDefinition; motions: MeleeWeaponMotion[] }
  | { kind: 'bowgun'; weaponType: WeaponTypeDefinition; motions: BowgunWeaponMotion[] }
  | { kind: 'bow'; weaponType: WeaponTypeDefinition; motions: BowWeaponMotion[] }

export type WeaponMotionFacets = {
  weaponTypes: WeaponTypeDefinition[]
  styles: { id: WeaponStyleId; nameCn: string; nameEn: string }[]
  categories: WeaponMotionCategory[]
}

export type PalicoTypeIdentity = { gameId: 'mhgu'; typeId: number }
export type PalicoSupportMoveIdentity = { gameId: 'mhgu'; supportMoveId: number }
export type PalicoSkillIdentity = { gameId: 'mhgu'; palicoSkillId: number }
export type PalicoEquipmentIdentity = { gameId: 'mhgu'; kind: 'weapon' | 'armor'; equipmentId: number }
export type PalicoEvidenceStatus = 'verified' | 'wiki_only' | 'conflict'
export type PalicoUnlockKind = 'initial' | 'innate' | 'monster' | 'level' | 'distribution'
export type PalicoTypeSummary = PalicoTypeIdentity & { typeKey: string; nameCn: string; nameEn: string; nameJp: string; descriptionCn: string }
export type PalicoTypeMove = PalicoSupportMoveIdentity & { nameCn: string; nameEn: string; relationKind: string }
export type PalicoTypeSkill = PalicoSkillIdentity & { nameCn: string; nameEn: string; relationKind: string }
export type PalicoTypeDetail = PalicoTypeSummary & { descriptionEn: string; descriptionJp: string; supportMoves: PalicoTypeMove[]; skills: PalicoTypeSkill[] }
export type PalicoUnlock = { unlockKey: string; nativeUnlockId: number | null; kind: PalicoUnlockKind; level: number | null; monsterId: number | null; monsterNameCn: string | null; descriptionCn: string; descriptionEn: string; evidenceStatus: PalicoEvidenceStatus; source: string }
export type PalicoSupportMoveSummary = PalicoSupportMoveIdentity & { nameCn: string; nameEn: string; nameJp: string; generationTier: number | null; generationGroup: string | null; role: string; teachable: boolean; gaugeCost: number | null; evidenceStatus: PalicoEvidenceStatus }
export type PalicoSupportMoveDetail = PalicoSupportMoveSummary & { descriptionCn: string; descriptionEn: string; descriptionJp: string; types: PalicoTypeSummary[]; unlocks: PalicoUnlock[]; source: string }
export type PalicoSkillSummary = PalicoSkillIdentity & { nameCn: string; nameEn: string; nameJp: string; generationTier: number | null; generationGroup: string | null; role: string; teachable: boolean; memoryCost: number | null; learnLevel: number | null; evidenceStatus: PalicoEvidenceStatus }
export type PalicoSkillDetail = PalicoSkillSummary & { descriptionCn: string; descriptionEn: string; descriptionJp: string; types: PalicoTypeSummary[]; unlocks: PalicoUnlock[]; source: string }
export type PalicoSupportMoveFilters = { gameId: 'mhgu'; targetSupportMoveId?: number; query?: string; typeId?: number; gaugeCost?: number; generationGroup?: 'A' | 'B' | 'C' | 'fixed'; monsterId?: number }
export type PalicoSkillFilters = { gameId: 'mhgu'; targetPalicoSkillId?: number; query?: string; memoryCost?: number; generationGroup?: 'A' | 'B' | 'C' | 'fixed'; learnLevel?: number; unlockKind?: PalicoUnlockKind }
export type PalicoMaterial = ItemRelationTarget & { quantity: number }
export type PalicoWeaponSummary = PalicoEquipmentIdentity & { kind: 'weapon'; dexId: number; saveId: number; nameCn: string; nameEn: string; nameJp: string; rarity: number; attackType: 'cut' | 'blunt'; specializationId: number; specializationCn: string; specializationEn: string; meleeAttack: number; meleeAffinity: number; rangedAttack: number; rangedAffinity: number; specialAttackCn: string | null; specialAttackEn: string | null; specialAttackValue: number | null; defense: number; sharpnessId: 2 | 3 | 4 | 5 | 6 | 7; price: number; iconPath: string | null }
export type PalicoWeaponDetail = PalicoWeaponSummary & { descriptionCn: string; descriptionEn: string; descriptionJp: string; materials: PalicoMaterial[]; source: string }
export type PalicoArmorPart = 'head' | 'body'
export type PalicoArmorSummary = PalicoEquipmentIdentity & { kind: 'armor'; dexId: number; saveId: number; nameCn: string; nameEn: string; nameJp: string; part: PalicoArmorPart; rarity: number; defense: number; fireRes: number; waterRes: number; thunderRes: number; iceRes: number; dragonRes: number; price: number; iconPath: string | null }
export type PalicoArmorDetail = PalicoArmorSummary & { descriptionCn: string; descriptionEn: string; descriptionJp: string; materials: PalicoMaterial[]; source: string }
export type PalicoWeaponFilters = { gameId: 'mhgu'; targetEquipmentId?: number; query?: string; attackType?: 'cut' | 'blunt'; specializationId?: number; rarity?: number; specialAttackId?: number | 'none'; sharpnessId?: number; sort?: 'source' | 'meleeAttack' | 'rangedAttack' | 'affinity' | 'sharpness' | 'defense'; direction?: SortDirection; page?: number; pageSize?: number }
export type PalicoArmorFilters = { gameId: 'mhgu'; targetEquipmentId?: number; query?: string; part?: PalicoArmorPart; rarity?: number; sort?: 'source' | 'defense' | 'fireRes' | 'waterRes' | 'thunderRes' | 'iceRes' | 'dragonRes'; direction?: SortDirection; page?: number; pageSize?: number }
export type PalicoCatalogFacets = { typeOptions: Pick<PalicoTypeSummary, 'typeId' | 'nameCn' | 'nameEn'>[]; gaugeCosts: number[]; memoryCosts: number[]; learnLevels: number[]; generationGroups: string[]; unlockKinds: PalicoUnlockKind[]; rarities: number[]; specializations: { id: number; nameCn: string; nameEn: string }[]; specialAttacks: { id: number; nameCn: string; nameEn: string }[]; sharpnessIds: number[] }

export const sourceKindLabels: Record<string, string> = {
  combination: '调合', monster: '怪物获取', location: '地图采集', quest: '任务奖励', exchange: '山菜爷',
  weapon: '武器', armor: '防具', decoration: '装饰珠', 'palico-weapon': '猫武器',
  'palico-armor': '猫防具', kinsect: '猎虫',
}
