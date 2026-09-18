import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { bufferToHex, writeU16 } from '../api/save/binary'
import { Mh3uSaveAdapter } from '../api/save/adapters/mh3u'
import { encryptMh4g, Mh4gSaveAdapter } from '../api/save/adapters/mh4g'
import { MhguSaveAdapter } from '../api/save/adapters/mhgu'
import { SaveSessionService } from '../api/save/sessionService'
import type { LogicalLoadout } from '../api/loadout/types'

const temporaryDirectories: string[] = []

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'mh-save-session-'))
  temporaryDirectories.push(directory)
  return directory
}

function createMhguCatalog(directory: string) {
  const database = new Database(join(directory, 'mhgu.sqlite'))
  database.exec(`
    CREATE TABLE catalog_items(game_id TEXT,save_id INTEGER,name_cn TEXT,max_stack INTEGER,is_placeholder INTEGER);
    CREATE TABLE catalog_weapons(game_id TEXT,save_type INTEGER,save_id INTEGER,save_level INTEGER,name_cn TEXT,slots INTEGER,is_placeholder INTEGER);
    CREATE TABLE catalog_armor_save_identities(game_id TEXT,armor_dex_id INTEGER,save_type INTEGER,save_id INTEGER);
    CREATE TABLE catalog_armors(game_id TEXT,dex_id INTEGER,name_cn TEXT,part TEXT,slots INTEGER,is_placeholder INTEGER);
    CREATE TABLE cn__talismans(id INTEGER,name TEXT,max_slots INTEGER);
    CREATE TABLE catalog_palico_weapons(game_id TEXT,equipment_id INTEGER,save_id INTEGER,name_cn TEXT);
    CREATE TABLE catalog_palico_armors(game_id TEXT,equipment_id INTEGER,save_id INTEGER,name_cn TEXT,part TEXT);
    INSERT INTO catalog_items VALUES('mhgu',1,'测试道具',99,0);
    INSERT INTO catalog_weapons VALUES('mhgu',7,1,0,'测试大剑',0,0);
    INSERT INTO catalog_weapons VALUES('mhgu',7,2,3,'强化测试大剑',1,0);
    INSERT INTO catalog_weapons VALUES('mhgu',20,30,2,'测试操虫棍',2,0);
    INSERT INTO catalog_armor_save_identities VALUES('mhgu',88,1,9);
    INSERT INTO catalog_armors VALUES('mhgu',88,'测试头盔','head',1,0);
    INSERT INTO cn__talismans VALUES(1,'士兵护石',1);
    INSERT INTO catalog_palico_weapons VALUES('mhgu',44,144,'测试猫剑');
    INSERT INTO catalog_palico_armors VALUES('mhgu',45,145,'测试猫头','head');
    INSERT INTO catalog_palico_armors VALUES('mhgu',46,146,'测试猫身','body');
  `)
  database.close()
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('SaveSessionService transfers', () => {
  it.each(['mhgu-switch-yuzu', 'mhxx-3ds-citra'] as const)('round-trips five-part appearances, unknown preservation and undo for %s', (formatId) => {
    const directory = temporaryDirectory(); createMhguCatalog(directory)
    const db = new Database(join(directory, 'mhgu.sqlite'))
    for (const part of ['head', 'chest', 'arms', 'waist', 'legs']) {
      db.exec(`CREATE TABLE cn__armor_${part}(id INTEGER,name TEXT,english TEXT,rarity INTEGER)`)
      db.prepare(`INSERT INTO cn__armor_${part} VALUES(7,?,?,1)`).run(`synthetic-${part}`, part)
    }
    db.exec("INSERT INTO cn__armor_chest VALUES(99,'chest only','chest only',1)"); db.close()
    const xx = formatId === 'mhxx-3ds-citra'
    const bytes = Buffer.alloc(xx ? 4_726_152 : 5_159_064)
    bytes.writeUInt32LE(0xc6, 0); bytes[4] = 1; bytes.writeUInt32LE(0x1c, 8)
    ;(xx ? [0x126474, 0x244c34, 0x3633f4] : [0x18cc78, 0x2ac53c, 0x3cbe00]).forEach((base, index) => bytes.writeUInt32LE(base, 0x10 + index * 4))
    const initial = new MhguSaveAdapter(bytes, formatId, 'system'); initial.selectCharacter(0)
    const records = Array.from({ length: 5 }, (_, index) => {
      const record = Buffer.alloc(36, 0x5a); writeU16(record, 0, 0xa800 | (4 << 5) | (index + 1)); writeU16(record, 2, 9); writeU16(record, 4, index === 0 ? 40000 : 0); initial.setEquipment(index, record); return record
    })
    const weaponRecord = Buffer.alloc(36); writeU16(weaponRecord, 0, 7); writeU16(weaponRecord, 2, 1); initial.setEquipment(5, weaponRecord)
    const source = initial.serialize(); const sourcePath = join(directory, 'system'); writeFileSync(sourcePath, source)
    const service = new SaveSessionService(directory)
    try {
      let session = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId }).session!
      session = service.selectCharacter(session.sessionId, 0)
      const patch = (slot: number, appearanceId: number) => service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot, changes: { appearanceId } }).session
      session = patch(0, 40000); expect(session.undoCount).toBe(0)
      expect(() => patch(0, 99)).toThrow(/相同部位/)
      expect(() => patch(5, 7)).toThrow(/不支持外观/)
      for (let slot = 0; slot < 5; slot++) session = patch(slot, 7)
      const exportPath = join(directory, 'draft.mhbox')
      const draft = () => { service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'full' }, exportPath); return (JSON.parse(readFileSync(exportPath, 'utf8')) as { records: { slot: number; recordHex: string }[] }).records }
      const changedRecords = draft()
      records.forEach((record, slot) => { const expected = Buffer.from(record); writeU16(expected, 4, 7); expect(changedRecords.find(value => value.slot === slot)?.recordHex).toBe(bufferToHex(expected)) })
      for (let i = 0; i < 5; i++) session = service.undo(session.sessionId, session.revision).session
      const originalRecords = draft()
      records.forEach((record, slot) => expect(originalRecords.find(value => value.slot === slot)?.recordHex).toBe(bufferToHex(record)))
      for (let i = 0; i < 5; i++) session = service.redo(session.sessionId, session.revision).session
      const output = join(directory, 'preview-system'); session = service.save(session.sessionId, session.revision, output).session!
      const restored = new MhguSaveAdapter(readFileSync(output), formatId, 'system'); restored.selectCharacter(0)
      records.forEach((record, slot) => { const expected = Buffer.from(record); writeU16(expected, 4, 7); expect(restored.equipment(slot).recordHex).toBe(bufferToHex(expected)) })
      session = patch(0, 0); service.save(session.sessionId, session.revision, output)
      const cleared = new MhguSaveAdapter(readFileSync(output), formatId, 'system'); cleared.selectCharacter(0)
      expect(cleared.equipment(0).appearanceId).toBe(0)
      expect(readFileSync(sourcePath)).toEqual(source)
    } finally { service.dispose() }
  })

  it('searches the entire physical item box and rotates to the next cross-page match', () => {
    const directory = temporaryDirectory()
    const database = new Database(join(directory, 'mh3g.sqlite'))
    database.exec('CREATE TABLE catalog_items (game_id TEXT, save_id INTEGER, name_cn TEXT, name_en TEXT, name_jp TEXT, icon_path TEXT, max_stack INTEGER, rarity INTEGER, is_placeholder INTEGER)')
    database.prepare('INSERT INTO catalog_items VALUES (?,?,?,?,?,?,?,?,?)').run('mh3g', 345, '跨页回复药', 'Cross-page Potion', '', null, 99, 2, 0)
    database.close()
    const sourcePath = join(directory, 'user1')
    const adapter = new Mh3uSaveAdapter(Buffer.alloc(0x8a00), 'mh3g-3ds-citra')
    adapter.setItem(12, 345, 3)
    adapter.setItem(137, 345, 7)
    writeFileSync(sourcePath, adapter.serialize())

    const service = new SaveSessionService(directory)
    const session = service.openPath(sourcePath, { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra' }).session!
    const first = service.getSection({ sessionId: session.sessionId, revision: session.revision, section: 'item-box', page: 1, query: '跨页回复药', locateAfterSlot: 12 })
    expect(first).toMatchObject({ kind: 'item-box', page: 1, matchingCount: 2, matchingSlots: [137, 12] })
    const second = service.getSection({ sessionId: session.sessionId, revision: session.revision, section: 'item-box', page: 2, query: '跨页回复药' })
    expect(second.kind === 'item-box' && second.cells.find(value => value.slot === 137)).toMatchObject({ nameCn: '跨页回复药', count: 7 })
    const emptyQuery = service.getSection({ sessionId: session.sessionId, revision: session.revision, section: 'item-box', page: 1 })
    expect(emptyQuery.kind === 'item-box' && emptyQuery.matchingSlots).toBeUndefined()
    service.dispose()
  })

  it.each([
    ['mh3g-3ds-citra' as const, 0x8a00, 16],
    ['mh3u-wiiu-cemu' as const, 0x8a24, 16],
  ])('round-trips legacy MH3U item and equipment CSV for %s', (formatId, size, recordSize) => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'user1')
    const source = Buffer.alloc(size)
    if (formatId === 'mh3u-wiiu-cemu') {
      source[0x1e] = 0x8a
    }
    const initial = new Mh3uSaveAdapter(source, formatId)
    initial.setItem(137, 345, 17)
    const equipment = Buffer.from(Array.from({ length: recordSize }, (_, index) => (index * 13 + 7) & 0xff))
    equipment[0] = 7
    equipment[1] = 3
    writeU16(equipment, 2, 412)
    initial.setEquipment(234, equipment)
    writeFileSync(sourcePath, initial.serialize())

    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mh3g', formatId })
    let session = opened.session!
    const itemCsv = join(directory, 'items.csv')
    const equipmentCsv = join(directory, 'equipment.csv')
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'csv' }, itemCsv)
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, equipmentCsv)

    session = service.apply({ kind: 'set-item', sessionId: session.sessionId, revision: session.revision, slot: 137, itemId: 0, count: 0 }).session
    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 234 }).session
    const itemPreview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'csv' }, itemCsv)
    expect(itemPreview.invalid).toBe(0)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: itemPreview.token }).session
    const equipmentPreview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, equipmentCsv)
    expect(equipmentPreview.invalid).toBe(0)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: equipmentPreview.token }).session

    const outputPath = join(directory, 'restored-user1')
    service.save(session.sessionId, session.revision, outputPath)
    expect(readFileSync(outputPath)).toEqual(initial.serialize())
    service.dispose()
  })

  it('round-trips MH4G legacy CSV through decrypted records', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'user1')
    const plain = Buffer.alloc(81_408)
    plain.writeUInt16LE(0x10, 0)
    plain.writeUInt16LE(0x1731, 2)
    const initial = new Mh4gSaveAdapter(encryptMh4g(plain))
    initial.setItem(208, 901, 33)
    const equipment = Buffer.from(Array.from({ length: 28 }, (_, index) => (index * 9 + 3) & 0xff))
    equipment[0] = 6
    equipment[1] = 3
    writeU16(equipment, 2, 5)
    initial.setEquipment(418, equipment)
    writeFileSync(sourcePath, initial.serialize())

    const service = new SaveSessionService(directory)
    let session = service.openPath(sourcePath, { contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }).session!
    const itemCsv = join(directory, 'mh4g-items.csv')
    const equipmentCsv = join(directory, 'mh4g-equipment.csv')
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'csv' }, itemCsv)
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, equipmentCsv)
    session = service.apply({ kind: 'set-item', sessionId: session.sessionId, revision: session.revision, slot: 208, itemId: 0, count: 0 }).session
    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 418 }).session
    let preview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'csv' }, itemCsv)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: preview.token }).session
    preview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, equipmentCsv)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: preview.token }).session
    const outputPath = join(directory, 'restored-user1')
    service.save(session.sessionId, session.revision, outputPath)
    expect(readFileSync(outputPath)).toEqual(initial.serialize())
    service.dispose()
  })

  it('imports GU hunter and Palico CSV using the old editor field protocol', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'system')
    const source = guDocument()
    const initial = new MhguSaveAdapter(source, 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    initial.setItem(66, 832, 99)
    const hunter = Buffer.alloc(36)
    writeU16(hunter, 0, 6 | (9 << 5))
    writeU16(hunter, 2, 4)
    writeU16(hunter, 4, 77)
    writeU16(hunter, 6, 101)
    writeU16(hunter, 8, 102)
    hunter[12] = 18
    hunter[13] = 37
    hunter.writeInt8(12, 14)
    hunter.writeInt8(-7, 15)
    hunter[16] = 3
    hunter[25] = 0xab
    initial.setEquipment(51, hunter)
    const palico = Buffer.alloc(36)
    palico[0] = 22
    writeU16(palico, 2, 144)
    writeU16(palico, 4, 55)
    palico[20] = 0xcd
    initial.setEquipment(9, palico, true)
    writeFileSync(sourcePath, initial.serialize())

    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    const hunterCsv = join(directory, 'hunter.csv')
    const palicoCsv = join(directory, 'palico.csv')
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, hunterCsv)
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'palico-equipment', format: 'csv' }, palicoCsv)
    expect(readFileSync(palicoCsv, 'utf8')).toContain('palico,10,22,144,55,0,0,0,0,0,0,0,0,0')

    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 51 }).session
    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'palico-equipment', slot: 9 }).session
    let preview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', format: 'csv' }, hunterCsv)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: preview.token }).session
    preview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'palico-equipment', format: 'csv' }, palicoCsv)
    session = service.applyImport({ sessionId: session.sessionId, revision: session.revision, token: preview.token }).session
    const outputPath = join(directory, 'restored-system')
    service.save(session.sessionId, session.revision, outputPath)
    const restored = new MhguSaveAdapter(readFileSync(outputPath), 'mhgu-switch-yuzu', 'system')
    restored.selectCharacter(0)
    expect(restored.item(66)).toMatchObject({ itemId: 832, count: 99 })
    expect(restored.equipment(51)).toMatchObject({ saveType: 6, saveId: 4, appearanceId: 77, level: 9, decorations: [101, 102, 0], skill1Id: 18, skill1Points: 12, skill2Id: 37, skill2Points: -7, slots: 3 })
    expect(restored.equipment(9, true)).toMatchObject({ saveType: 22, saveId: 144, appearanceId: 55 })
    expect(restored.equipment(51).recordHex).not.toBe(bufferToHex(hunter))
    service.dispose()
  })

  it('rejects a full backup from a different save format before creating an import token', () => {
    const directory = temporaryDirectory()
    const mh3gPath = join(directory, 'mh3g-user1')
    writeFileSync(mh3gPath, Buffer.alloc(0x8a00))
    const service = new SaveSessionService(directory)
    const session = service.openPath(mh3gPath, { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra' }).session!
    const backupPath = join(directory, 'items.mhbox')
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'full' }, backupPath)
    service.close(session.sessionId)

    const wiiuPath = join(directory, 'mh3u-user1')
    const wiiu = Buffer.alloc(0x8a24)
    wiiu[0x1e] = 0x8a
    writeFileSync(wiiuPath, wiiu)
    const other = service.openPath(wiiuPath, { contentGameId: 'mh3g', formatId: 'mh3u-wiiu-cemu' }).session!
    expect(() => service.previewImport({ sessionId: other.sessionId, revision: other.revision, domain: 'items', format: 'full' }, backupPath)).toThrow(/格式/)
    service.dispose()
  })

  it('patches GU packed equipment and signed charm points without changing unrelated bytes', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    const record = Buffer.alloc(36, 0x5a)
    const reservedPackedBits = 0b101011 << 10
    writeU16(record, 0, reservedPackedBits | (4 << 5) | 7)
    writeU16(record, 2, 81)
    initial.setEquipment(12, record)
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    session = service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 12, changes: { saveType: 6, saveId: 4, level: 17, decorations: [101, 102, 103], skill1Id: 18, skill1Points: -128, skill2Id: 37, skill2Points: 127, slots: 3 } }).session
    const outputPath = join(directory, 'patched-system')
    service.save(session.sessionId, session.revision, outputPath)
    const restored = new MhguSaveAdapter(readFileSync(outputPath), 'mhgu-switch-yuzu', 'system')
    restored.selectCharacter(0)
    const patched = Buffer.from(restored.equipment(12).recordHex, 'hex')
    expect(patched.readUInt16LE(0) & 0xfc00).toBe(reservedPackedBits)
    expect(restored.equipment(12)).toMatchObject({ saveType: 6, saveId: 4, level: 17, decorations: [101, 102, 103], skill1Points: -128, skill2Points: 127, slots: 3 })
    expect(patched[20]).toBe(0x5a)
    service.dispose()
  })

  it('creates replacements from a clean record while instance edits preserve unrelated bytes', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    const record = Buffer.alloc(36, 0x5a)
    writeU16(record, 0, (0b101011 << 10) | 7)
    writeU16(record, 2, 81)
    initial.setEquipment(12, record)
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)

    session = service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 12, changes: { saveId: 82 } }).session
    let edited = Buffer.from((service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter.equipment(12).recordHex, 'hex')
    expect(edited[20]).toBe(0x5a)
    expect(edited.readUInt16LE(0) & 0xfc00).toBe(0b101011 << 10)

    session = service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 12, changes: { reset: true, saveType: 7, saveId: 99, level: 0 } }).session
    edited = Buffer.from((service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter.equipment(12).recordHex, 'hex')
    expect(edited[20]).toBe(0)
    expect(edited.readUInt16LE(0) & 0xfc00).toBe(0)
    service.dispose()
  })

  it('adds a whole loadout as one atomic undo command', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    writeFileSync(sourcePath, guDocument())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    const loadout: LogicalLoadout = {
      schemaVersion: 1, dataVersion: 'test', gameId: 'mhgu', name: '原子测试', gender: 'male',
      weapon: { kind: 'weapon', gameId: 'mhgu', candidateKey: 'weapon:7:1', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试武器', nameEn: '', typeId: 0, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked' },
      armor: {},
      charm: { kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '测试护石', slots: 0, skill1: null, skill2: null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' },
    }
    const result = service.addLoadout({ sessionId: session.sessionId, revision: session.revision, loadout })
    session = result.session
    expect(session.undoCount).toBe(1)
    const adapter = (service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter
    expect(adapter.equipment(0).empty).toBe(false)
    expect(adapter.equipment(1).empty).toBe(false)
    session = service.undo(session.sessionId, session.revision).session
    expect(session.undoCount).toBe(0)
    expect(adapter.equipment(0).empty).toBe(true)
    expect(adapter.equipment(1).empty).toBe(true)
    service.dispose()
  })

  it('previews exact loadout destinations without mutating the session', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    initial.setEquipment(0, Buffer.from([7, 0, 1, 0, ...Array(32).fill(0)]))
    initial.setEquipment(2, Buffer.from([7, 0, 1, 0, ...Array(32).fill(0)]))
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    const session = service.selectCharacter(opened.session!.sessionId, 0)
    const loadout: LogicalLoadout = {
      schemaVersion: 1, dataVersion: 'test', gameId: 'mhgu', name: '预览测试', gender: 'male',
      weapon: { kind: 'weapon', gameId: 'mhgu', candidateKey: 'weapon:7:1', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试武器', nameEn: '', typeId: 0, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked' },
      armor: {},
      charm: { kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '测试护石', slots: 0, skill1: null, skill2: null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' },
    }
    const preview = service.previewLoadoutWrite({ sessionId: session.sessionId, revision: session.revision, loadout })
    expect(preview).toMatchObject({ requiredSlots: 2, nonEmptyCount: 2, capacity: 2000 })
    expect(preview.targets.map(value => value.slot)).toEqual([1, 3])
    expect(service.snapshot()).toMatchObject({ revision: session.revision, dirty: false, undoCount: 0 })
    const adapter = (service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter
    expect(adapter.equipment(1).empty).toBe(true)
    expect(adapter.equipment(3).empty).toBe(true)
    const applied = service.addLoadout({ sessionId: session.sessionId, revision: session.revision, loadout })
    expect(adapter.equipment(1).empty).toBe(false)
    expect(adapter.equipment(3).empty).toBe(false)
    expect(applied.message).toContain('第 1 页第 2 格、第 1 页第 4 格')
    expect(applied.message).toContain('尚未保存')
    service.dispose()
  })

  it('previews exact catalog targets and writes GU native weapon levels and charm markers', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    writeFileSync(sourcePath, guDocument())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    let target = service.previewBoxWriteTarget({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment' })
    expect(target).toMatchObject({ slot: 0, page: 1, cell: 1, capacity: 2000, nonEmptyCount: 0, full: false })

    session = service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'hunter-equipment', saveType: 7, saveId: 2, level: 3, targetSlot: target.slot! }).session
    const adapter = (service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter
    expect(adapter.equipment(0)).toMatchObject({ saveType: 7, saveId: 2, level: 3 })
    target = service.previewBoxWriteTarget({ sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment' })
    expect(target).toMatchObject({ slot: 1, page: 1, cell: 2, nonEmptyCount: 1 })
    expect(() => service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'hunter-equipment', saveType: 7, saveId: 1, targetSlot: 0 })).toThrow(/已被占用/)

    session = service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'hunter-equipment', saveType: 6, saveId: 1 }).session
    const charm = Buffer.from(adapter.equipment(1).recordHex, 'hex')
    expect([...charm.subarray(17, 20)]).toEqual([0, 97, 1])
    service.dispose()
  })

  it('fills existing item stacks before using empty cells and applies the write atomically', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    initial.setItem(0, 1, 97)
    initial.setItem(1, 1, 99)
    initial.setItem(2, 2, 4)
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    const preview = service.previewCatalogItemWrite({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', saveId: 1, count: 5 })
    expect(preview).toMatchObject({ nonEmptyCount: 3, requestedCount: 5, targets: [
      { slot: 0, beforeCount: 97, afterCount: 99, addedCount: 2 },
      { slot: 3, beforeCount: 0, afterCount: 3, addedCount: 3 },
    ] })
    expect(service.snapshot()).toMatchObject({ revision: session.revision, dirty: false, undoCount: 0 })
    const result = service.addCatalogItem({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', saveId: 1, count: 5 })
    session = result.session
    const adapter = (service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter
    expect(adapter.item(0)).toMatchObject({ itemId: 1, count: 99 })
    expect(adapter.item(3)).toMatchObject({ itemId: 1, count: 3 })
    expect(session.undoCount).toBe(1)
    session = service.undo(session.sessionId, session.revision).session
    expect(adapter.item(0)).toMatchObject({ itemId: 1, count: 97 })
    expect(adapter.item(3).empty).toBe(true)
    service.dispose()
  })

  it('reuses a trusted GU Insect Glaive record and blocks fabricated or invalid Palico equipment', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    const glaive = Buffer.alloc(36)
    writeU16(glaive, 0, 20 | (2 << 5))
    writeU16(glaive, 2, 30)
    writeU16(glaive, 6, 123)
    glaive.fill(0xa5, 12)
    initial.setEquipment(10, glaive)
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    let session = service.selectCharacter(opened.session!.sessionId, 0)
    session = service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'hunter-equipment', saveType: 20, saveId: 30, level: 2 }).session
    const adapter = (service as unknown as { session: { adapter: MhguSaveAdapter } }).session.adapter
    const copied = Buffer.from(adapter.equipment(0).recordHex, 'hex')
    expect([...copied.subarray(6, 12)]).toEqual([0, 0, 0, 0, 0, 0])
    expect(copied.subarray(12)).toEqual(glaive.subarray(12))

    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 0 }).session
    session = service.apply({ kind: 'clear-box-slot', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 10 }).session
    expect(() => service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'hunter-equipment', saveType: 20, saveId: 30, level: 2 })).toThrow(/完整猎虫实例/)
    expect(() => service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'palico-equipment', saveType: 22, saveId: 144, appearanceId: 144 })).toThrow(/不支持外观/)
    expect(() => service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mhgu', domain: 'palico-equipment', saveType: 23, saveId: 145, appearanceId: 146 })).toThrow(/相同部位/)
    service.dispose()
  })

  it('filters complete-backup records that exceed the active save encoding', () => {
    const directory = temporaryDirectory()
    createMhguCatalog(directory)
    const sourcePath = join(directory, 'system')
    const initial = new MhguSaveAdapter(guDocument(), 'mhgu-switch-yuzu', 'system')
    initial.selectCharacter(0)
    initial.setItem(0, 1, 1)
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const opened = service.openPath(sourcePath, { contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu' })
    const session = service.selectCharacter(opened.session!.sessionId, 0)
    const backupPath = join(directory, 'items.mhbox')
    service.exportBox({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'full' }, backupPath)
    const document = JSON.parse(readFileSync(backupPath, 'utf8')) as Record<string, unknown>
    document.records = [{ slot: 0, itemId: 1, count: 1 }, { slot: 1, itemId: 0x1000, count: 1 }, { slot: 2, itemId: 0, count: 1 }]
    const { sha256: _oldDigest, ...unsigned } = document
    document.sha256 = createHash('sha256').update(JSON.stringify(unsigned)).digest('hex')
    writeFileSync(backupPath, JSON.stringify(document))
    const preview = service.previewImport({ sessionId: session.sessionId, revision: session.revision, domain: 'items', format: 'full' }, backupPath)
    expect(preview).toMatchObject({ invalid: 2, ignored: 2 })
    expect(preview.diagnostics.filter(value => value.code === 'import.record.encoding')).toHaveLength(2)
    service.dispose()
  })

  it('leaves the entire session unchanged when catalog or loadout writes find a full box', () => {
    const directory = temporaryDirectory()
    const catalog = new Database(join(directory, 'mh3g.sqlite'))
    catalog.exec("CREATE TABLE catalog_items(game_id TEXT,save_id INTEGER,name_cn TEXT,max_stack INTEGER,is_placeholder INTEGER); INSERT INTO catalog_items VALUES('mh3g',2,'测试道具',99,0)")
    catalog.close()
    const sourcePath = join(directory, 'user1')
    const initial = new Mh3uSaveAdapter(Buffer.alloc(0x8a00), 'mh3g-3ds-citra')
    for (let slot = 0; slot < initial.meta.itemCapacity; slot += 1) initial.setItem(slot, 1, 1)
    for (let slot = 0; slot < initial.meta.hunterEquipmentCapacity; slot += 1) {
      const record = Buffer.alloc(initial.meta.recordSize)
      record[0] = 7
      record[2] = 1
      initial.setEquipment(slot, record)
    }
    writeFileSync(sourcePath, initial.serialize())
    const service = new SaveSessionService(directory)
    const session = service.openPath(sourcePath, { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra' }).session!
    const before = Buffer.from((service as unknown as { session: { adapter: Mh3uSaveAdapter } }).session.adapter.payload)
    const loadout: LogicalLoadout = {
      schemaVersion: 1, dataVersion: 'test', gameId: 'mh3g', name: '箱满测试', gender: 'male',
      weapon: { kind: 'weapon', gameId: 'mh3g', candidateKey: 'weapon:7:1', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试武器', nameEn: '', typeId: 0, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked' },
      armor: {}, charm: null,
    }

    expect(() => service.addCatalogItem({ sessionId: session.sessionId, revision: session.revision, gameId: 'mh3g', saveId: 2, count: 1 })).toThrow(/空间不足/)
    expect(() => service.addCatalogEquipment({ sessionId: session.sessionId, revision: session.revision, gameId: 'mh3g', domain: 'hunter-equipment', saveType: 7, saveId: 2 })).toThrow(/已满/)
    expect(() => service.previewLoadoutWrite({ sessionId: session.sessionId, revision: session.revision, loadout })).toThrow(/空间不足/)
    expect(() => service.addLoadout({ sessionId: session.sessionId, revision: session.revision, loadout })).toThrow(/空间不足/)
    expect(service.snapshot()).toMatchObject({ revision: session.revision, dirty: false, undoCount: 0 })
    expect((service as unknown as { session: { adapter: Mh3uSaveAdapter } }).session.adapter.payload).toEqual(before)
    service.dispose()
  })

  it('refuses to overwrite an externally changed file and safely verifies a save-as copy', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'user1')
    const source = Buffer.alloc(0x8a00)
    source.write('Hunter', 7, 'utf8')
    writeFileSync(sourcePath, source)
    const service = new SaveSessionService(directory)
    let session = service.openPath(sourcePath, { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra' }).session!
    session = service.apply({ kind: 'set-item', sessionId: session.sessionId, revision: session.revision, slot: 4, itemId: 22, count: 3 }).session
    const external = Buffer.from(source)
    external[0x80] = 0x7f
    writeFileSync(sourcePath, external)

    expect(() => service.save(session.sessionId, session.revision)).toThrow(/外部修改/)
    expect(readFileSync(sourcePath)).toEqual(external)
    expect(service.snapshot()).toMatchObject({ dirty: true, state: 'readyDirty' })

    const copyPath = join(directory, 'user1-copy')
    const result = service.save(session.sessionId, session.revision, copyPath)
    expect(result.message).toMatch(/安全保存并复核/)
    expect(new Mh3uSaveAdapter(readFileSync(copyPath), 'mh3g-3ds-citra').item(4)).toMatchObject({ itemId: 22, count: 3 })
    service.dispose()
  })

  it('creates a recoverable backup before overwriting the current save', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'user1')
    const source = Buffer.alloc(0x8a00)
    source.write('Hunter', 7, 'utf8')
    writeFileSync(sourcePath, source)
    const service = new SaveSessionService(directory)
    let session = service.openPath(sourcePath, { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra' }).session!
    session = service.apply({ kind: 'set-item', sessionId: session.sessionId, revision: session.revision, slot: 9, itemId: 44, count: 5 }).session
    service.save(session.sessionId, session.revision)

    const backupName = readdirSync(directory).find(name => name.startsWith('user1.backup-'))
    expect(backupName).toBeTruthy()
    expect(readFileSync(join(directory, backupName!))).toEqual(source)
    expect(new Mh3uSaveAdapter(readFileSync(sourcePath), 'mh3g-3ds-citra').item(9)).toMatchObject({ itemId: 44, count: 5 })
    service.dispose()
  })

  it('patches Wii U and MH4G equipment through their canonical record layouts', () => {
    const directory = temporaryDirectory()
    const wiiPath = join(directory, 'wii-user1')
    const wiiSource = Buffer.alloc(0x8a24)
    wiiSource[0x1e] = 0x8a
    const wiiInitial = new Mh3uSaveAdapter(wiiSource, 'mh3u-wiiu-cemu')
    const wiiRecord = Buffer.alloc(16, 0x6c)
    wiiRecord[0] = 6
    wiiRecord[1] = 1
    wiiInitial.setEquipment(7, wiiRecord)
    writeFileSync(wiiPath, wiiInitial.serialize())
    let service = new SaveSessionService(directory)
    let session = service.openPath(wiiPath, { contentGameId: 'mh3g', formatId: 'mh3u-wiiu-cemu' }).session!
    session = service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 7, changes: { saveId: 0x1234, slots: 3, decorations: [0x1111, 0x2222, 0x3333], skill1Id: 44, skill1Points: -9, skill2Id: 77, skill2Points: 10 } }).session
    const wiiOutput = join(directory, 'wii-patched')
    service.save(session.sessionId, session.revision, wiiOutput)
    let equipment = new Mh3uSaveAdapter(readFileSync(wiiOutput), 'mh3u-wiiu-cemu').equipment(7)
    expect(equipment).toMatchObject({ saveId: 0x1234, slots: 3, decorations: [0x1111, 0x2222, 0x3333], skill1Id: 44, skill1Points: -9, skill2Id: 77, skill2Points: 10 })
    expect(Buffer.from(equipment.recordHex, 'hex')[15]).toBe(0x6c)
    service.dispose()

    const mh4gPath = join(directory, 'mh4g-user1')
    const plain = Buffer.alloc(81_408)
    plain.writeUInt16LE(0x10, 0)
    plain.writeUInt16LE(0x1731, 2)
    const mh4gInitial = new Mh4gSaveAdapter(encryptMh4g(plain))
    const mh4gRecord = Buffer.alloc(28, 0x4d)
    mh4gRecord[0] = 6
    mh4gRecord[1] = 1
    mh4gInitial.setEquipment(11, mh4gRecord)
    writeFileSync(mh4gPath, mh4gInitial.serialize())
    service = new SaveSessionService(directory)
    session = service.openPath(mh4gPath, { contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }).session!
    session = service.apply({ kind: 'set-equipment-fields', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 11, changes: { saveId: 0x4321, slots: 2, decorations: [300, 301, 302], skill1Id: 0x1234, skill1Points: -32768, skill2Id: 0x5678, skill2Points: 32767 } }).session
    const mh4gOutput = join(directory, 'mh4g-patched')
    service.save(session.sessionId, session.revision, mh4gOutput)
    equipment = new Mh4gSaveAdapter(readFileSync(mh4gOutput)).equipment(11)
    expect(equipment).toMatchObject({ saveId: 0x4321, slots: 2, decorations: [300, 301, 302], skill1Id: 0x1234, skill1Points: -32768, skill2Id: 0x5678, skill2Points: 32767 })
    expect(Buffer.from(equipment.recordHex, 'hex')[27]).toBe(0x4d)
    service.dispose()
  })

  it('preserves the MH4G decoration fixed bit when adding a complete loadout instance', () => {
    const directory = temporaryDirectory()
    const sourcePath = join(directory, 'user1')
    const plain = Buffer.alloc(81_408)
    plain.writeUInt16LE(0x10, 0)
    plain.writeUInt16LE(0x1731, 2)
    writeFileSync(sourcePath, encryptMh4g(plain))
    const record = Buffer.alloc(28)
    record[0] = 7
    writeU16(record, 2, 1)
    const service = new SaveSessionService(directory)
    const session = service.openPath(sourcePath, { contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }).session!
    const loadout: LogicalLoadout = {
      schemaVersion: 1, dataVersion: 'test', gameId: 'mh4g', name: '固定珠测试', gender: 'male', armor: {}, charm: null,
      weapon: { kind: 'weapon', gameId: 'mh4g', candidateKey: 'save:weapon', sourceKind: 'catalog', weaponKey: null, templateKey: null, saveType: 7, saveId: 1, nameCn: '完整实例', nameEn: '', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 1, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [{ saveId: 101, nameCn: '固定珠', slots: 1, skills: [], fixed: true }], lock: 'equipmentAndDecorations', instance: { source: 'saveInstance', formatId: 'mh4g-3ds-citra', recordHex: bufferToHex(record), legality: 'unknown', encoding: 'encodable', issues: [] } },
    }
    writeU16(record, 2, 2)
    loadout.weapon!.instance!.recordHex = bufferToHex(record)
    expect(() => service.addLoadout({ sessionId: session.sessionId, revision: session.revision, loadout })).toThrow(/类型、ID 或等级/)
    writeU16(record, 2, 1)
    loadout.weapon!.instance!.recordHex = bufferToHex(record)
    service.addLoadout({ sessionId: session.sessionId, revision: session.revision, loadout })
    const adapter = (service as unknown as { session: { adapter: Mh4gSaveAdapter } }).session.adapter
    expect(Buffer.from(adapter.equipment(0).recordHex, 'hex').readUInt16LE(6)).toBe(0x8000 | 101)
    service.dispose()
  })
})

function guDocument() {
  const source = Buffer.alloc(5_159_064)
  source.writeUInt32LE(0xc6, 0)
  source[4] = 1
  source.writeUInt32LE(0x1c, 8)
  const bases = [0x18cc78, 0x2ac53c, 0x3cbe00]
  bases.forEach((base, slot) => source.writeUInt32LE(base, 0x10 + slot * 4))
  source.write('Hunter', bases[0] + 0x23b7d, 'utf8')
  return source
}
