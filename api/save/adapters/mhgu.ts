import { bufferToHex, decodeUtf8, encodeUtf8, readU16, readU32, writeU16, writeU32 } from '../binary'
import type { SaveDiagnostic, SaveEquipmentKind, SaveField, SaveFormatId, SavePalicoDetail, SavePalicoSummary } from '../types'
import { checkIndex, emptyPalico, type SaveDocumentAdapter } from './types'

const MHXX_SIZE = 4_726_152
const MHGU_SIZE = 5_159_064
const HEADER_SIZE = 36
const NAME_OFFSET = 0x23b7d
const ITEM_OFFSET = 0x0278
const ITEM_BYTES = 5463
const ITEM_COUNT = 2300
const EQUIPMENT_OFFSET = 0x62ee
const EQUIPMENT_RECORD = 36
const EQUIPMENT_COUNT = 2000
const EQUIPPED_OFFSET = 0x0110
const EQUIPPED_RECORD = 44
const PALICO_EQUIPMENT_OFFSET = 0x17c2e
const PALICO_EQUIPMENT_COUNT = 1000
const PALICO_OFFSET = 0x23bb6
const PALICO_RECORD = 324
const PALICO_COUNT = 84
const MHXX_BASES = [0x126474, 0x244c34, 0x3633f4]
const MHGU_BASES = [0x18cc78, 0x2ac53c, 0x3cbe00]
const forteNames = ['领袖', '战斗', '防御', '治疗', '爆弹', '收集', '协助', '野兽']
const targetNames = ['平衡', '大型优先', '小型优先', '只打大型', '只打小型', '随从']

function hunterKind(type: number): SaveEquipmentKind {
  if (!type) return 'empty'
  if (type >= 1 && type <= 5) return 'armor'
  if (type === 6) return 'charm'
  if (type === 12) return 'kinsect'
  if ((type >= 7 && type <= 11) || (type >= 13 && type <= 21)) return 'weapon'
  return 'unknown'
}
function palicoKind(type: number): SaveEquipmentKind { return type === 22 ? 'palico-weapon' : type === 23 ? 'palico-head' : type === 24 ? 'palico-body' : type === 0 ? 'empty' : 'unknown' }
function bytesArray(buffer: Buffer, offset: number, length: number): number[] { return [...buffer.subarray(offset, offset + length)] }
function assertByteArray(value: unknown, length: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some(item => !Number.isInteger(item) || item < 0 || item > 255)) throw new Error(`${label}必须包含 ${length} 个字节值`)
  return value as number[]
}
function color(value: unknown, label: string): Buffer {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}$/i.test(value)) throw new Error(`${label}颜色编码无效`)
  return Buffer.from(value, 'hex')
}
function compact(values: number[]): boolean { let empty = false; for (const value of values) { if (!value) empty = true; else if (empty) return false } return true }
function subset(selected: number[], learned: number[]): boolean { const pool = new Set(learned.filter(value => value !== 0 && value !== 57 && value !== 96)); return selected.every(value => !value || pool.has(value)) }
function validateLearned(values: number[], validLength: number, sentinel: number, label: string) {
  if (!Number.isInteger(validLength) || validLength < 0 || validLength > values.length) throw new Error(`${label}有效长度超出数组范围`)
  if (values.slice(0, validLength).some(value => value === sentinel)) throw new Error(`${label}有效区域不能包含尾部哨兵 ${sentinel}`)
  if (values.slice(validLength).some(value => value !== sentinel)) throw new Error(`${label}有效区域外必须保留尾部哨兵 ${sentinel}`)
}

export class MhguSaveAdapter implements SaveDocumentAdapter {
  readonly meta
  readonly sourceBytes: Buffer
  readonly header: Buffer
  payload: Buffer
  selectedCharacter: number | null = null
  private readonly bases: number[]

