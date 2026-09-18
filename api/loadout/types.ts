import type { GameId } from '../core/loadout'
import type { Mh4gCharmNativeInput, Mh4gCharmWitness } from './mh4gCharmTypes'

export type LoadoutGame = GameId
export type LoadoutSlot = 'weapon' | 'head' | 'chest' | 'arms' | 'waist' | 'legs' | 'charm'
export type ArmorLoadoutSlot = Exclude<LoadoutSlot, 'weapon' | 'charm'>
export type LegalityStatus = 'confirmed' | 'invalid' | 'unknown'
export type EncodingStatus = 'encodable' | 'blocked'
export type InstanceSource = 'catalogTemplate' | 'importedLoadout' | 'saveInstance'
export type LoadoutLock = 'unlocked' | 'equipment' | 'equipmentAndDecorations'

export type LoadoutIssue = {
  code: string
  path: string
  severity: 'error' | 'warning' | 'info'
  message: string
  source?: string
}

export type LoadoutInstanceState = {
  source: InstanceSource
  /** Present for instances imported from a save; catalog relic templates remain MH4G-only. */
  formatId?: 'mh3g-3ds-citra' | 'mh3u-wiiu-cemu' | 'mh4g-3ds-citra' | 'mhgu-switch-yuzu' | 'mhxx-3ds-citra'
  recordHex: string
  legality: LegalityStatus
  encoding: EncodingStatus
  issues: LoadoutIssue[]
  patches?: { offset: number; before: number; after: number }[]
}

export type LoadoutDecoration = {
  saveId: number
  nameCn: string
  slots: number
  skills: LoadoutSkillPoint[]
  fixed?: boolean
}

export type LoadoutSkillPoint = { skillId: number; nameCn: string; points: number }

export type LoadoutWeaponCandidate = {
  kind: 'weapon'
  gameId: LoadoutGame
  candidateKey: string
  sourceKind: 'catalog' | 'relicTemplate'
  weaponKey: string | null
  templateKey: string | null
  saveType: number
  saveId: number
  /** Native upgrade level stored beside saveId; required to identify GU/XX weapon rows. */
  saveLevel?: number
  nameCn: string
  nameEn: string
  typeId: number
  typeNameCn: string
  rarity: number | null
  slots: number
  attack: number | null
  affinity: number | null
  defense: number
  directlyProducible?: boolean
  iconPath: string | null
  instance?: LoadoutInstanceState
  /** Embedded decorations decoded from an editable relic record. */
  decorations?: LoadoutDecoration[]
}

export type LoadoutArmorCandidate = {
  kind: 'armor'
  gameId: LoadoutGame
  candidateKey: string
  sourceKind: 'catalog' | 'relicTemplate'
  dexId: number | null
  templateKey: string | null
  saveType: number | null
  saveId: number | null
  nameCn: string
  nameEn: string
  part: ArmorLoadoutSlot
  combat: 'both' | 'blademaster' | 'gunner'
  gender: 'both' | 'male' | 'female'
  rarity: number | null
  slots: number
  baseDefense: number
  maxDefense: number
  fireRes: number
  waterRes: number
  thunderRes: number
  iceRes: number
  dragonRes: number
  iconPath: string | null
  skills: LoadoutSkillPoint[]
  instance?: LoadoutInstanceState
  /** Embedded decorations decoded from an editable relic record. */
  decorations?: LoadoutDecoration[]
}

export type LoadoutCharm = {
  kind: 'charm'
  /** Keeps picker identity access type-safe; charms are edited, never catalog-selected. */
  candidateKey?: undefined
  gameId: LoadoutGame
  classId: number
  classNameCn: string
  iconPath?: string | null
  slots: number
  skill1: LoadoutSkillPoint | null
  skill2: LoadoutSkillPoint | null
  decorations: LoadoutDecoration[]
  legality: LegalityStatus
  encoding: EncodingStatus
  issues: LoadoutIssue[]
  instance?: LoadoutInstanceState
}

export type LoadoutWeapon = LoadoutWeaponCandidate & {
  decorations: LoadoutDecoration[]
  lock: LoadoutLock
}

export type LoadoutArmor = LoadoutArmorCandidate & {
  decorations: LoadoutDecoration[]
  lock: LoadoutLock
}

