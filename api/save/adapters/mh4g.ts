import { Blowfish } from 'egoroof-blowfish'
import { bufferToHex, decodeUtf16Le, encodeUtf16Le, readU16, readU32, writeU16, writeU32 } from '../binary'
import type { SaveEquipmentKind, SaveField, SavePalicoDetail, SavePalicoSummary } from '../types'
import { checkIndex, emptyPalico, signedByte, type SaveDocumentAdapter } from './types'

const FILE_SIZE = 81408
const DATA_OFFSET = 8
const ITEM_OFFSET = DATA_OFFSET + 0x015e
const ITEM_COUNT = 1400
const EQUIPMENT_OFFSET = DATA_OFFSET + 0x173e
const EQUIPMENT_COUNT = 1500
const RECORD_SIZE = 28
const KEY = 'blowfish key iorajegqmrna4itjeangmb agmwgtobjteowhv9mope'

function swapDwords(input: Buffer): Buffer {
  const output = Buffer.from(input)
  for (let offset = 0; offset < output.length; offset += 4) {
    const first = output[offset]; const second = output[offset + 1]
    output[offset] = output[offset + 3]; output[offset + 1] = output[offset + 2]
    output[offset + 2] = second; output[offset + 3] = first
  }
  return output
}

function applyXor(input: Buffer): Buffer {
  const output = Buffer.from(input)
  let key = readU16(output, 2)
  for (let offset = 4; offset < output.length; offset += 2) {
    if (key === 0) key = 1
    key = (key * 0xb0) % 0xff53
    writeU16(output, offset, readU16(output, offset) ^ key)
  }
  return output
}

function crypt(input: Buffer, encrypting: boolean): Buffer {
  if (input.length % 8) throw new Error('Blowfish 输入长度必须为 8 字节倍数')
  const blowfish = new Blowfish(KEY, Blowfish.MODE.ECB, Blowfish.PADDING.NULL)
  const result = encrypting ? blowfish.encode(input) : blowfish.decode(input, Blowfish.TYPE.UINT8_ARRAY)
  return Buffer.from(result)
}

export function decryptMh4g(input: Buffer): Buffer {
  if (input.length !== FILE_SIZE) throw new Error(`文件大小不正确：MH4G 应为 ${FILE_SIZE} 字节`)
  const output = applyXor(swapDwords(crypt(swapDwords(input), false)))
  if (readU16(output, 0) !== 0x10) throw new Error('解密后的存档头无效')
  let actual = 0
  for (let offset = DATA_OFFSET; offset < output.length; offset += 1) actual = (actual + output[offset]) >>> 0
  if (readU32(output, 4) !== actual) throw new Error(`MH4G 存档校验和错误：记录 ${readU32(output, 4)}，实际 ${actual}`)
  return output
}

export function encryptMh4g(input: Buffer): Buffer {
  if (input.length !== FILE_SIZE || readU16(input, 0) !== 0x10) throw new Error('待保存的 MH4G 数据无效')
  const prepared = Buffer.from(input)
  let checksum = 0
  for (let offset = DATA_OFFSET; offset < prepared.length; offset += 1) checksum = (checksum + prepared[offset]) >>> 0
  writeU32(prepared, 4, checksum)
  return swapDwords(crypt(swapDwords(applyXor(prepared)), true))
}

function kindFor(type: number): SaveEquipmentKind {
  if (!type) return 'empty'
  if (type >= 1 && type <= 5) return 'armor'
  if (type === 6) return 'charm'
  if (type >= 7 && type <= 20) return 'weapon'
  return 'unknown'
}

