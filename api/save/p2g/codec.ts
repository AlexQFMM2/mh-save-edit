import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'
import type { P2gProfile } from './profile'

export const P2G_PAYLOAD_SIZE = 0x16a0e8
export const P2G_BIN_SIZE = P2G_PAYLOAD_SIZE + 40
const zero = Buffer.alloc(16)
function aes(key: Buffer, data: Buffer, decrypt = false): Buffer {
  const cipher = (decrypt ? createDecipheriv : createCipheriv)('aes-128-cbc', key, zero)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(data), cipher.final()])
}
function xor(a: Buffer, b: Buffer): Buffer { const out = Buffer.allocUnsafe(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]; return out }
function double(block: Buffer): Buffer {
  const result = Buffer.alloc(16)
  for (let i = 0; i < 16; i++) result[i] = (block[i] << 1) | ((block[i + 1] ?? 0) >> 7)
  if (block[0] & 128) result[15] ^= 0x87
  return result
}
export function cmac(data: Buffer, key: Buffer): Buffer {
  const k1 = double(aes(key, zero)), full = data.length > 0 && data.length % 16 === 0
  const length = Math.max(16, Math.ceil(data.length / 16) * 16), prepared = Buffer.alloc(length)
  data.copy(prepared)
  if (!full) prepared[data.length] = 0x80
  xor(prepared.subarray(-16), full ? k1 : double(k1)).copy(prepared, length - 16)
  return aes(key, prepared).subarray(-16)
}

/** Independently expressed mode-5 PSP + native P2G pipeline; provenance in docs/mhp2g-save-editor.md. */
export class P2gCodec {
  constructor(readonly profile: P2gProfile) {}
  fileMac(bin: Buffer): Buffer { return aes(this.profile.macKey, xor(xor(cmac(bin, this.profile.macKey), this.profile.hashKey), this.profile.gameKey)) }
  sfoMac(sfo: Buffer, mode: 1 | 5): Buffer { return mode === 1 ? cmac(sfo, this.profile.sfoKey) : xor(cmac(sfo, this.profile.macKey), this.profile.hashKey) }
  private translate(data: Buffer, table: Buffer) { const out = Buffer.allocUnsafe(data.length); for (let i = 0; i < data.length; i++) out[i] = table[data[i]]; return out }
  private gameXor(data: Buffer, seed: number): Buffer {
    const p = this.profile, result = Buffer.from(data)
    let high = seed >>> 16 || p.multipliers[0], low = seed & 65535 || p.multipliers[1]
    for (let offset = 0; offset < result.length; offset += 4) {
      high = (high * p.multipliers[0]) % p.moduli[0]; low = (low * p.multipliers[1]) % p.moduli[1]
      result.writeUInt32LE((result.readUInt32LE(offset) ^ ((high << 16) | low)) >>> 0, offset)
    }
    return result
  }
  private digest(payload: Buffer): Buffer { return createHash('sha1').update(payload.subarray(0, -12)).update(this.profile.salt).digest() }
  private stream(header: Buffer, length: number): Buffer {
    const p = this.profile, iv = aes(p.headerKey, xor(xor(header, p.cipherMask2), p.gameKey), true)
    const prefix = xor(iv, p.cipherMask1).subarray(0, 12), counters = Buffer.alloc(length)
    for (let offset = 0; offset < length; offset += 16) { prefix.copy(counters, offset); counters.writeUInt32LE(offset / 16 + 1, offset + 12) }
    return aes(p.streamKey, counters, true)
  }
  decode(bin: Buffer): { payload: Buffer; seed: number; header: Buffer } {
    if (bin.length !== P2G_BIN_SIZE) throw new Error('P2G BIN 长度不匹配，当前仅支持已验证的 PPSSPP 日版/汉化版格式')
    const header = Buffer.from(bin.subarray(0, 16)), inner = xor(bin.subarray(16), this.stream(header, bin.length - 16))
    const decode = this.profile.decode, seed = this.translate(this.translate(inner.subarray(-4), decode), decode).readUInt32LE()
    const plain = this.translate(this.gameXor(this.translate(inner.subarray(0, -4), decode), seed), decode)
    const payload = Buffer.from(plain.subarray(0, -20))
    if (!timingSafeEqual(this.digest(payload), plain.subarray(-20))) throw new Error('P2G 游戏内 SHA-1 校验失败，不能编辑此存档')
    return { payload, seed, header }
  }
  encode(payload: Buffer, seed: number, header: Buffer): Buffer {
    if (payload.length !== P2G_PAYLOAD_SIZE || header.length !== 16) throw new Error('P2G 存档结构长度错误')
    const encode = this.profile.encode, seedBytes = Buffer.alloc(4); seedBytes.writeUInt32LE(seed)
    const body = this.translate(this.gameXor(this.translate(Buffer.concat([payload, this.digest(payload)]), encode), seed), encode)
    const inner = Buffer.concat([body, this.translate(this.translate(seedBytes, encode), encode)])
    return Buffer.concat([header, xor(inner, this.stream(header, inner.length))])
  }
}
