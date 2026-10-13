import { timingSafeEqual } from 'node:crypto'
import type { P2gCodec } from './codec'

type Entry = { offset: number; length: number; maximum: number; format: number }
export function sfoEntries(source: Buffer): Map<string, Entry> {
  if (source.length < 20 || source.length > 65536 || source.readUInt32LE(0) !== 0x46535000 || source.readUInt32LE(4) !== 0x101) throw new Error('PARAM.SFO 头部无效')
  const keys = source.readUInt32LE(8), values = source.readUInt32LE(12), count = source.readUInt32LE(16)
  if (count > 128 || 20 + count * 16 > keys || keys >= values || values > source.length) throw new Error('PARAM.SFO 索引越界')
  const result = new Map<string, Entry>(), ranges: [number, number][] = []
  for (let n = 0; n < count; n++) {
    const at = 20 + n * 16, nameAt = keys + source.readUInt16LE(at), end = source.indexOf(0, nameAt)
    const length = source.readUInt32LE(at + 4), maximum = source.readUInt32LE(at + 8), offset = values + source.readUInt32LE(at + 12)
    if (nameAt >= values || end < nameAt || end >= values || length > maximum || offset + maximum > source.length || ranges.some(([a, b]) => offset < b && offset + maximum > a)) throw new Error('PARAM.SFO 字段越界或重叠')
    const name = source.toString('ascii', nameAt, end)
    if (result.has(name)) throw new Error('PARAM.SFO 存在重复字段')
    ranges.push([offset, offset + maximum]); result.set(name, { offset, length, maximum, format: source.readUInt16LE(at + 2) })
  }
  return result
}
export class P2gSfo {
  private readonly params: number
  private readonly mac: number
  constructor(readonly source: Buffer, private readonly codec: P2gCodec) {
    const entries = sfoEntries(source), params = entries.get('SAVEDATA_PARAMS'), files = entries.get('SAVEDATA_FILE_LIST'), directory = entries.get('SAVEDATA_DIRECTORY')
    if (!params || params.length !== 128 || params.format !== 4 || !files || files.format !== 4 || files.length % 32 !== 0 || !directory || source.toString('ascii', directory.offset, directory.offset + directory.length).replace(/\0+$/, '') !== 'ULJM05500') throw new Error('PARAM.SFO 不是支持的 P2G 日版存档')
    this.params = params.offset
    if (source[this.params] !== 0x41 || !source.subarray(this.params + 0x20, this.params + 0x30).every(v => v === 1)) throw new Error('暂不支持此 PSP 实机/非 PPSSPP SFO 校验模式')
    const matches: number[] = []
    for (let at = files.offset; at < files.offset + files.length; at += 32) if (source.toString('ascii', at, at + 13).replace(/\0+$/, '') === 'MHP2NDG.BIN') matches.push(at + 13)
    if (matches.length !== 1) throw new Error('PARAM.SFO 缺少唯一的 MHP2NDG.BIN 校验项')
    this.mac = matches[0]
  }
  rebuild(bin: Buffer): Buffer {
    const output = Buffer.from(this.source), p = this.params
    this.codec.fileMac(bin).copy(output, this.mac)
    output.fill(0, p, p + 128); output.fill(1, p + 0x20, p + 0x30); output[p] = 0x41
    this.codec.sfoMac(output, 5).copy(output, p + 0x70)
    this.codec.sfoMac(output, 1).copy(output, p + 0x10)
    return output
  }
  verify(bin: Buffer): void {
    if (!timingSafeEqual(this.source.subarray(this.mac, this.mac + 16), this.codec.fileMac(bin))) throw new Error('BIN 与 PARAM.SFO 不匹配，或 BIN 校验失败')
    if (!this.rebuild(bin).equals(this.source)) throw new Error('PARAM.SFO 校验失败，当前仅支持已验证的 PPSSPP 模式')
  }
}