  constructor(bytes: Buffer, expected: Extract<SaveFormatId, 'mhgu-switch-yuzu' | 'mhxx-3ds-citra'>, fileName = '') {
    if (fileName.toLocaleLowerCase() === 'system_backup') throw new Error('为避免破坏游戏备份，不能直接编辑 system_backup；请选择 system')
    let formatId: typeof expected
    if (bytes.length === MHXX_SIZE) formatId = 'mhxx-3ds-citra'
    else if (bytes.length === MHGU_SIZE || bytes.length === MHGU_SIZE + HEADER_SIZE) formatId = 'mhgu-switch-yuzu'
    else throw new Error(`文件大小不正确：MHXX 应为 ${MHXX_SIZE} 字节，MHGU 应为 ${MHGU_SIZE} 或 ${MHGU_SIZE + HEADER_SIZE} 字节`)
    if (formatId !== expected) throw new Error(`文件实际格式为 ${formatId}，与所选环境 ${expected} 不一致`)
    const headered = bytes.length === MHGU_SIZE + HEADER_SIZE
    this.sourceBytes = Buffer.from(bytes)
    this.header = headered ? Buffer.from(bytes.subarray(0, HEADER_SIZE)) : Buffer.alloc(0)
    this.payload = Buffer.from(bytes.subarray(headered ? HEADER_SIZE : 0))
    this.bases = formatId === 'mhxx-3ds-citra' ? MHXX_BASES : MHGU_BASES
    this.meta = { formatId, contentGameId: 'mhgu' as const, platform: formatId === 'mhxx-3ds-citra' ? '3ds' as const : 'switch' as const, emulator: formatId === 'mhxx-3ds-citra' ? 'citra' as const : 'yuzu' as const, recordSize: EQUIPMENT_RECORD, itemCapacity: ITEM_COUNT, itemCountMax: 0x7f, hunterEquipmentCapacity: EQUIPMENT_COUNT, palicoEquipmentCapacity: PALICO_EQUIPMENT_COUNT, palicoCount: PALICO_COUNT }
    const errors = this.validate().filter(issue => issue.severity === 'error')
    if (errors.length) throw new Error(errors.map(issue => issue.message).join('；'))
  }
  private base() { if (this.selectedCharacter == null) throw new Error('请先选择角色槽'); return this.bases[this.selectedCharacter] }
  characters() {
    return this.bases.map((base, slot) => {
      const used = this.payload[4 + slot] === 1
      return { slot, used, name: used ? decodeUtf8(this.payload, base + NAME_OFFSET, 32) : '', hunterRank: used ? readU16(this.payload, base + 0x28) : 0, playTimeSeconds: used ? readU32(this.payload, base + 0x20) : 0 }
    })
  }
  selectCharacter(slot: number) { checkIndex(slot, 3, '角色槽'); if (!this.characters()[slot].used) throw new Error('所选角色槽未使用'); this.selectedCharacter = slot }
  personalFields(): SaveField[] {
    const base = this.base()
    return [
      { key: 'name', group: 'identity', label: '角色名', value: decodeUtf8(this.payload, base + NAME_OFFSET, 32), valueType: 'text', writable: true },
      { key: 'playTime', group: 'progress', label: '游戏时间', value: readU32(this.payload, base + 0x20), valueType: 'number', writable: true, min: 0, max: 0xffffffff, unit: '秒' },
      { key: 'hunterRank', group: 'progress', label: '猎人等级', value: readU16(this.payload, base + 0x28), valueType: 'number', writable: true, min: 0, max: 999 },
      { key: 'hunterRankPoints', group: 'progress', label: '猎人等级点数', value: readU32(this.payload, base + 0x280b), valueType: 'number', writable: true, min: 0, max: 0xffffffff },
      { key: 'money', group: 'currency', label: '金钱', value: readU32(this.payload, base + 0x24), valueType: 'number', writable: true, min: 0, max: 9_999_999, unit: 'z' },
      { key: 'academyPoints', group: 'currency', label: '龙识院点数', value: readU32(this.payload, base + 0x2817), valueType: 'number', writable: true, min: 0, max: 9_999_999 },
      { key: 'bhernaPoints', group: 'version', label: '贝尔纳贡献度', value: readU32(this.payload, base + 0x281b), valueType: 'number', writable: true, min: 0, max: 9_999_999 },
      { key: 'kokotoPoints', group: 'version', label: '科科特贡献度', value: readU32(this.payload, base + 0x281f), valueType: 'number', writable: true, min: 0, max: 9_999_999 },
      { key: 'pokkePoints', group: 'version', label: '波凯贡献度', value: readU32(this.payload, base + 0x2823), valueType: 'number', writable: true, min: 0, max: 9_999_999 },
      { key: 'yukumoPoints', group: 'version', label: '结云贡献度', value: readU32(this.payload, base + 0x2827), valueType: 'number', writable: true, min: 0, max: 9_999_999 },
    ]
  }
  setPersonalField(field: string, value: string | number | boolean) {
    const base = this.base()
    if (field === 'name') { encodeUtf8(String(value), 32).copy(this.payload, base + NAME_OFFSET); return }
    const number = Number(value)
    if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) throw new Error('字段值超出编码范围')
    const offsets: Record<string, number> = { playTime: 0x20, money: 0x24, hunterRankPoints: 0x280b, academyPoints: 0x2817, bhernaPoints: 0x281b, kokotoPoints: 0x281f, pokkePoints: 0x2823, yukumoPoints: 0x2827 }
    if (field === 'hunterRank') { if (number > 999) throw new Error('猎人等级超出范围'); writeU16(this.payload, base + 0x28, number); return }
    const offset = offsets[field]; if (offset == null) throw new Error('未知个人字段')
    if (field !== 'playTime' && number > 9_999_999) throw new Error('点数超出允许范围')
    writeU32(this.payload, base + offset, number)
  }
  private decodeItems() {
    const encoded = Buffer.from(this.payload.subarray(this.base() + ITEM_OFFSET, this.base() + ITEM_OFFSET + ITEM_BYTES)).reverse()
    const values = Array.from({ length: ITEM_COUNT }, () => ({ id: 0, count: 0 })); let position = 4
    const bit = (at: number) => (encoded[Math.floor(at / 8)] >> (7 - at % 8)) & 1
    for (let slot = ITEM_COUNT - 1; slot >= 0; slot -= 1) {
      let count = 0; let id = 0
      for (let index = 0; index < 7; index += 1) count = (count << 1) | bit(position++)
      for (let index = 0; index < 12; index += 1) id = (id << 1) | bit(position++)
      values[slot] = { id, count }
    }
    return values
  }
  private encodeItems(values: { id: number; count: number }[]) {
    const encoded = Buffer.alloc(ITEM_BYTES); let position = 4
    const put = (value: number, width: number) => { for (let index = width - 1; index >= 0; index -= 1, position += 1) if ((value >> index) & 1) encoded[Math.floor(position / 8)] |= 1 << (7 - position % 8) }
    for (let slot = ITEM_COUNT - 1; slot >= 0; slot -= 1) { put(values[slot].count & 0x7f, 7); put(values[slot].id & 0x0fff, 12) }
    encoded.reverse().copy(this.payload, this.base() + ITEM_OFFSET)
  }
  item(slot: number) { checkIndex(slot, ITEM_COUNT, '道具格'); const value = this.decodeItems()[slot]; return { slot, empty: !value.id, itemId: value.id, count: value.count } }
  items(start: number, count: number) { const values = this.decodeItems(); return values.slice(start, start + count).map((value, index) => ({ slot: start + index, empty: !value.id, itemId: value.id, count: value.count })) }
  setItem(slot: number, itemId: number, count: number) { checkIndex(slot, ITEM_COUNT, '道具格'); if (!Number.isInteger(itemId) || itemId < 0 || itemId > 0xfff || !Number.isInteger(count) || count < 0 || count > 0x7f) throw new Error('道具 ID 或数量超出 GU/XX 编码范围'); const values = this.decodeItems(); values[slot] = itemId ? { id: itemId, count } : { id: 0, count: 0 }; this.encodeItems(values) }
  equipment(slot: number, palico = false) {
    const capacity = palico ? PALICO_EQUIPMENT_COUNT : EQUIPMENT_COUNT; checkIndex(slot, capacity, '装备格'); const start = this.base() + (palico ? PALICO_EQUIPMENT_OFFSET : EQUIPMENT_OFFSET) + slot * EQUIPMENT_RECORD; const record = Buffer.from(this.payload.subarray(start, start + EQUIPMENT_RECORD))
    if (palico) { const type = record[0]; return { slot, empty: !type, kind: palicoKind(type), saveType: type, saveId: readU16(record, 2), level: record[1], slots: null, appearanceId: readU16(record, 4), appearance: null, decorations: [], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, recordHex: bufferToHex(record) } }
    const packed = readU16(record, 0); const type = packed & 0x1f; const level = (packed >> 5) & 0x1f; const kind = hunterKind(type)
    return { slot, empty: !type, kind, saveType: type, saveId: readU16(record, 2), level, slots: kind === 'charm' ? record[16] : null, appearanceId: readU16(record, 4), appearance: null, decorations: [readU16(record, 6), readU16(record, 8), readU16(record, 10)], skill1Id: kind === 'charm' ? record[12] : null, skill1Points: kind === 'charm' ? record.readInt8(14) : null, skill2Id: kind === 'charm' ? record[13] : null, skill2Points: kind === 'charm' ? record.readInt8(15) : null, recordHex: bufferToHex(record) }
  }
  setEquipment(slot: number, record: Buffer, palico = false) {
    const capacity = palico ? PALICO_EQUIPMENT_COUNT : EQUIPMENT_COUNT; checkIndex(slot, capacity, '装备格')
    if (record.length !== EQUIPMENT_RECORD) throw new Error('GU/XX 装备记录必须为 36 字节')
    const type = palico ? record[0] : readU16(record, 0) & 0x1f
    if (palico ? ![0, 22, 23, 24].includes(type) : !(type <= 11 || (type >= 13 && type <= 21))) throw new Error('装备类型无效')
    const target = this.base() + (palico ? PALICO_EQUIPMENT_OFFSET : EQUIPMENT_OFFSET) + slot * EQUIPMENT_RECORD
    if (palico) { record.copy(this.payload, target); return }
    const oldKey = Buffer.from(this.payload.subarray(target, target + 12))
    const matchingEquipped: number[] = []
    for (let index = 0; index < 7; index += 1) {
      const offset = this.base() + EQUIPPED_OFFSET + index * EQUIPPED_RECORD
      if (this.payload.subarray(offset, offset + 12).equals(oldKey)) matchingEquipped.push(offset)
    }
    let identicalBoxEntries = 0
    for (let index = 0; index < EQUIPMENT_COUNT; index += 1) {
      const offset = this.base() + EQUIPMENT_OFFSET + index * EQUIPMENT_RECORD
      if (this.payload.subarray(offset, offset + 12).equals(oldKey)) identicalBoxEntries += 1
    }
    record.copy(this.payload, target)
    if (identicalBoxEntries === 1 && matchingEquipped.length === 1) record.copy(this.payload, matchingEquipped[0])
  }
  palico(index: number): SavePalicoDetail {
    checkIndex(index, PALICO_COUNT, '猎猫记录'); const start = this.base() + PALICO_OFFSET + index * PALICO_RECORD; const record = this.payload.subarray(start, start + PALICO_RECORD); const name = decodeUtf8(record as Buffer, 0, 32)
    let received = false; for (let offset = 0x58; offset < 0x5f; offset += 1) received ||= record[offset] !== 0
    const forte = record[0x25]; const target = record[0x27]; const diagnostics: SaveDiagnostic[] = []
    if (forte > 7) diagnostics.push({ code: 'palico.forte.unknown', path: `palicoes.${index}.forte`, severity: 'warning', message: '支援倾向无法识别，保存时将保留原值' })
    return { index, empty: !name, name, level: record[0x24] + 1, experience: readU32(record as Buffer, 0x20), forte, forteNameCn: forteNames[forte] ?? `未知倾向 ${forte}`, target, targetNameCn: targetNames[target] ?? `未知目标 ${target}`, received, enthusiasm: record[0x26], greeting: decodeUtf8(record as Buffer, 0x60, 60), nameGiver: decodeUtf8(record as Buffer, 0x9c, 32), previousOwner: decodeUtf8(record as Buffer, 0xbc, 32), equippedActions: bytesArray(record as Buffer, 0x28, 8), equippedSkills: bytesArray(record as Buffer, 0x30, 8), learnedActions: bytesArray(record as Buffer, 0x38, 16), learnedSkills: bytesArray(record as Buffer, 0x48, 12), actionPattern: record[0x54], actionValidLength: record[0x55], skillPattern: record[0x56], skillValidLength: record[0x57], status: record[0xe0], trainingState: record[0xe1], assignment: record[0xe2], prowlerSelected: record[0xe3], assignmentReferencesHex: bufferToHex(record.subarray(0x100, 0x106) as Buffer), voice: record[0x10f], eyes: record[0x110], clothing: record[0x111], coat: record[0x114], ears: record[0x115], tail: record[0x116], coatColor: bufferToHex(record.subarray(0x11a, 0x11e) as Buffer), rightEyeColor: bufferToHex(record.subarray(0x11e, 0x122) as Buffer), leftEyeColor: bufferToHex(record.subarray(0x122, 0x126) as Buffer), vestColor: bufferToHex(record.subarray(0x126, 0x12a) as Buffer), diagnostics }
  }
  palicoSummaries(): SavePalicoSummary[] { return Array.from({ length: PALICO_COUNT }, (_, index) => { const value = this.palico(index); const { experience: _e, enthusiasm: _h, greeting: _g, nameGiver: _n, previousOwner: _p, equippedActions: _ea, equippedSkills: _es, learnedActions: _la, learnedSkills: _ls, actionPattern: _ap, actionValidLength: _al, skillPattern: _sp, skillValidLength: _sl, voice: _v, eyes: _ey, clothing: _c, coat: _co, ears: _er, tail: _t, coatColor: _cc, rightEyeColor: _rc, leftEyeColor: _lc, vestColor: _vc, status: _st, trainingState: _ts, assignment: _as, prowlerSelected: _ps, assignmentReferencesHex: _ar, ...summary } = value; return summary }) }
  setPalico(index: number, changes: Record<string, unknown>) {
    checkIndex(index, PALICO_COUNT, '猎猫记录'); if ('level' in changes || 'experience' in changes) throw new Error('猎猫等级与 EXP 为只读字段')
    const start = this.base() + PALICO_OFFSET + index * PALICO_RECORD; const record = this.payload.subarray(start, start + PALICO_RECORD)
    const current = this.palico(index)
    const nextActions = 'learnedActions' in changes ? assertByteArray(changes.learnedActions, 16, 'learnedActions') : current.learnedActions
    const nextSkills = 'learnedSkills' in changes ? assertByteArray(changes.learnedSkills, 12, 'learnedSkills') : current.learnedSkills
    const nextEquippedActions = 'equippedActions' in changes ? assertByteArray(changes.equippedActions, 8, 'equippedActions') : current.equippedActions
    const nextEquippedSkills = 'equippedSkills' in changes ? assertByteArray(changes.equippedSkills, 8, 'equippedSkills') : current.equippedSkills
    if ('learnedActions' in changes || 'actionValidLength' in changes) validateLearned(nextActions, Number(changes.actionValidLength ?? current.actionValidLength), 57, '已学行动')
    if ('learnedSkills' in changes || 'skillValidLength' in changes) validateLearned(nextSkills, Number(changes.skillValidLength ?? current.skillValidLength), 96, '已学技能')
    if ('equippedActions' in changes || 'learnedActions' in changes) { if (!compact(nextEquippedActions)) throw new Error('已装备行动必须从前向后连续排列'); if (!subset(nextEquippedActions, nextActions)) throw new Error('已装备行动必须来自已学行动池') }
    if ('equippedSkills' in changes || 'learnedSkills' in changes) { if (!compact(nextEquippedSkills)) throw new Error('已装备技能必须从前向后连续排列'); if (!subset(nextEquippedSkills, nextSkills)) throw new Error('已装备技能必须来自已学技能池') }
    const strings: Record<string, [number, number]> = { name: [0, 32], greeting: [0x60, 60], nameGiver: [0x9c, 32], previousOwner: [0xbc, 32] }
    for (const [key, [offset, length]] of Object.entries(strings)) if (key in changes) encodeUtf8(String(changes[key]), length).copy(record, offset)
    const bytes: Record<string, number> = { forte: 0x25, enthusiasm: 0x26, target: 0x27, actionPattern: 0x54, actionValidLength: 0x55, skillPattern: 0x56, skillValidLength: 0x57, voice: 0x10f, eyes: 0x110, clothing: 0x111, coat: 0x114, ears: 0x115, tail: 0x116 }
    for (const [key, offset] of Object.entries(bytes)) if (key in changes) { const value = Number(changes[key]); if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error(`${key} 超出编码范围`); record[offset] = value }
    const arrays: Record<string, [number, number]> = { equippedActions: [0x28, 8], equippedSkills: [0x30, 8], learnedActions: [0x38, 16], learnedSkills: [0x48, 12] }
    for (const [key, [offset, length]] of Object.entries(arrays)) if (key in changes) Buffer.from(assertByteArray(changes[key], length, key)).copy(record, offset)
    const colors: Record<string, number> = { coatColor: 0x11a, rightEyeColor: 0x11e, leftEyeColor: 0x122, vestColor: 0x126 }
    for (const [key, offset] of Object.entries(colors)) if (key in changes) color(changes[key], key).copy(record, offset)
  }
  validate(): SaveDiagnostic[] {
    const diagnostics: SaveDiagnostic[] = []
    if (readU32(this.payload, 0) !== 0xc6 || readU32(this.payload, 8) !== 0x1c) diagnostics.push({ code: 'mhgu.header', path: 'header', severity: 'error', message: 'system 文件标识不正确' })
    for (let slot = 0; slot < 3; slot += 1) {
      if (this.payload[4 + slot] > 1) diagnostics.push({ code: 'mhgu.slot.flag', path: `characters.${slot}`, severity: 'error', message: `角色槽 ${slot + 1} 使用标记无效` })
      if (readU32(this.payload, 0x10 + slot * 4) !== this.bases[slot]) diagnostics.push({ code: 'mhgu.slot.base', path: `characters.${slot}`, severity: 'error', message: `角色槽 ${slot + 1} 基址与格式不一致` })
    }
    return diagnostics
  }
  serialize() { return Buffer.concat([this.header, this.payload]) }
}
