import type { SaveAdapterMeta, SaveDocumentAdapter } from './types'
import { checkIndex } from './types'
import type { SaveDiagnostic, SaveField, SavePalicoDetail } from '../types'
import { P2gCodec } from '../p2g/codec'
import type { P2gProfile } from '../p2g/profile'
import { P2gSfo } from '../p2g/sfo'

export const P2G_LAYOUT = { start: 0x1000, stride: 0x6b100, gear: 0x20, box: 0xa8, items: 0x2f88, quests: 0x3f88, seconds: 0x3fc8, refs: 0x4020, presets: 0x4334, points: 0x69248, zenny: 0x69250, obtained: 0x6a7b4 } as const
const L = P2G_LAYOUT
const compatible = (part: number, record: Buffer) => Boolean(record[0]) && (part === 0 ? record[1] === 5 || record[1] === 6 : record[1] === part - 1)

export class Mhp2gSaveAdapter implements SaveDocumentAdapter {
  payload: Buffer
  readonly header: Buffer
  readonly codec: P2gCodec
  readonly sfo: P2gSfo
  private readonly seed: number
  selectedCharacter: number | null = null
  constructor(readonly sourceBytes: Buffer, sfoBytes: Buffer, readonly profile: P2gProfile) {
    this.codec = new P2gCodec(profile); this.sfo = new P2gSfo(sfoBytes, this.codec)
    this.sfo.verify(sourceBytes)
    const decoded = this.codec.decode(sourceBytes)
    this.payload = decoded.payload; this.header = decoded.header; this.seed = decoded.seed
    if (!this.characters().some(c => c.used)) throw new Error('P2G 存档没有可编辑角色')
  }
  get meta(): SaveAdapterMeta {
    let capacity = 1000
    if (this.selectedCharacter != null) {
      const at = this.base() + L.obtained
      capacity = 800 + [829, 830].reduce((n, id) => n + ((this.payload[at + (id >> 3)] >> (id & 7)) & 1) * 100, 0)
    }
    return { formatId: 'mhp2g-psp-ppsspp', contentGameId: 'mhp2g', platform: 'psp', emulator: 'ppsspp', recordSize: 12, itemCapacity: capacity, itemCountMax: 65535, hunterEquipmentCapacity: capacity, palicoEquipmentCapacity: 0, palicoCount: 0 }
  }
  private base(): number { if (this.selectedCharacter == null) throw new Error('请先选择角色'); return L.start + this.selectedCharacter * L.stride }
  characters() {
    return Array.from({ length: 3 }, (_, slot) => {
      const b = L.start + slot * L.stride
      let hunterRank = 1
      for (const { bit, rank } of this.profile.rankGates) if (this.payload[b + L.quests + (bit >> 3)] & (1 << (bit & 7))) hunterRank = Math.max(hunterRank, rank)
      return { slot, used: this.payload[b + 0x12] !== 0, name: this.payload.toString('utf16le', b, b + 16).split('\0')[0], hunterRank, playTimeSeconds: this.payload.readUInt32LE(b + L.seconds) }
    })
  }
  selectCharacter(slot: number) { checkIndex(slot, 3, '角色'); if (!this.characters()[slot].used) throw new Error('不能编辑空角色'); this.selectedCharacter = slot }
  personalFields(): SaveField[] {
    const b = this.base(), c = this.characters()[this.selectedCharacter!]
    return [
      { key: 'name', group: 'identity', label: '角色名', value: c.name, valueType: 'readonly', writable: false },
      { key: 'sex', group: 'identity', label: '性别', value: this.payload[b + 0x13] === 0 ? '男' : this.payload[b + 0x13] === 1 ? '女' : `未知 ${this.payload[b + 0x13]}`, valueType: 'readonly', writable: false },
      { key: 'hunterRank', group: 'progress', label: '猎人等级（任务进度决定）', value: c.hunterRank, valueType: 'readonly', writable: false },
      ...(['zenny', 'points', 'seconds'] as const).map(key => ({ key, group: key === 'seconds' ? 'progress' as const : 'currency' as const, label: { zenny: '金钱', points: '波凯点数', seconds: '游戏时间' }[key], value: this.payload.readUInt32LE(b + L[key]), valueType: 'number' as const, writable: true, min: 0, max: key === 'seconds' ? 35999999 : 9999999, unit: key === 'seconds' ? '秒' : undefined })),
    ]
  }
  setPersonalField(field: string, value: string | number | boolean) {
    const spec = this.personalFields().find(f => f.key === field)
    if (!spec?.writable || typeof value !== 'number' || !Number.isInteger(value) || value < spec.min! || value > spec.max!) throw new Error('该个人字段不可写或数值超出范围')
    this.payload.writeUInt32LE(value, this.base() + L[field as 'zenny' | 'points' | 'seconds'])
  }
  item(slot: number) {
    checkIndex(slot, this.meta.itemCapacity, '道具格'); const at = this.base() + L.items + slot * 4
    const itemId = this.payload.readUInt16LE(at), count = this.payload.readUInt16LE(at + 2)
    return { slot, empty: itemId === 0, itemId, count }
  }
  items(start: number, count: number) { return Array.from({ length: count }, (_, i) => this.item(start + i)) }
  setItem(slot: number, itemId: number, count: number) {
    this.item(slot)
    if (![itemId, count].every(n => Number.isInteger(n) && n >= 0 && n <= 65535) || itemId === 0 && count !== 0) throw new Error('P2G 道具字段超出编码范围')
    const at = this.base() + L.items + slot * 4
    this.payload.writeUInt16LE(itemId, at); this.payload.writeUInt16LE(count, at + 2)
  }
  private record(slot: number) { return this.payload.subarray(this.base() + L.box + slot * 12, this.base() + L.box + (slot + 1) * 12) }
  equipment(slot: number, palico = false): ReturnType<SaveDocumentAdapter['equipment']> {
    if (palico) throw new Error('P2G 没有猎猫装备箱')
    checkIndex(slot, this.meta.hunterEquipmentCapacity, '装备格')
    const r = this.record(slot), empty = r[0] === 0, saveType = r[1]
    return { slot, empty, kind: empty ? 'empty' : saveType <= 4 ? 'armor' : saveType <= 6 ? 'weapon' : 'unknown', saveType, saveId: r.readUInt16LE(2), level: saveType <= 4 ? r[4] : saveType === 6 ? r[4] & 15 : 0, slots: null, appearanceId: null, decorations: [6, 8, 10].map(at => r.readUInt16LE(at)), skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, recordHex: r.toString('hex'), equipped: Array.from({ length: 6 }, (_, i) => this.payload.readUInt16LE(this.base() + L.refs + 2 * i)).includes(slot), upgradeWord: r.readUInt16LE(4) }
  }
  setEquipment(slot: number, record: Buffer, palico = false) {
    this.equipment(slot, palico)
    if (record.length !== 12) throw new Error('P2G 装备记录必须为 12 字节')
    const b = this.base()
    for (let part = 0; part < 6; part++) if (this.payload.readUInt16LE(b + L.refs + part * 2) === slot && !compatible(part, record)) throw new Error('这件装备正在穿戴，不能删除或改为其他部位；请先在游戏内卸下')
    // Cross-part replacement follows native deletion cleanup before inserting the new record.
    for (let preset = 0; preset < 20; preset++) {
      const at = b + L.presets + preset * 32
      if (this.payload.readUInt16LE(at) === slot && !compatible(0, record)) this.payload.fill(255, at, at + 12)
      else for (let part = 1; part < 6; part++) if (this.payload.readUInt16LE(at + part * 2) === slot && !compatible(part, record)) this.payload.writeUInt16LE(65535, at + part * 2)
    }
    record.copy(this.record(slot))
    for (let part = 0; part < 6; part++) if (this.payload.readUInt16LE(b + L.refs + part * 2) === slot) record.copy(this.payload, b + L.gear + part * 12)
  }
  swapEquipment(first: number, second: number) {
    this.equipment(first); this.equipment(second)
    const a = Buffer.from(this.record(first)), b = Buffer.from(this.record(second)); b.copy(this.record(first)); a.copy(this.record(second))
    const base = this.base(), refs = Array.from({ length: 6 }, (_, i) => base + L.refs + 2 * i)
    for (let p = 0; p < 20; p++) for (let i = 0; i < 6; i++) refs.push(base + L.presets + p * 32 + i * 2)
    for (const at of refs) { const ref = this.payload.readUInt16LE(at); if (ref === first) this.payload.writeUInt16LE(second, at); else if (ref === second) this.payload.writeUInt16LE(first, at) }
  }
  palico(): SavePalicoDetail { throw new Error('P2G 随从猫编辑尚未开放') }
  setPalico(): never { throw new Error('P2G 随从猫编辑尚未开放') }
  palicoSummaries() { return [] }
  validate(): SaveDiagnostic[] {
    const issues: SaveDiagnostic[] = []
    for (const c of this.characters().filter(c => c.used)) {
      const b = L.start + c.slot * L.stride
      const check = (at: number, part: number, current: boolean) => {
        const ref = this.payload.readUInt16LE(at)
        if (ref === 65535) return
        const record = this.payload.subarray(b + L.box + ref * 12, b + L.box + (ref + 1) * 12)
        if (ref >= 1000 || !compatible(part, record) || current && !record.equals(this.payload.subarray(b + L.gear + part * 12, b + L.gear + (part + 1) * 12))) issues.push({ code: 'p2g.reference.invalid', path: `characters.${c.slot}.references.${at - b}`, severity: 'error', message: `角色 ${c.slot + 1} 的${current ? '身上装备副本' : '预设配装'}与装备箱引用不一致，原始数据已保留` })
      }
      for (let part = 0; part < 6; part++) check(b + L.refs + part * 2, part, true)
      for (let p = 0; p < 20; p++) for (let part = 0; part < 6; part++) check(b + L.presets + p * 32 + part * 2, part, false)
    }
    return issues
  }
  serialize() { return this.codec.encode(this.payload, this.seed, this.header) }
  serializePair() { const bin = this.serialize(); return { bin, sfo: this.sfo.rebuild(bin) } }
}