export class Mh4gSaveAdapter implements SaveDocumentAdapter {
  readonly meta = { formatId: 'mh4g-3ds-citra' as const, contentGameId: 'mh4g' as const, platform: '3ds' as const, emulator: 'citra' as const, recordSize: RECORD_SIZE, itemCapacity: ITEM_COUNT, itemCountMax: 0xffff, hunterEquipmentCapacity: EQUIPMENT_COUNT, palicoEquipmentCapacity: 0, palicoCount: 0 }
  readonly sourceBytes: Buffer
  readonly header = Buffer.alloc(0)
  payload: Buffer
  selectedCharacter: number | null = 0
  constructor(bytes: Buffer) { this.sourceBytes = Buffer.from(bytes); this.payload = decryptMh4g(bytes) }
  private name() { return decodeUtf16Le(this.payload, DATA_OFFSET, 12) }
  characters() { return [{ slot: 0, used: Boolean(this.name()), name: this.name(), hunterRank: readU32(this.payload, DATA_OFFSET + 44), playTimeSeconds: 0 }] }
  selectCharacter(slot: number) { if (slot !== 0) throw new Error('该格式只有一个角色'); this.selectedCharacter = 0 }
  personalFields(): SaveField[] {
    return [
      { key: 'name', group: 'identity', label: '角色名', value: this.name(), valueType: 'text', writable: true },
      { key: 'sex', group: 'identity', label: '性别', value: this.payload[DATA_OFFSET + 24], valueType: 'select', writable: true, options: [{ value: '0', label: '男性' }, { value: '1', label: '女性' }] },
      { key: 'hair', group: 'identity', label: '发型', value: this.payload[DATA_OFFSET + 25], valueType: 'number', writable: true, min: 0, max: 255 },
      { key: 'underwear', group: 'identity', label: '内衣', value: this.payload[DATA_OFFSET + 26], valueType: 'number', writable: true, min: 0, max: 255 },
      { key: 'voice', group: 'identity', label: '声音', value: this.payload[DATA_OFFSET + 27], valueType: 'number', writable: true, min: 0, max: 255 },
      { key: 'hunterRank', group: 'progress', label: '猎人等级', value: readU32(this.payload, DATA_OFFSET + 44), valueType: 'number', writable: true, min: 0, max: 999 },
      { key: 'money', group: 'currency', label: '金钱', value: readU32(this.payload, DATA_OFFSET + 52), valueType: 'number', writable: true, min: 0, max: 9_999_999, unit: 'z' },
    ]
  }
  setPersonalField(field: string, value: string | number | boolean) {
    if (field === 'name') { encodeUtf16Le(String(value), 12).copy(this.payload, DATA_OFFSET); return }
    const number = Number(value)
    if (!Number.isInteger(number) || number < 0) throw new Error('字段值无效')
    const bytes: Record<string, number> = { sex: 24, hair: 25, underwear: 26, voice: 27 }
    if (field in bytes) { if (number > (field === 'sex' ? 1 : 255)) throw new Error('字段值超出范围'); this.payload[DATA_OFFSET + bytes[field]] = number; return }
    if (field === 'hunterRank') { if (number > 999) throw new Error('猎人等级超出范围'); writeU32(this.payload, DATA_OFFSET + 44, number); return }
    if (field === 'money') { if (number > 9_999_999) throw new Error('金钱超出范围'); writeU32(this.payload, DATA_OFFSET + 52, number); return }
    throw new Error('未知个人字段')
  }
  item(slot: number) { checkIndex(slot, ITEM_COUNT, '道具格'); const offset = ITEM_OFFSET + slot * 4; const itemId = readU16(this.payload, offset); const count = readU16(this.payload, offset + 2); return { slot, empty: !itemId, itemId, count } }
  items(start: number, count: number) { return Array.from({ length: Math.max(0, Math.min(count, ITEM_COUNT - start)) }, (_, index) => this.item(start + index)) }
  setItem(slot: number, itemId: number, count: number) { checkIndex(slot, ITEM_COUNT, '道具格'); if (itemId < 0 || itemId > 0xffff || count < 0 || count > 0xffff) throw new Error('道具字段超出范围'); const offset = ITEM_OFFSET + slot * 4; writeU16(this.payload, offset, itemId); writeU16(this.payload, offset + 2, itemId ? count : 0) }
  equipment(slot: number) {
    checkIndex(slot, EQUIPMENT_COUNT, '装备格'); const record = Buffer.from(this.payload.subarray(EQUIPMENT_OFFSET + slot * RECORD_SIZE, EQUIPMENT_OFFSET + (slot + 1) * RECORD_SIZE)); const type = record[0]; const kind = kindFor(type)
    return { slot, empty: !type, kind, saveType: type, saveId: readU16(record, 2), level: record[1], slots: kind === 'charm' ? record[1] : null, appearanceId: null, appearance: null, decorations: [readU16(record, 6), readU16(record, 8), readU16(record, 10)], skill1Id: kind === 'charm' ? readU16(record, 12) : null, skill1Points: kind === 'charm' ? record.readInt16LE(14) : null, skill2Id: kind === 'charm' ? readU16(record, 16) : null, skill2Points: kind === 'charm' ? record.readInt16LE(18) : null, recordHex: bufferToHex(record) }
  }
  setEquipment(slot: number, record: Buffer) {
    checkIndex(slot, EQUIPMENT_COUNT, '装备格'); if (record.length !== RECORD_SIZE) throw new Error('MH4G 装备记录必须为 28 字节')
    const offset = EQUIPMENT_OFFSET + slot * RECORD_SIZE; const previous = Buffer.from(this.payload.subarray(offset, offset + RECORD_SIZE)); record.copy(this.payload, offset)
    for (let equipped = 0; equipped < 7; equipped += 1) {
      const indexOffset = DATA_OFFSET + 0x0104 + equipped * 2
      if (readU16(this.payload, indexOffset) !== slot) continue
      const copyOffset = DATA_OFFSET + 0x0040 + equipped * RECORD_SIZE
      if (this.payload.subarray(copyOffset, copyOffset + RECORD_SIZE).equals(previous)) record.copy(this.payload, copyOffset)
    }
  }
  palico(index: number): SavePalicoDetail { return emptyPalico(index) }
  setPalico() { throw new Error('当前格式没有猎猫记录') }
  palicoSummaries(): SavePalicoSummary[] { return [] }
  validate() {
    const diagnostics = []
    if (readU16(this.payload, 0) !== 0x10) diagnostics.push({ code: 'mh4g.header', path: 'header', severity: 'error' as const, message: 'MH4G 解密头无效' })
    return diagnostics
  }
  serialize() { return encryptMh4g(this.payload) }
}
