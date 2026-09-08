import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { parseArc, parseGmd, parseQuestData, readQuestArchive } from '../tools/lib/mhQuestArc.mjs'
import { dlcLevelId, loadMonsterMappings } from '../tools/lib/monsterMappings.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

function questDataFixture() {
  const data = Buffer.alloc(235)
  data.writeUInt32LE(0x12345678, 12)
  data.writeUInt8(5, 16)
  data.writeUInt8(14, 18)
  data.writeUInt8(104, 20)
  data.writeUInt8(50, 22)
  data.writeUInt32LE(1200, 49)
  data.writeUInt32LE(36000, 57)
  data.writeUInt32LE(7200, 61)
  data.writeUInt32LE(1800, 77)
  data.writeUInt32LE(240, 81)
  ;[1, 269, 513, 0, 1351].forEach((monsterId, slot) => data.writeUInt16LE(monsterId, 100 + 13 * slot))
  return data
}

function gmdFixture(language) {
  const strings = ['QUEST_KEY', '测试任务', '公会', '任务说明', '小型怪物A、 小型怪物B', '狩猎目标', '报酬金归零', '交付副目标']
  return Buffer.concat([Buffer.from('GMD'), Buffer.alloc(0x30 - 3), Buffer.from(`${strings.join('\0')}\0`, language)])
}

function arcFixture(entries) {
  const header = Buffer.alloc(12)
  header.write('ARC\0', 0, 'ascii')
  header.writeUInt16LE(17, 4)
  header.writeUInt16LE(entries.length, 6)
  const table = Buffer.alloc(entries.length * 80)
  const payloads = []
  let dataOffset = header.length + table.length
  entries.forEach((entry, index) => {
    const offset = index * 80
    table.write(entry.name, offset, 64, 'utf8')
    table.writeUInt32LE(entry.type, offset + 64)
    const compressed = zlib.deflateSync(entry.data)
    table.writeUInt32LE(compressed.length, offset + 68)
    table.writeUInt32LE(entry.data.length, offset + 72)
    table.writeUInt32LE(dataOffset, offset + 76)
    payloads.push(compressed)
    dataOffset += compressed.length
  })
  return Buffer.concat([header, table, ...payloads])
}

describe('monster catalog native data parsers', () => {
  it('reads every audited questData offset and all five large-monster slots', () => {
    expect(parseQuestData(questDataFixture())).toMatchObject({
      questId: 0x12345678,
      nativeTypeId: 5,
      nativeStar: 14,
      nativeLocationId: 104,
      timeMinutes: 50,
      fee: 1200,
      reward: 36000,
      reward2: 7200,
      hrp: 1800,
      hrp2: 240,
      nativeLargeMonsterIds: [1, 269, 513, 1351],
    })
  })

  it('reads the fixed GMD text fields including appearing monsters', () => {
    expect(parseGmd(gmdFixture('utf8'))).toEqual({
      key: 'QUEST_KEY',
      title: '测试任务',
      client: '公会',
      description: '任务说明',
      appearingMonsters: '小型怪物A、 小型怪物B',
      goal: '狩猎目标',
      failure: '报酬金归零',
      subGoal: '交付副目标',
    })
  })

  it('inflates ARC v17 entries and selects quest/GMD entries by their stable type IDs', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-save-edit-monster-audit-'))
    temporaryDirectories.push(directory)
    const file = path.join(directory, 'q1234567.arc')
    fs.writeFileSync(file, arcFixture([
      { name: 'questData', type: 0x1bbfd18e, data: questDataFixture() },
      { name: 'msg_q1234567_chS', type: 0x242bb29a, data: gmdFixture('utf8') },
    ]))

    expect(parseArc(file)).toMatchObject({ version: 17 })
    expect(readQuestArchive(file, 'chS')).toMatchObject({
      file: 'q1234567.arc',
      quest: { nativeStar: 14, nativeLargeMonsterIds: [1, 269, 513, 1351] },
      text: { title: '测试任务', appearingMonsters: '小型怪物A、 小型怪物B' },
    })
  })
})

describe('monster catalog audited enumerations', () => {
  it('loads numeric maps from the private research boundary', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-save-edit-monster-mappings-'))
    temporaryDirectories.push(directory)
    const mappingDirectory = path.join(directory, 'mhgu/crosswalks')
    fs.mkdirSync(mappingDirectory, { recursive: true })
    fs.writeFileSync(path.join(mappingDirectory, 'monster-catalog-mappings.json'), JSON.stringify({
      format: 'mh-save-edit-monster-mappings-v1',
      statuses: { 13: 'test-status' },
      hiddenStatusIds: [12],
      traps: { 1: 'test-trap' },
      nativeQuestTypes: { 0: 3 },
      nativeLocations: { 1: 28 },
      nativeLargeMonsters: { 1: 95 },
    }))

    const mappings = loadMonsterMappings(directory)
    expect(mappings.statusNames.get(13)).toBe('test-status')
    expect(mappings.hiddenStatusIds.has(12)).toBe(true)
    expect(mappings.trapNames.get(1)).toBe('test-trap')
    expect(mappings.nativeLargeMonsters.get(1)).toBe(95)
  })

  it('keeps DLC ranks stable', () => {
    expect(dlcLevelId(1)).toBe(35)
    expect(dlcLevelId(7)).toBe(41)
    expect(dlcLevelId(11)).toBe(42)
    expect(dlcLevelId(14)).toBe(45)
    expect(dlcLevelId(8)).toBeNull()
  })
})
