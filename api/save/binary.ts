export type BytePatch = { offset: number; before: Buffer; after: Buffer }

export function readU16(buffer: Buffer, offset: number, bigEndian = false): number {
  return bigEndian ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset)
}

export function readI8(buffer: Buffer, offset: number): number { return buffer.readInt8(offset) }
export function readU32(buffer: Buffer, offset: number, bigEndian = false): number {
  return bigEndian ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset)
}
export function writeU16(buffer: Buffer, offset: number, value: number, bigEndian = false): void {
  if (bigEndian) buffer.writeUInt16BE(value & 0xffff, offset)
  else buffer.writeUInt16LE(value & 0xffff, offset)
}
export function writeU32(buffer: Buffer, offset: number, value: number, bigEndian = false): void {
  if (bigEndian) buffer.writeUInt32BE(value >>> 0, offset)
  else buffer.writeUInt32LE(value >>> 0, offset)
}

export function bufferToHex(buffer: Buffer): string { return buffer.toString('hex') }
export function hexToBuffer(value: string, expectedLength?: number): Buffer {
  if (!/^(?:[0-9a-f]{2})*$/i.test(value)) throw new Error('记录必须是偶数长度的十六进制字节')
  const result = Buffer.from(value, 'hex')
  if (expectedLength != null && result.length !== expectedLength) throw new Error(`记录长度必须为 ${expectedLength} 字节`)
  return result
}

export function diffBuffers(before: Buffer, after: Buffer): BytePatch[] {
  if (before.length !== after.length) throw new Error('补丁前后缓冲区长度不一致')
  const patches: BytePatch[] = []
  let start = -1
  for (let index = 0; index <= before.length; index += 1) {
    const different = index < before.length && before[index] !== after[index]
    if (different && start < 0) start = index
    if (!different && start >= 0) {
      patches.push({ offset: start, before: Buffer.from(before.subarray(start, index)), after: Buffer.from(after.subarray(start, index)) })
      start = -1
    }
  }
  return patches
}

export function applyPatches(target: Buffer, patches: BytePatch[], direction: 'forward' | 'backward'): void {
  for (const patch of patches) (direction === 'forward' ? patch.after : patch.before).copy(target, patch.offset)
}

export function decodeUtf8(buffer: Buffer, offset: number, length: number): string {
  const end = buffer.indexOf(0, offset)
  return buffer.subarray(offset, end < 0 || end >= offset + length ? offset + length : end).toString('utf8')
}

export function encodeUtf8(value: string, length: number): Buffer {
  const output = Buffer.alloc(length)
  let encoded = Buffer.from(value, 'utf8')
  while (encoded.length >= length && value.length) {
    value = value.slice(0, -1)
    encoded = Buffer.from(value, 'utf8')
  }
  encoded.copy(output)
  return output
}

export function decodeUtf16Le(buffer: Buffer, offset: number, codeUnits: number): string {
  const values: number[] = []
  for (let index = 0; index < codeUnits; index += 1) {
    const unit = buffer.readUInt16LE(offset + index * 2)
    if (!unit) break
    values.push(unit)
  }
  return String.fromCharCode(...values)
}

export function encodeUtf16Le(value: string, codeUnits: number): Buffer {
  const output = Buffer.alloc(codeUnits * 2)
  const values = [...value].join('').slice(0, codeUnits - 1)
  Buffer.from(values, 'utf16le').subarray(0, (codeUnits - 1) * 2).copy(output)
  return output
}