export type LogicalLoadout = {
  schemaVersion: 1
  dataVersion: string
  gameId: LoadoutGame
  name: string
  gender: 'male' | 'female'
  weapon: LoadoutWeapon | null
  armor: Partial<Record<ArmorLoadoutSlot, LoadoutArmor>>
  charm: (LoadoutCharm & { lock: LoadoutLock }) | null
}

export type LoadoutActivation = {
  activationKey: string
  skillId: number
  threshold: number
  direction: 'positive' | 'negative' | 'special'
  nameCn: string
}

export type LoadoutSkillDefinition = {
  skillId: number
  nameCn: string
  nameEn: string
  nameJp: string
  activations: LoadoutActivation[]
}

export type LoadoutCharmClass = {
  classId: number
  nameCn: string
  nameEn: string
  maxSlots: number
  iconPath?: string | null
}

export type LoadoutCharmRange = {
  rangeKey: string
  classId: number
  skillId: number
  position: 'A' | 'B'
  minPoints: number
  maxPoints: number
  slotCount: number | null
  maxSlots: number | null
  status: 'exact' | 'rule' | 'unknown'
  source: string
}

export type CharmSlotRule = {
  classId: number
  maxSlots: number
  fulfillment: number
  thresholds: [number, number, number]
  source: string
  evidence: 'verified' | 'reference'
}

export type LoadoutRelicLookup = {
  kind: string
  key: string
  payload: Record<string, unknown>
  source: string
}

export type LoadoutCalculationSnapshot = {
  gameId: LoadoutGame
  dataVersion: string
  decorations: LoadoutDecoration[]
  skills: LoadoutSkillDefinition[]
  charmClasses: LoadoutCharmClass[]
  charmRanges: LoadoutCharmRange[]
  charmSlotRules?: CharmSlotRule[]
  mh4gCharmRules?: Mh4gCharmNativeInput
  /** Missing/corrupt evidence is reported, never silently promoted to verified. */
  mh4gCharmRulesIssue?: string
  mh4gCharmWitnesses?: Mh4gCharmWitness[]
  mh4gCharmWitnessSource?: string
  mh4gCharmWitnessIssue?: string
  /** Exact joint rows: class, slots, first ID/points, second ID/points. */
  charmCombinations?: [number, number, number, number, number, number][]
  relicLookups: LoadoutRelicLookup[]
}

export type LoadoutCatalogSnapshot = LoadoutCalculationSnapshot & {
  weapons: LoadoutWeaponCandidate[]
  armors: LoadoutArmorCandidate[]
}

export type LoadoutSlotResult = {
  slot: LoadoutSlot
  lock: LoadoutLock
  nameCn: string
  decorations: { saveId: number; nameCn: string; slots: number }[]
  naturalSlots: number
  usedSlots: number
  remainingSlots: number
  legality: LegalityStatus
  encoding: EncodingStatus
  issues: LoadoutIssue[]
}

export type LoadoutSkillResult = {
  skillId: number
  nameCn: string
  weapon: number
  head: number
  chest: number
  arms: number
  waist: number
  legs: number
  charm: number
  decorations: number
  special: number
  total: number
  activation: LoadoutActivation | null
  nextActivation: LoadoutActivation | null
}

export type LoadoutResult = {
  defense: number
  maxDefense: number
  armorStats: { part: ArmorLoadoutSlot; nameCn: string; combat: LoadoutArmorCandidate['combat']; slots: number; baseDefense: number; maxDefense: number; fireRes: number; waterRes: number; thunderRes: number; iceRes: number; dragonRes: number }[]
  resistances: { fire: number; water: number; thunder: number; ice: number; dragon: number }
  slots: LoadoutSlotResult[]
  skills: LoadoutSkillResult[]
  activations: LoadoutActivation[]
  issues: LoadoutIssue[]
  legality: LegalityStatus
  encoding: EncodingStatus
}

export type CharmValidationResult = {
  legality: LegalityStatus
  encoding: EncodingStatus
  issues: LoadoutIssue[]
  ranges: { position: 'A' | 'B'; min: number; max: number; source: string }[]
}

