import type { SaveDiagnostic, SaveField } from '../types'
import { PspSavedataCodec } from '../p2g/codec'
import { PspSavedataSfo } from '../p2g/sfo'
import { P3_CHARM_TYPE, p3EquipmentKey, p3WeaponBoostMask, readP3Charm } from '../p3/equipment'
import type { P3SaveProfile } from '../p3/profile'
import { P3_PSP } from '../psp/format'
import { checkIndex, type SaveAdapterMeta, type SaveDocumentAdapter } from './types'

export const P3_LAYOUT = {
  start: 0x800, stride: 0x60000, occupied: 0x1a, sex: 0x1b,
  box: 0x168, items: 0x3048, seconds: 0x4898, refs: 0x48f2,
  presets: 0x4b8c, presetSize: 92, presetCount: 45, zenny: 0x5cc28, obtained: 0x5f144,
} as const

const L = P3_LAYOUT
const NO_REFERENCE = 0xffff
const RECORD_SIZE = 12
const BOX_SLOTS = 1000
// The seven current and registered references use different part orders.
const wornTypes = [5, 3, 4, 0, 1, 2, P3_CHARM_TYPE]
const wornCopies = [0x38, 0x74, 0x80, 0x50, 0x5c, 0x68, 0x44]
const presetTypes = [5, 0, 1, 2, 3, 4, P3_CHARM_TYPE]

function compatible(part: number, record: Buffer) {
  return record[0] !== 0 && (part === 5 ? record[1] >= 5 && record[1] <= 17 : record[1] === part)
}

export class Mhp3SaveAdapter implements SaveDocumentAdapter {
  readonly codec: PspSavedataCodec
  readonly sfo: PspSavedataSfo
  readonly header: Buffer
  private readonly seed: number
  payload: Buffer
  selectedCharacter: number | null = null

  constructor(readonly sourceBytes: Buffer, sfoBytes: Buffer, readonly profile: P3SaveProfile) {
    this.codec = new PspSavedataCodec(profile, P3_PSP)
    this.sfo = new PspSavedataSfo(sfoBytes, this.codec)
    this.sfo.verify(sourceBytes)
    const { payload, header, seed } = this.codec.decode(sourceBytes)
    this.payload = payload
    this.header = header
    this.seed = seed
    if (!this.characters().some(character => character.used)) throw new Error('P3 存档没有可编辑角色')
  }

  get meta(): SaveAdapterMeta {
    const flags = this.selectedCharacter == null ? 0xc0 : this.payload[this.base() + L.obtained]
    const capacity = 800 + 100 * (Number(Boolean(flags & 0x40)) + Number(Boolean(flags & 0x80)))
    return { formatId: P3_PSP.formatId, contentGameId: P3_PSP.gameId, platform: 'psp', emulator: 'ppsspp',
      recordSize: RECORD_SIZE, itemCapacity: capacity, itemCountMax: 0x7fff, hunterEquipmentCapacity: capacity,
      palicoEquipmentCapacity: 0, palicoCount: 0 }
  }

  private base(slot = this.selectedCharacter) {
    if (slot == null) throw new Error('请先选择角色')
    return L.start + slot * L.stride
  }

  characters() {
    return Array.from({ length: 3 }, (_, slot) => {
      const base = this.base(slot)
      return {
        slot, used: this.payload[base + L.occupied] !== 0,
        name: this.payload.toString('utf16le', base, base + 18).split('\0')[0],
        hunterRank: null, playTimeSeconds: this.payload.readUInt32LE(base + L.seconds),
      }
    })
  }

  selectCharacter(slot: number) {
    checkIndex(slot, 3, '角色')
    if (!this.characters()[slot].used) throw new Error('不能编辑空角色')
    this.selectedCharacter = slot
  }

