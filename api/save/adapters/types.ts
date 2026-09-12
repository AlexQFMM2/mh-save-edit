import type { SaveCharacterSummary, SaveDiagnostic, SaveEquipmentCell, SaveField, SaveFormatId, SaveItemCell, SavePalicoDetail, SavePalicoSummary, SaveSessionSnapshot } from '../types'

export type SaveAdapterMeta = {
  formatId: SaveFormatId
  contentGameId: SaveSessionSnapshot['contentGameId']
  platform: SaveSessionSnapshot['platform']
  emulator: SaveSessionSnapshot['emulator']
  recordSize: number
    itemCapacity: number
    itemCountMax: number
  hunterEquipmentCapacity: number
  palicoEquipmentCapacity: number
  palicoCount: number
}

export interface SaveDocumentAdapter {
  readonly meta: SaveAdapterMeta
  readonly sourceBytes: Buffer
  payload: Buffer
  readonly header: Buffer
  selectedCharacter: number | null
  characters(): SaveCharacterSummary[]
  selectCharacter(slot: number): void
  personalFields(): SaveField[]
  setPersonalField(field: string, value: string | number | boolean): void
  item(slot: number): Omit<SaveItemCell, 'nameCn' | 'nameEn' | 'iconPath' | 'maxStack' | 'rarity' | 'diagnostics'>
  items(start: number, count: number): Omit<SaveItemCell, 'nameCn' | 'nameEn' | 'iconPath' | 'maxStack' | 'rarity' | 'diagnostics'>[]
  setItem(slot: number, itemId: number, count: number): void
  equipment(slot: number, palico?: boolean): Omit<SaveEquipmentCell, 'nameCn' | 'nameEn' | 'typeNameCn' | 'iconPath' | 'weaponKey' | 'armorDexId' | 'palicoEquipmentId' | 'decorationLabels' | 'skill1NameCn' | 'skill2NameCn' | 'diagnostics'>
  setEquipment(slot: number, record: Buffer, palico?: boolean): void
  palico(index: number): SavePalicoDetail
  setPalico(index: number, changes: Record<string, unknown>): void
  palicoSummaries(): SavePalicoSummary[]
  validate(): SaveDiagnostic[]
  serialize(): Buffer
}

export function checkIndex(value: number, size: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= size) throw new Error(`${label}超出范围`)
}

export function signedByte(value: number): number { return value > 0x7f ? value - 0x100 : value }
export function emptyPalico(index: number): SavePalicoDetail {
  return { index, empty: true, name: '', level: 0, experience: 0, forte: 0, forteNameCn: '—', target: 0, targetNameCn: '—', received: false, enthusiasm: 0, greeting: '', nameGiver: '', previousOwner: '', equippedActions: [], equippedSkills: [], learnedActions: [], learnedSkills: [], actionPattern: 0, actionValidLength: 0, skillPattern: 0, skillValidLength: 0, voice: 0, eyes: 0, clothing: 0, coat: 0, ears: 0, tail: 0, coatColor: '00000000', rightEyeColor: '00000000', leftEyeColor: '00000000', vestColor: '00000000', status: 0, trainingState: 0, assignment: 0, prowlerSelected: 0, assignmentReferencesHex: '', diagnostics: [] }
}
