import type { GameId } from '../core/loadout'

export type ItemIdentity = { gameId: GameId; saveId: number }
export type DecorationIdentity = { gameId: GameId; saveId: number }
export type WeaponIdentity = { gameId: GameId; weaponKey: string }
export type ArmorIdentity = { gameId: GameId; dexId: number }
export type SkillIdentity = { gameId: GameId; skillId: number }
export type MonsterIdentity = { gameId: GameId; monsterId: number }
export type QuestIdentity = { gameId: GameId; questKey: string }
export type ArmorPartId = 'head' | 'chest' | 'arms' | 'waist' | 'legs'
export type ArmorCombatType = 'both' | 'blademaster' | 'gunner'
export type ArmorGender = 'both' | 'male' | 'female'
export type ArmorViewMode = 'list' | 'set'
export type ArmorSort = 'dexId' | 'name' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense' | 'fireRes' | 'waterRes' | 'thunderRes' | 'iceRes' | 'dragonRes' | 'skillPoints'
export type ArmorSetSort = 'source' | 'name' | 'rarity' | 'slots' | 'baseDefense' | 'maxDefense' | 'skillPoints'
export type ItemSourceKind = 'combination' | 'monster' | 'location' | 'quest' | 'exchange'
export type ItemUsageKind = 'weapon' | 'armor' | 'decoration' | 'palico-weapon' | 'palico-armor' | 'kinsect'
export type ItemRelationTarget = Pick<ItemIdentity, 'gameId' | 'saveId'> & { nameCn: string; nameEn: string }
export type WeaponRelationTarget = WeaponIdentity & { typeId: number; nameCn: string; nameEn: string }
export type ArmorRelationTarget = ArmorIdentity & { part: ArmorPartId; nameCn: string; nameEn: string }
export type MonsterRelationTarget = MonsterIdentity & { nameCn: string; nameEn: string; iconPath: string | null }
export type QuestRelationTarget = QuestIdentity & { nameCn: string; nameEn: string }
export type DecorationSkill = {
  skillId: number
  nameCn: string
  nameEn: string
  points: number
  activeSkillNameCn: string | null
  activeSkillNameEn: string | null
}
export type DecorationMaterial = ItemRelationTarget & { quantity: number; recipeIndex: number }

export type DecorationSummary = DecorationIdentity & {
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
  dexIds: number[]
  skills: DecorationSkill[]
  materials: DecorationMaterial[]
  mappingStatus: string
}

export type DecorationCatalogFilters = {
  gameId: GameId
  targetSaveId?: number
  query?: string
  skillId?: number
  slots?: number
  includePlaceholders?: boolean
  sort?: 'saveId' | 'name' | 'slots' | 'skillPoints'
  page?: number
  pageSize?: number
}

export type DecorationCatalogFacets = {
  slots: number[]
  skills: Pick<DecorationSkill, 'skillId' | 'nameCn' | 'nameEn'>[]
}

export type ItemSummary = ItemIdentity & {
  dexId: number | null
  nameCn: string
  nameEn: string
  rarity: number | null
  maxStack: number | null
  iconPath: string | null
  isPlaceholder: boolean
}

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
  relatedItems: ItemRelationTarget[]
  relatedWeapon?: WeaponRelationTarget | null
  relatedArmor?: ArmorRelationTarget | null
  relatedMonster?: MonsterRelationTarget | null
  relatedQuest?: QuestRelationTarget | null
}

export type QuestAvailability = 'common' | 'mhgu' | 'mhxx'
export type MonsterCatalogTab = 'weakness' | 'ailments' | 'drops' | 'quests'
export type MonsterCatalogFilters = {
  gameId: GameId
  targetMonsterId?: number
  query?: string
  includePlaceholders?: boolean
}
export type MonsterSummary = MonsterIdentity & {
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
}
export type MonsterTrap = {
  id: number
  trapId: number
  nameCn: string
  nameEn: string
  isEffective: boolean
  duration: number | null
  durationEnraged: number | null
  durationFatigued: number | null
}
export type MonsterDrop = {
  id: number
  rankId: number
  rankNameCn: string
  rankNameEn: string
  methodId: number
  methodNameCn: string
  methodNameEn: string
  item: ItemRelationTarget
  quantity: number
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
export type QuestDetail = MonsterQuestAppearance
export type MonsterDetail = MonsterSummary & {
  weakness: MonsterWeakness[]
  ailments: MonsterAilment[]
  traps: MonsterTrap[]
  drops: MonsterDrop[]
  quests: MonsterQuestAppearance[]
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

export type SkillActivation = { nameCn: string; nameEn: string }
export type SkillDecorationRelation = DecorationIdentity & { nameCn: string; nameEn: string; points: number; slots: number; iconPath: string | null }
export type SkillArmorRelation = ArmorIdentity & { nameCn: string; nameEn: string; points: number; part: ArmorPartId; iconPath: string | null }
export type SkillDetail = SkillIdentity & {
  nameCn: string
  nameEn: string
  activations: SkillActivation[]
  decorations: SkillDecorationRelation[]
  armors: SkillArmorRelation[]
}

export type ItemDetail = ItemSummary & {
  nameJp: string
  sellPrice: number | null
  buyPrice: number | null
  hexId: string | null
  mappingStatus: string
  relations: ItemRelation[]
}

export type ItemCatalogFilters = {
  gameId: GameId
  targetSaveId?: number
  query?: string
  rarity?: number
  maxStack?: number
  sourceKinds?: ItemSourceKind[]
  usageKinds?: ItemUsageKind[]
  includePlaceholders?: boolean
  sort?: 'saveId' | 'name' | 'rarity'
  page?: number
  pageSize?: number
}

export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number; hasNext: boolean }

export type WeaponViewMode = 'list' | 'tree'
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

export const sourceKindLabels: Record<string, string> = {
  combination: '调合', monster: '怪物获取', location: '地图采集', quest: '任务奖励', exchange: '山菜爷',
  weapon: '武器', armor: '防具', decoration: '装饰珠', 'palico-weapon': '猫武器',
  'palico-armor': '猫防具', kinsect: '猎虫',
}
