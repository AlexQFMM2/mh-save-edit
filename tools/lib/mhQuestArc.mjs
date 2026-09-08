import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const QUEST_DATA_TYPE = 0x1bbfd18e
export const GMD_TYPE = 0x242bb29a
const ARC_HEADER_SIZE = 12
const ARC_ENTRY_SIZE = 80
const ARC_PATH_SIZE = 64
const QUEST_DATA_MIN_SIZE = 165

function readCString(buffer) {
  const end = buffer.indexOf(0)
  return buffer.subarray(0, end < 0 ? buffer.length : end).toString('utf8')
}

export function parseArc(file) {
  const buffer = fs.readFileSync(file)
  if (buffer.subarray(0, 4).toString('ascii') !== 'ARC\0') throw new Error(`Invalid ARC magic: ${file}`)
  const version = buffer.readUInt16LE(4)
  if (version !== 17) throw new Error(`Unsupported ARC version ${version}: ${file}`)
  const count = buffer.readUInt16LE(6)
  if (ARC_HEADER_SIZE + count * ARC_ENTRY_SIZE > buffer.length) throw new Error(`Truncated ARC table: ${file}`)

  const entries = []
  for (let index = 0; index < count; index += 1) {
    const offset = ARC_HEADER_SIZE + index * ARC_ENTRY_SIZE
    const name = readCString(buffer.subarray(offset, offset + ARC_PATH_SIZE))
    const type = buffer.readUInt32LE(offset + 64)
    const compressedSize = buffer.readUInt32LE(offset + 68)
    const expectedSize = buffer.readUInt32LE(offset + 72) & 0x3fffffff
    const dataOffset = buffer.readUInt32LE(offset + 76)
    if (dataOffset + compressedSize > buffer.length) throw new Error(`Truncated ARC entry ${name}: ${file}`)
    const data = zlib.inflateSync(buffer.subarray(dataOffset, dataOffset + compressedSize))
    if (data.length !== expectedSize) throw new Error(`ARC size mismatch for ${name}: ${file}`)
    entries.push({ name, type, data })
  }
  return { file: path.basename(file), version, entries }
}

export function parseGmd(data) {
  if (data.length < 48 || data.subarray(0, 3).toString('ascii') !== 'GMD') throw new Error('Invalid quest GMD')
  const strings = data.subarray(0x30).toString('utf8').split('\0')
  if (strings.length < 8) throw new Error('Quest GMD is missing required strings')
  return {
    key: strings[0] ?? '',
    title: strings[1] ?? '',
    client: strings[2] ?? '',
    description: strings[3] ?? '',
    appearingMonsters: strings[4] ?? '',
    goal: strings[5] ?? '',
    failure: strings[6] ?? '',
    subGoal: strings[7] ?? '',
  }
}

export function parseQuestData(data) {
  if (data.length < QUEST_DATA_MIN_SIZE) throw new Error(`Quest data is too short: ${data.length}`)
  return {
    questId: data.readUInt32LE(12),
    nativeTypeId: data.readUInt8(16),
    nativeStar: data.readUInt8(18),
    nativeLocationId: data.readUInt8(20),
    timeMinutes: data.readUInt8(22),
    fee: data.readUInt32LE(49),
    reward: data.readUInt32LE(57),
    reward2: data.readUInt32LE(61),
    hrp: data.readUInt32LE(77),
    hrp2: data.readUInt32LE(81),
    nativeLargeMonsterIds: Array.from({ length: 5 }, (_, slot) => data.readUInt16LE(100 + 13 * slot)).filter(Boolean),
    core: data.subarray(0, Math.min(235, data.length)),
  }
}

export function readQuestArchive(file, languageSuffix) {
  const arc = parseArc(file)
  const questEntry = arc.entries.find((entry) => entry.type === QUEST_DATA_TYPE)
  const gmdEntry = arc.entries.find((entry) => entry.type === GMD_TYPE && entry.name.endsWith(`_${languageSuffix}`))
  return {
    file: arc.file,
    quest: questEntry ? parseQuestData(questEntry.data) : null,
    text: gmdEntry ? parseGmd(gmdEntry.data) : null,
    entryNames: arc.entries.map((entry) => entry.name),
  }
}
