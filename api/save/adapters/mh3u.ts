import iconv from 'iconv-lite'
import { bufferToHex, decodeUtf8, encodeUtf8, readU16, readU32, writeU16, writeU32 } from '../binary'
import type { SaveDiagnostic, SaveEquipmentKind, SaveField, SaveFormatId, SavePalicoDetail, SavePalicoSummary } from '../types'
import { checkIndex, emptyPalico, signedByte, type SaveDocumentAdapter } from './types'

const SAVE_SIZE = 0x8a00
const WIIU_HEADER = 0x24
const ITEM_OFFSET = 0x018c
const ITEM_COUNT = 1000
const EQUIPMENT_OFFSET = 0x112c
const EQUIPMENT_COUNT = 1000
const RECORD_SIZE = 16

const equipmentKinds: Record<number, SaveEquipmentKind> = { 0: 'empty', 1: 'armor', 2: 'armor', 3: 'armor', 4: 'armor', 5: 'armor', 6: 'charm', 7: 'weapon', 8: 'weapon', 9: 'weapon', 10: 'weapon', 11: 'weapon', 12: 'unknown', 13: 'weapon', 14: 'weapon', 15: 'weapon', 16: 'weapon', 17: 'weapon', 18: 'weapon', 19: 'weapon' }

export class Mh3uSaveAdapter implements SaveDocumentAdapter {
  readonly meta
  readonly sourceBytes: Buffer
  readonly header: Buffer
  payload: Buffer
  selectedCharacter: number | null = 0
  private readonly bigEndian: boolean

  constructor(bytes: Buffer, formatId: Extract<SaveFormatId, 'mh3g-3ds-citra' | 'mh3u-wiiu-cemu'>) {
    this.bigEndian = formatId === 'mh3u-wiiu-cemu'
    const expected = this.bigEndian ? SAVE_SIZE + WIIU_HEADER : SAVE_SIZE
    if (bytes.length !== expected) throw new Error(`文件大小不正确：应为 ${expected} 字节，实际为 ${bytes.length} 字节`)
    if (this.bigEndian && !(bytes[0x1c] === 0 && bytes[0x1d] === 0 && bytes[0x1e] === 0x8a && bytes[0x1f] === 0)) throw new Error('Wii U 存档头无效')
    this.sourceBytes = Buffer.from(bytes)
    this.header = this.bigEndian ? Buffer.from(bytes.subarray(0, WIIU_HEADER)) : Buffer.alloc(0)
    this.payload = Buffer.from(bytes.subarray(this.bigEndian ? WIIU_HEADER : 0))
    if (this.payload[4] > 1 || this.payload[5] > 64 || this.payload[6] > 64) throw new Error('存档角色结构校验失败')
    this.meta = { formatId, contentGameId: 'mh3g' as const, platform: this.bigEndian ? 'wiiu' as const : '3ds' as const, emulator: this.bigEndian ? 'cemu' as const : 'citra' as const, recordSize: RECORD_SIZE, itemCapacity: ITEM_COUNT, itemCountMax: 0xffff, hunterEquipmentCapacity: EQUIPMENT_COUNT, palicoEquipmentCapacity: 0, palicoCount: 0 }
  }