  personalFields(): SaveField[] {
    const base = this.base()
    const character = this.characters()[this.selectedCharacter!]
    const sex = this.payload[base + L.sex]
    return [
      { key: 'name', group: 'identity', label: '角色名', value: character.name, valueType: 'readonly', writable: false },
      { key: 'sex', group: 'identity', label: '性别', value: sex === 0 ? '男' : sex === 1 ? '女' : `未知 ${sex}`, valueType: 'readonly', writable: false },
      { key: 'hunterRank', group: 'progress', label: '猎人等级', value: '未知', valueType: 'readonly', writable: false },
      { key: 'seconds', group: 'progress', label: '游戏时间', value: character.playTimeSeconds, valueType: 'readonly', writable: false, unit: '秒' },
      { key: 'zenny', group: 'currency', label: '金钱', value: this.payload.readUInt32LE(base + L.zenny), valueType: 'number', writable: true, min: 0, max: 9999999 },
    ]
  }

  setPersonalField(field: string, value: string | number | boolean) {
    if (field !== 'zenny' || typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9999999) {
      throw new Error('该个人字段不可写或数值超出范围')
    }
    this.payload.writeUInt32LE(value, this.base() + L.zenny)
  }

  item(slot: number) {
    checkIndex(slot, this.meta.itemCapacity, '道具格')
    const at = this.base() + L.items + slot * 4
    const itemId = this.payload.readUInt16LE(at)
    return { slot, itemId, count: this.payload.readInt16LE(at + 2), empty: itemId === 0 }
  }

  items(start: number, count: number) {
    return Array.from({ length: count }, (_, index) => this.item(start + index))
  }

  // This operation also restores same-format raw box exports, including unusual original counts.
  setItem(slot: number, itemId: number, count: number) {
    checkIndex(slot, this.meta.itemCapacity, '道具格')
    if (!Number.isInteger(itemId) || itemId < 0 || itemId > 0xffff || !Number.isInteger(count) || count < -0x8000 || count > 0x7fff) {
      throw new Error('P3 道具字段超出编码范围')
    }
    const at = this.base() + L.items + slot * 4
    this.payload.writeUInt16LE(itemId, at)
    this.payload.writeInt16LE(count, at + 2)
  }

  private record(slot: number, base = this.base()) {
    const at = base + L.box + slot * RECORD_SIZE
    return this.payload.subarray(at, at + RECORD_SIZE)
  }

  equipment(slot: number, palico = false): ReturnType<SaveDocumentAdapter['equipment']> {
    if (palico) throw new Error('P3 猎猫装备箱尚未接入')
    checkIndex(slot, this.meta.hunterEquipmentCapacity, '装备格')
    const base = this.base()
    const record = this.record(slot, base)
    const empty = record[0] === 0
    const saveType = record[1], saveId = record.readUInt16LE(2)
    const charm = !empty && saveType === P3_CHARM_TYPE ? readP3Charm(record) : undefined
    const key = !empty ? p3EquipmentKey(saveType, saveId) : null
    const kind = empty ? 'empty' : charm ? 'charm' : !key ? 'unknown' : saveType < 5 ? 'armor' : 'weapon'
    const level = kind === 'armor' ? record[4] : kind === 'weapon' ? Number(Boolean(record[4] & p3WeaponBoostMask(saveType))) : 0
    const cap = key ? this.profile.armorCaps[key] : undefined
    const upgrade = kind === 'armor' && cap != null ? { label: '防具强化次数', maximum: 255, naturalMaximum: cap, value: level }
      : kind === 'weapon' ? { label: '攻击强化（0 关闭／1 开启）', maximum: 1, naturalMaximum: 1, value: level } : undefined
    return {
      slot, empty, kind, saveType, saveId, level, upgrade, charmGrade: charm?.grade,
      slots: charm?.slots ?? null, appearanceId: null,
      decorations: empty ? [] : [6, 8, 10].map(offset => record.readUInt16LE(offset)),
      skill1Id: charm?.skill1Id || null, skill1Points: charm?.skill1Points ?? null,
      skill2Id: charm?.skill2Id || null, skill2Points: charm?.skill2Points ?? null,
      recordHex: record.toString('hex'),
      equipped: !empty && wornTypes.some((_, index) => this.payload.readUInt16LE(base + L.refs + index * 2) === slot),
    }
  }

  private preset(base: number, index: number) {
    return base + L.presets + index * L.presetSize
  }

