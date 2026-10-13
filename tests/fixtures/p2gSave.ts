import { P2gCodec, P2G_PAYLOAD_SIZE } from '../../api/save/p2g/codec'
import { p2gProfileSchema } from '../../api/save/p2g/profile'
import { P2gSfo } from '../../api/save/p2g/sfo'
import { P2G_LAYOUT as L } from '../../api/save/adapters/mhp2g'

// Entirely synthetic parameters and data; not extracted from a game or user's save.
export const syntheticP2gProfileDocument = { version: 1,
  encode: Buffer.from(Array.from({ length: 256 }, (_, i) => (i + 7) & 255)).toString('hex'),
  decode: Buffer.from(Array.from({ length: 256 }, (_, i) => (i + 249) & 255)).toString('hex'),
  salt: '11'.repeat(20), multipliers: [7, 11], moduli: [65521, 65519],
  ...Object.fromEntries(['gameKey', 'hashKey', 'macKey', 'sfoKey', 'cipherMask1', 'cipherMask2', 'headerKey', 'streamKey'].map((k, i) => [k, (i + 20).toString(16).repeat(16)])),
  rankGates: Array.from({ length: 8 }, (_, i) => ({ bit: i, rank: i + 2 })),
}
export const syntheticP2gProfile = p2gProfileSchema.parse(syntheticP2gProfileDocument)
export function syntheticP2gSave() {
  const payload = Buffer.alloc(P2G_PAYLOAD_SIZE), b = L.start
  payload.write('Test', b, 'utf16le'); payload[b + 0x12] = 1
  payload.fill(255, b + L.refs, b + L.refs + 12)
  for (let p = 0; p < 20; p++) payload.fill(255, b + L.presets + p * 32, b + L.presets + p * 32 + 12)
  for (const id of [829, 830]) payload[b + L.obtained + (id >> 3)] |= 1 << (id & 7)
  payload.set([1, 0, 1, 0, 3, 0x81, 0, 0, 0, 0, 0, 0], b + L.box)
  payload.copy(payload, b + L.gear + 12, b + L.box, b + L.box + 12); payload.writeUInt16LE(0, b + L.refs + 2)
  const names = ['SAVEDATA_DIRECTORY', 'SAVEDATA_FILE_LIST', 'SAVEDATA_PARAMS']
  const namesBytes = Buffer.from(names.join('\0') + '\0'), keys = 20 + 3 * 16, values = (keys + namesBytes.length + 3) & ~3
  const sfo = Buffer.alloc(values + 16 + 32 + 128)
  sfo.writeUInt32LE(0x46535000); sfo.writeUInt32LE(0x101, 4); sfo.writeUInt32LE(keys, 8); sfo.writeUInt32LE(values, 12); sfo.writeUInt32LE(3, 16); namesBytes.copy(sfo, keys)
  let nameOffset = 0, dataOffset = 0
  for (let i = 0; i < 3; i++) {
    const at = 20 + i * 16, length = [16, 32, 128][i]
    sfo.writeUInt16LE(nameOffset, at); sfo.writeUInt16LE(i === 0 ? 0x204 : 4, at + 2); sfo.writeUInt32LE(length, at + 4); sfo.writeUInt32LE(length, at + 8); sfo.writeUInt32LE(dataOffset, at + 12)
    nameOffset += names[i].length + 1; dataOffset += length
  }
  sfo.write('ULJM05500', values); sfo.write('MHP2NDG.BIN', values + 16); sfo[values + 48] = 0x41; sfo.fill(1, values + 48 + 0x20, values + 48 + 0x30)
  const codec = new P2gCodec(syntheticP2gProfile), bin = codec.encode(payload, 123, Buffer.alloc(16, 0x35))
  return { payload, bin, sfo: new P2gSfo(sfo, codec).rebuild(bin) }
}
