import type { GameId } from '../core/loadout'
import type { LoadoutSlot, LogicalLoadout } from '../loadout/types'

export type SaveFormatId = 'mh3g-3ds-citra' | 'mh3u-wiiu-cemu' | 'mh4g-3ds-citra' | 'mhgu-switch-yuzu' | 'mhxx-3ds-citra'
export type SaveSectionKey = 'personal-info' | 'item-box' | 'equipment-box' | 'palico'
export type SaveSessionState = 'closed' | 'opening' | 'selectingCharacter' | 'readyClean' | 'readyDirty' | 'validating' | 'saving' | 'closing'
export type SaveBoxDomain = 'items' | 'hunter-equipment' | 'palico-equipment'
/** Item-box stack limit; catalog maxStack describes the pouch limit instead. */
export const SAVE_BOX_ITEM_STACK_MAX = 99

export type SaveDiagnostic = {
  code: string
  path: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

export type SaveCapabilities = {
  canWrite: boolean
  canSaveAs: boolean
  canEditPersonal: boolean
  canEditItems: boolean
  canEditEquipment: boolean
  canEditPalicoes: boolean
  canSwapItems: boolean
  canSwapEquipment: boolean
  hasCharacters: boolean
  hasPalicoes: boolean
  itemCapacity: number
  itemCountMax: number
  hunterEquipmentCapacity: number
  palicoEquipmentCapacity: number
}

export type SaveSessionSnapshot = {
  sessionId: string
  revision: number
  state: SaveSessionState
  contentGameId: GameId
  formatId: SaveFormatId
  platform: '3ds' | 'wiiu' | 'switch'
  emulator: 'citra' | 'cemu' | 'yuzu'
  fileName: string
  characterSlot: number | null
  characterName: string | null
  dirty: boolean
  readOnly: boolean
  undoCount: number
  redoCount: number
  diagnostics: SaveDiagnostic[]
  capabilities: SaveCapabilities
}

export type SaveEnvironment = {
  formatId: SaveFormatId
  contentGameId: GameId
  title: string
  platform: SaveSessionSnapshot['platform']
  emulator: SaveSessionSnapshot['emulator']
  description: string
}

export type SaveCharacterSummary = {
  slot: number
  used: boolean
  name: string
  hunterRank: number
  playTimeSeconds: number
}

export type SaveFieldValue = string | number | boolean
export type SaveField = {
  key: string
  group: 'identity' | 'progress' | 'currency' | 'version'
  label: string
  value: SaveFieldValue
  valueType: 'text' | 'number' | 'select' | 'readonly'
  writable: boolean
  min?: number
  max?: number
  unit?: string
  options?: { value: string; label: string }[]
  diagnostic?: SaveDiagnostic
}

export type SavePersonalSection = {
  kind: 'personal-info'
  fields: SaveField[]
}

export type SaveItemCell = {
  slot: number
  empty: boolean
  itemId: number
  count: number
  nameCn: string
  nameEn: string
  iconPath: string | null
  maxStack: number | null
  rarity: number | null
  diagnostics: SaveDiagnostic[]
}

export type SaveEquipmentKind = 'empty' | 'weapon' | 'armor' | 'charm' | 'kinsect' | 'palico-weapon' | 'palico-head' | 'palico-body' | 'unknown'
export type SaveArmorAppearance = {
  appearanceId: number
  nameCn: string
  nameEn: string
  nameJp?: string
  part: 'head' | 'chest' | 'arms' | 'waist' | 'legs'
  rarity: number | null
  iconPath: string | null
  iconSource: 'dex-armor-category' | 'custom-appearance-sprite' | 'fallback'
  sourceStatus: 'confirmed' | 'unknown'
  iconFallback: boolean
}
export type SaveArmorAppearanceFilters = { gameId: 'mhgu'; saveType: number; query?: string; page?: number; pageSize?: number }
export type SaveArmorAppearancePage = { items: SaveArmorAppearance[]; total: number; page: number; pageSize: number; hasNext: boolean }

export type SaveEquipmentCell = {
  slot: number
  empty: boolean
  kind: SaveEquipmentKind
  saveType: number
  saveId: number
  level: number
  slots: number | null
  appearanceId: number | null
  appearance?: SaveArmorAppearance | null
  decorations: number[]
  skill1Id: number | null
  skill1Points: number | null
  skill2Id: number | null
  skill2Points: number | null
  nameCn: string
  nameEn: string
  typeNameCn: string
  iconPath: string | null
  weaponKey: string | null
  armorDexId: number | null
  palicoEquipmentId: number | null
  decorationLabels: { saveId: number; rawValue: number; nameCn: string; slots: number | null; fixed: boolean }[]
  skill1NameCn: string | null
  skill2NameCn: string | null
  recordHex: string
  diagnostics: SaveDiagnostic[]
}

export type SaveBoxSection = {
  kind: 'item-box' | 'equipment-box'
  domain: SaveBoxDomain
  page: number
  pageSize: 100
  pageCount: number
  totalSlots: number
  nonEmptyCount: number
  cells: (SaveItemCell | SaveEquipmentCell)[]
  query?: string
  matchingSlots?: number[]
  matchingCount?: number
}

export type SavePalicoSummary = {
  index: number
  empty: boolean
  name: string
  level: number
  forte: number
  forteNameCn: string
  target: number
  targetNameCn: string
  received: boolean
  diagnostics: SaveDiagnostic[]
}

export type SavePalicoDetail = SavePalicoSummary & {
  experience: number
  enthusiasm: number
  greeting: string
  nameGiver: string
  previousOwner: string
  equippedActions: number[]
  equippedSkills: number[]
  learnedActions: number[]
  learnedSkills: number[]
  actionPattern: number
  actionValidLength: number
  skillPattern: number
  skillValidLength: number
  voice: number
  eyes: number
  clothing: number
  coat: number
  ears: number
  tail: number
  coatColor: string
  rightEyeColor: string
  leftEyeColor: string
  vestColor: string
  status: number
  trainingState: number
  assignment: number
  prowlerSelected: number
  assignmentReferencesHex: string
}

export type SavePalicoGenerationPattern = {
  scope: 'normal_move' | 'charisma_move' | 'skill'
  patternId: number
  sequence: string
  validLength: number
  weight: number
}

export type SavePalicoGenerationGrant = {
  forteId: number
  kind: 'move' | 'skill'
  role: 'primary' | 'secondary' | 'secondary_fixed' | 'common' | 'innate'
  entryId: number
}

export type SavePalicoGenerationPoolEntry = {
  kind: 'move' | 'skill'
  group: 'A' | 'B' | 'C'
  entryId: number
}

export type SavePalicoGenerationRules = {
  patterns: SavePalicoGenerationPattern[]
  grants: SavePalicoGenerationGrant[]
  pools: SavePalicoGenerationPoolEntry[]
  source: string
}

export type SavePalicoSection = {
  kind: 'palico'
  entries: SavePalicoSummary[]
  selected: SavePalicoDetail | null
  generationRules: SavePalicoGenerationRules | null
}

export type SaveSectionSnapshot = SavePersonalSection | SaveBoxSection | SavePalicoSection

export type SaveOpenRequest = { contentGameId: GameId; formatId: SaveFormatId }
export type SaveOpenResult = { cancelled: boolean; session: SaveSessionSnapshot | null; characters: SaveCharacterSummary[] }
export type SaveSectionRequest = { sessionId: string; revision: number; section: SaveSectionKey; page?: number; domain?: SaveBoxDomain; selectedIndex?: number; query?: string; locateAfterSlot?: number }

export type SaveCommand =
  | { kind: 'set-personal-field'; sessionId: string; revision: number; field: string; value: SaveFieldValue }
  | { kind: 'set-item'; sessionId: string; revision: number; slot: number; itemId: number; count: number }
  | { kind: 'set-equipment-record'; sessionId: string; revision: number; domain: 'hunter-equipment' | 'palico-equipment'; slot: number; recordHex: string }
  | { kind: 'set-equipment-fields'; sessionId: string; revision: number; domain: 'hunter-equipment' | 'palico-equipment'; slot: number; changes: { reset?: boolean; saveType?: number; saveId?: number; level?: number; appearanceId?: number; decorations?: number[]; skill1Id?: number; skill1Points?: number; skill2Id?: number; skill2Points?: number; slots?: number } }
  | { kind: 'copy-box-slot'; sessionId: string; revision: number; domain: SaveBoxDomain; sourceSlot: number; targetSlot?: number }
  | { kind: 'clear-box-slot'; sessionId: string; revision: number; domain: SaveBoxDomain; slot: number }
  | { kind: 'swap-box-slots'; sessionId: string; revision: number; domain: SaveBoxDomain; sourceSlot: number; targetSlot: number }
  | { kind: 'set-palico'; sessionId: string; revision: number; index: number; changes: Partial<Omit<SavePalicoDetail, 'index' | 'empty' | 'level' | 'experience' | 'diagnostics' | 'forteNameCn' | 'targetNameCn' | 'received'>> }

export type SaveCommandDraft = SaveCommand extends infer Command ? Command extends SaveCommand ? Omit<Command, 'sessionId' | 'revision'> : never : never

export type SaveMutationResult = {
  session: SaveSessionSnapshot
  affectedSections: SaveSectionKey[]
  message: string
}

export type SaveValidationResult = { valid: boolean; diagnostics: SaveDiagnostic[] }
export type SaveResult = { cancelled: boolean; session: SaveSessionSnapshot; message: string }

export type SaveImportPreview = {
  token: string
  format: 'csv' | 'full'
  domain: SaveBoxDomain
  added: number
  overwritten: number
  cleared: number
  invalid: number
  unknown: number
  ignored: number
  diagnostics: SaveDiagnostic[]
}

export type SaveExportRequest = { sessionId: string; revision: number; domain: SaveBoxDomain; format: 'csv' | 'full' }
export type SaveImportRequest = { sessionId: string; revision: number; domain: SaveBoxDomain; format: 'csv' | 'full' }
export type SaveImportApplyRequest = { sessionId: string; revision: number; token: string; replaceAll?: boolean }
export type SaveCatalogItemRequest = { sessionId: string; revision: number; gameId: GameId; saveId: number; count: number; targetSlot?: number }
export type SaveCatalogItemWritePreview = {
  capacity: number
  nonEmptyCount: number
  itemNameCn: string
  requestedCount: number
  targets: { slot: number; page: number; cell: number; beforeCount: number; afterCount: number; addedCount: number }[]
}
export type SaveCatalogEquipmentRequest = { sessionId: string; revision: number; gameId: GameId; domain: 'hunter-equipment' | 'palico-equipment'; saveType: number; saveId: number; level?: number; appearanceId?: number; targetSlot?: number }
export type SaveLoadoutWriteRequest = { sessionId: string; revision: number; loadout: LogicalLoadout }
export type SaveLoadoutWritePreview = {
  capacity: number
  nonEmptyCount: number
  requiredSlots: number
  targets: { loadoutSlot: LoadoutSlot; nameCn: string; slot: number; page: number; cell: number }[]
}
export type SaveBoxWriteTargetRequest = { sessionId: string; revision: number; domain: SaveBoxDomain }
export type SaveBoxWriteTarget = {
  domain: SaveBoxDomain
  slot: number | null
  page: number | null
  cell: number | null
  capacity: number
  nonEmptyCount: number
  full: boolean
}

export const SAVE_ENVIRONMENTS: SaveEnvironment[] = [
  { formatId: 'mh3g-3ds-citra', contentGameId: 'mh3g', title: 'MH3G · 3DS · Citra', platform: '3ds', emulator: 'citra', description: '选择 Citra 的 user1、user2 或 user3 单角色文件。' },
  { formatId: 'mh3u-wiiu-cemu', contentGameId: 'mh3g', title: 'MH3U · Wii U · Cemu', platform: 'wiiu', emulator: 'cemu', description: '选择 Cemu 存档目录中的 user1、user2 或 user3。' },
  { formatId: 'mh4g-3ds-citra', contentGameId: 'mh4g', title: 'MH4G · 3DS · Citra', platform: '3ds', emulator: 'citra', description: '选择 Citra 的 MH4G user1、user2 或 user3。' },
  { formatId: 'mhgu-switch-yuzu', contentGameId: 'mhgu', title: 'MHGU · Switch · Yuzu', platform: 'switch', emulator: 'yuzu', description: '选择 Yuzu 存档目录中的 system；读取后再选择角色。' },
  { formatId: 'mhxx-3ds-citra', contentGameId: 'mhgu', title: 'MHXX · 3DS · Citra', platform: '3ds', emulator: 'citra', description: '选择 Citra 存档目录中的 system；读取后再选择角色。' },
]