  private name(): string {
    const raw = this.payload.subarray(7, 7 + (this.bigEndian ? 16 : 10))
    const end = raw.indexOf(0)
    return this.bigEndian ? iconv.decode(raw.subarray(0, end < 0 ? raw.length : end), 'gb2312') : decodeUtf8(this.payload, 7, 10)
  }
  characters() { return [{ slot: 0, used: Boolean(this.name()), name: this.name(), hunterRank: 0, playTimeSeconds: 0 }] }
  selectCharacter(slot: number) { if (slot !== 0) throw new Error('该格式只有一个角色'); this.selectedCharacter = 0 }
  personalFields(): SaveField[] {
    const format: SaveField['valueType'] = 'number'
    return [
      { key: 'name', group: 'identity', label: '角色名', value: this.name(), valueType: 'text', writable: true },
      { key: 'sex', group: 'identity', label: '性别', value: this.payload[4], valueType: 'select', writable: true, options: [{ value: '0', label: '男性' }, { value: '1', label: '女性' }] },
      { key: 'face', group: 'identity', label: '脸型', value: this.payload[5], valueType: format, writable: true, min: 0, max: 255 },
      { key: 'hair', group: 'identity', label: '发型', value: this.payload[6], valueType: format, writable: true, min: 0, max: 255 },
      { key: 'voice', group: 'identity', label: '声音', value: this.payload[0xab], valueType: format, writable: true, min: 0, max: 255 },
      { key: 'money', group: 'currency', label: '金钱', value: readU32(this.payload, 0x24, this.bigEndian), valueType: format, writable: true, min: 0, max: 9_999_999, unit: 'z' },
      { key: 'mogaPoints', group: 'currency', label: '莫加村点数', value: readU32(this.payload, 0x5b2c, this.bigEndian), valueType: format, writable: true, min: 0, max: 9_999_999 },
    ]
  }
  setPersonalField(field: string, value: string | number | boolean) {
    if (field === 'name') {
      const size = this.bigEndian ? 16 : 10
      const encoded = this.bigEndian ? iconv.encode(String(value), 'gb2312') : encodeUtf8(String(value), size)
      if (encoded.length >= size) throw new Error(`角色名编码后必须少于 ${size} 字节`)
      this.payload.fill(0, 7, 7 + size); encoded.copy(this.payload, 7); return
    }
    const number = Number(value)
    if (!Number.isInteger(number) || number < 0) throw new Error('字段值无效')
    if (field === 'sex') { if (number > 1) throw new Error('性别枚举无效'); this.payload[4] = number; return }
    if (field === 'face') { if (number > 255) throw new Error('脸型超出编码范围'); this.payload[5] = number; return }
    if (field === 'hair') { if (number > 255) throw new Error('发型超出编码范围'); this.payload[6] = number; return }
    if (field === 'voice') { if (number > 255) throw new Error('声音超出编码范围'); this.payload[0xab] = number; return }
    if (field === 'money') { if (number > 9_999_999) throw new Error('金钱超出范围'); writeU32(this.payload, 0x24, number, this.bigEndian); return }
    if (field === 'mogaPoints') { if (number > 9_999_999) throw new Error('莫加村点数超出范围'); writeU32(this.payload, 0x5b2c, number, this.bigEndian); return }
    throw new Error('当前格式不支持该字段')
  }
  item(slot: number) { checkIndex(slot, ITEM_COUNT, '道具格'); const offset = ITEM_OFFSET + slot * 4; const itemId = readU16(this.payload, offset, this.bigEndian); const count = readU16(this.payload, offset + 2, this.bigEndian); return { slot, empty: itemId === 0, itemId, count } }
  items(start: number, count: number) { return Array.from({ length: Math.max(0, Math.min(count, ITEM_COUNT - start)) }, (_, index) => this.item(start + index)) }
  setItem(slot: number, itemId: number, count: number) { checkIndex(slot, ITEM_COUNT, '道具格'); if (itemId < 0 || itemId > 0xffff || count < 0 || count > 0xffff) throw new Error('道具 ID 或数量超出编码范围'); const offset = ITEM_OFFSET + slot * 4; writeU16(this.payload, offset, itemId, this.bigEndian); writeU16(this.payload, offset + 2, itemId ? count : 0, this.bigEndian) }
  equipment(slot: number) {
    checkIndex(slot, EQUIPMENT_COUNT, '装备格'); const offset = EQUIPMENT_OFFSET + slot * RECORD_SIZE; const disk = Buffer.from(this.payload.subarray(offset, offset + RECORD_SIZE));
    if (this.bigEndian) for (const position of [2, 8, 10, 12]) [disk[position], disk[position + 1]] = [disk[position + 1], disk[position]]
    const saveType = disk[0]; const kind = equipmentKinds[saveType] ?? 'unknown'; const saveId = disk.readUInt16LE(2); const decorations = [disk.readUInt16LE(8), disk.readUInt16LE(10), disk.readUInt16LE(12)];
    return { slot, empty: saveType === 0, kind, saveType, saveId, level: disk[1], slots: kind === 'charm' ? disk[1] : null, appearanceId: null, appearance: null, decorations, skill1Id: kind === 'charm' ? disk[4] : null, skill1Points: kind === 'charm' ? signedByte(disk[5]) : null, skill2Id: kind === 'charm' ? disk[6] : null, skill2Points: kind === 'charm' ? signedByte(disk[7]) : null, recordHex: bufferToHex(disk) }
  }
  setEquipment(slot: number, record: Buffer) { checkIndex(slot, EQUIPMENT_COUNT, '装备格'); if (record.length !== RECORD_SIZE) throw new Error('MH3G/MH3U 装备记录必须为 16 字节'); const disk = Buffer.from(record); if (this.bigEndian) for (const position of [2, 8, 10, 12]) [disk[position], disk[position + 1]] = [disk[position + 1], disk[position]]; disk.copy(this.payload, EQUIPMENT_OFFSET + slot * RECORD_SIZE) }
  palico(index: number): SavePalicoDetail { return emptyPalico(index) }
  setPalico() { throw new Error('当前格式没有猎猫记录') }
  palicoSummaries(): SavePalicoSummary[] { return [] }
  validate(): SaveDiagnostic[] {
    const diagnostics: SaveDiagnostic[] = []
    for (let slot = 0; slot < ITEM_COUNT; slot += 1) {
      const value = this.item(slot)
      if (!value.itemId && value.count) diagnostics.push({ code: 'mh3u.item.empty-count', path: `items.${slot}`, severity: 'error', message: `道具格 ${slot + 1} 为空 ID 但数量非零` })
    }
    for (let slot = 0; slot < EQUIPMENT_COUNT; slot += 1) {
      const value = this.equipment(slot)
      if (!(value.saveType in equipmentKinds)) diagnostics.push({ code: 'mh3u.equipment.type', path: `equipment.${slot}`, severity: 'error', message: `装备格 ${slot + 1} 的类型 ${value.saveType} 无效` })
      if (!value.saveType && !/^0+$/.test(value.recordHex)) diagnostics.push({ code: 'mh3u.equipment.dirty-empty', path: `equipment.${slot}`, severity: 'error', message: `装备格 ${slot + 1} 的空记录包含非零字段` })
    }
    return diagnostics
  }
  serialize() { return Buffer.concat([this.header, this.payload]) }
}