export type AutoLoadoutTarget = { activationKey: string; skillId: number; threshold: number; nameCn: string }
export type AutoLoadoutRequest = {
  /** Optional provenance, validated only when explicitly creating a new job. */
  parentJobId?: string
  requestId: string
  gameId: LoadoutGame
  dataVersion: string
  baseLoadout: LogicalLoadout
  targets: AutoLoadoutTarget[]
  resultLimit: number
  timeoutMs: number
}
export type AutoLoadoutResult = { fingerprint: string; loadout: LogicalLoadout; calculation: LoadoutResult; searchComplete?: boolean; incompleteReason?: 'timeout' | 'candidate-bound' | 'unknown-charm-range' | 'search-error' }
export type AutoLoadoutProgress = { requestId: string; stage: string; checked: number; verified?: number; estimatedTotal?: number | null; results: number; elapsedMs: number; searchComplete?: boolean; incompleteReason?: 'timeout' | 'candidate-bound' | 'unknown-charm-range' | 'search-error'; coverageWarnings?: string[] }
export type AutoLoadoutSearchReport = { results: AutoLoadoutResult[]; progress: AutoLoadoutProgress }
export type AutoLoadoutJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed' | 'interrupted'
export type AutoLoadoutJobSummary = {
  jobId: string
  parentJobId: string | null
  gameId: LoadoutGame
  dataVersion: string
  status: AutoLoadoutJobStatus
  createdAt: string
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
  targets: AutoLoadoutTarget[]
  timeoutMs: number
  progress: AutoLoadoutProgress | null
  resultCount: number
  error: string | null
  selectedFingerprint: string | null
  viewedAt: string | null
}
export type AutoLoadoutJobDetail = AutoLoadoutJobSummary & {
  request: AutoLoadoutRequest
  results: AutoLoadoutResult[]
}
export type AutoLoadoutJobFilters = {
  gameId?: LoadoutGame
  statuses?: AutoLoadoutJobStatus[]
  query?: string
  limit?: number
}
export type AutoLoadoutJob = AutoLoadoutJobSummary
/** Legacy renderer shape kept for older callers while the task API migrates. */
export type AutoLoadoutJobState = { status: AutoLoadoutJobStatus; progress: AutoLoadoutProgress | null; results: AutoLoadoutResult[]; error?: string }

export type LoadoutWeaponFilters = { gameId: LoadoutGame; query?: string; typeId?: number; sourceKind?: 'all' | 'catalog' | 'relicTemplate'; rarity?: number; slots?: number; directlyProducible?: boolean; finalOnly?: boolean; sort?: 'source' | 'rarity' | 'slots' | 'attack'; page?: number; pageSize?: number }
export type LoadoutArmorFilters = { gameId: LoadoutGame; part: ArmorLoadoutSlot; query?: string; skillId?: number; sourceKind?: 'all' | 'catalog' | 'relicTemplate'; rarity?: number; slots?: number; combat?: 'blademaster' | 'gunner'; gender?: 'male' | 'female'; sort?: 'source' | 'rarity' | 'slots' | 'defense' | 'skill'; page?: number; pageSize?: number }
export type LoadoutDecorationFilters = { gameId: LoadoutGame; query?: string; skillId?: number; page?: number; pageSize?: number }
export type LoadoutPage<T> = { items: T[]; page: number; pageSize: number; total: number; hasNext: boolean }
export type LoadoutFacets = { skills: { skillId: number; nameCn: string; nameEn: string; nameJp: string }[]; weaponTypes: { typeId: number; nameCn: string }[]; weaponRarities: number[]; armorRarities: number[]; charmClasses: LoadoutCharmClass[] }

export const LOADOUT_SLOTS: readonly LoadoutSlot[] = ['weapon', 'head', 'chest', 'arms', 'waist', 'legs', 'charm']
export const ARMOR_LOADOUT_SLOTS: readonly ArmorLoadoutSlot[] = ['head', 'chest', 'arms', 'waist', 'legs']

export function createEmptyLogicalLoadout(gameId: LoadoutGame, dataVersion = ''): LogicalLoadout {
  return { schemaVersion: 1, dataVersion, gameId, name: '未命名配装', gender: 'male', weapon: null, armor: {}, charm: null }
}