  private clearPreset(at: number) {
    // Native 0x0886df6c resets the full row if its weapon is removed, keeping the one-byte index.
    const index = this.payload[at]
    this.payload.fill(0, at, at + L.presetSize)
    this.payload[at] = index
    this.payload.fill(0xff, at + 2, at + 16)
    for (let part = 0; part < 5; part++) this.payload.fill(0xff, at + 17 + part * 4, at + 20 + part * 4)
  }

  setEquipment(slot: number, record: Buffer, palico = false) {
    if (palico) throw new Error('P3 猎猫装备箱尚未接入')
    checkIndex(slot, this.meta.hunterEquipmentCapacity, '装备格')
    if (record.length !== RECORD_SIZE) throw new Error('P3 装备记录必须为 12 字节')
    const base = this.base()
    const worn = wornTypes.flatMap((part, index) => this.payload.readUInt16LE(base + L.refs + index * 2) === slot ? [{ part, index }] : [])
    if (worn.some(({ part }) => !compatible(part, record))) throw new Error('装备正在穿戴，请先在游戏内卸下再删除或更换部位')
    for (let index = 0; index < L.presetCount; index++) {
      const at = this.preset(base, index)
      if (this.payload.readUInt16LE(at + 2) === slot && !compatible(presetTypes[0], record)) {
        this.clearPreset(at)
        continue
      }
      for (let part = 1; part < presetTypes.length; part++) {
        const ref = at + 2 + part * 2
        if (this.payload.readUInt16LE(ref) === slot && !compatible(presetTypes[part], record)) this.payload.writeUInt16LE(NO_REFERENCE, ref)
      }
    }
    record.copy(this.record(slot, base))
    for (const { index } of worn) record.copy(this.payload, base + wornCopies[index])
  }

  swapEquipment(first: number, second: number) {
    checkIndex(first, this.meta.hunterEquipmentCapacity, '装备格')
    checkIndex(second, this.meta.hunterEquipmentCapacity, '装备格')
    if (first === second) return
    const base = this.base()
    const a = this.record(first, base), b = this.record(second, base)
    const original = Buffer.from(a)
    b.copy(a)
    original.copy(b)
    const swapRefs = (at: number) => {
      for (let index = 0; index < 7; index++) {
        const offset = at + index * 2
        const id = this.payload.readUInt16LE(offset)
        if (id === first) this.payload.writeUInt16LE(second, offset)
        if (id === second) this.payload.writeUInt16LE(first, offset)
      }
    }
    swapRefs(base + L.refs)
    for (let index = 0; index < L.presetCount; index++) swapRefs(this.preset(base, index) + 2)
  }

  palico(): never { throw new Error('P3 猎猫编辑尚未接入') }
  setPalico(): never { throw new Error('P3 猎猫编辑尚未接入') }
  palicoSummaries() { return [] }

  validate(): SaveDiagnostic[] {
    const issues: SaveDiagnostic[] = []
    for (const character of this.characters()) {
      if (!character.used) continue
      const base = this.base(character.slot)
      const check = (offset: number, part: number, copy?: number) => {
        const ref = this.payload.readUInt16LE(offset)
        if (ref === NO_REFERENCE) return
        const record = ref < BOX_SLOTS ? this.record(ref, base) : Buffer.alloc(0)
        if (record.length !== RECORD_SIZE || !compatible(part, record) || copy != null && !record.equals(this.payload.subarray(base + copy, base + copy + RECORD_SIZE))) {
          issues.push({ code: 'p3.reference.invalid', severity: 'error', path: `characters.${character.slot}.references.${offset - base}`, message: `角色 ${character.slot + 1} 的${copy == null ? '预设' : '穿戴'}装备与箱格不匹配` })
        }
      }
      wornTypes.forEach((part, index) => check(base + L.refs + index * 2, part, wornCopies[index]))
      for (let index = 0; index < L.presetCount; index++) presetTypes.forEach((part, n) => check(this.preset(base, index) + 2 + n * 2, part))
    }
    return issues
  }

  serialize() { return this.codec.encode(this.payload, this.seed, this.header) }
  serializePair() { const bin = this.serialize(); return { bin, sfo: this.sfo.rebuild(bin) } }
}
