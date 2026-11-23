import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { Mhp3SaveAdapter, P3_LAYOUT as L } from '../api/save/adapters/mhp3'
import { PspSavedataCodec } from '../api/save/p2g/codec'
import { PspSavedataSfo } from '../api/save/p2g/sfo'
import { pspProfileSchema } from '../api/save/p2g/profile'
import { PspSaveFiles } from '../api/save/p2g/files'
import { P3_PSP } from '../api/save/psp/format'
import { readP3SaveProfile, type P3SaveProfile } from '../api/save/p3/profile'
import { readP3Charm } from '../api/save/p3/equipment'
import { SaveSessionService } from '../api/save/sessionService'
import type { SaveBoxSection, SaveCommandDraft, SaveEquipmentCell } from '../api/save/types'
import { syntheticP2gProfileDocument, syntheticPspSfo } from './fixtures/p2gSave'
import { p3WeaponFixture } from './fixtures/p3WeaponCatalog'

const roots: string[] = []
const services: SaveSessionService[] = []
afterEach(() => {
  for (const service of services.splice(0)) service.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const { rankGates: _, ...keys } = syntheticP2gProfileDocument
const levelCaps = { 'mhp3:armor:4:1': 10 }
const profileDocument = { ...keys, gameId: 'mhp3', armorCaps: levelCaps }
const profile: P3SaveProfile = { ...pspProfileSchema.parse(keys), gameId: 'mhp3', armorCaps: levelCaps }
const request = { contentGameId: 'mhp3', formatId: P3_PSP.formatId } as const

function mkRoot() {
  const root = mkdtempSync(join(tmpdir(), 'mhp3-save-test-'))
  roots.push(root)
  return root
}

function synthetic() {
  const payload = Buffer.alloc(P3_PSP.payloadSize)
  for (const slot of [0, 2]) {
    const base = L.start + slot * L.stride
    payload.write('Synthetic', base, 'utf16le')
    payload[base + L.occupied] = 1
    payload[base + L.obtained] = slot === 0 ? 0x80 : 0xc0
    payload.fill(255, base + L.refs, base + L.refs + 14)
    for (let n = 0; n < L.presetCount; n++) payload.fill(255, base + L.presets + n * L.presetSize + 2, base + L.presets + n * L.presetSize + 16)
  }
  payload.set([1, 4, 1, 0, 3, 0xa1, 0, 0, 0, 0, 0, 0], L.start + L.box)
  payload.set([1, 11, 1, 0, 0x20, 0xa2, 0, 0, 0, 0, 0, 0], L.start + L.box + 12)
  payload.set([1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], L.start + L.box + 24)
  payload.copy(payload, L.start + 0x80, L.start + L.box, L.start + L.box + 12)
  payload.writeUInt16LE(0, L.start + L.refs + 4)
  const preset = L.start + L.presets + 44 * L.presetSize
  payload[preset] = 44
  payload[preset + 39] = 0x97
  payload.writeUInt16LE(1, preset + 2)
  payload.writeUInt16LE(0, preset + 12)
  payload.writeUInt16LE(10, L.start + L.items)
  payload.writeInt16LE(-2, L.start + L.items + 2)
  payload.writeInt16LE(41, L.start + L.items + 6)
  payload[L.start + L.items + 999 * 4 + 1] = 0x4e
  const codec = new PspSavedataCodec(profile, P3_PSP)
  const bin = codec.encode(payload, 42, Buffer.alloc(16, 0x21))
  return { payload, bin, sfo: syntheticPspSfo(codec, bin), preset }
}

function serviceFor(root: string, path: string, slot = 0) {
  const service = new SaveSessionService(root)
  services.push(service)
  const opened = service.openPath(path, request)
  let state = service.selectCharacter(opened.session!.sessionId, slot, opened.session!.revision)
  const identity = () => ({ sessionId: state.sessionId, revision: state.revision })
  const apply = (command: SaveCommandDraft) => { state = service.apply({ ...identity(), ...command }).session }
  const update = (value: typeof state) => { state = value }
  return { service, opened, identity, apply, update, state: () => state }
}

describe('P3 save format', () => {
  test('exact paired round trip, type-zero occupied armor, all three slots and book flags', () => {
    const f = synthetic(), adapter = new Mhp3SaveAdapter(f.bin, f.sfo, profile)
    expect(adapter.characters().map(character => character.used)).toEqual([true, false, true])
    expect(() => adapter.selectCharacter(1)).toThrow(/空角色/)
    adapter.selectCharacter(0)
    expect(adapter.meta.itemCapacity).toBe(900)
    expect(adapter.equipment(2)).toMatchObject({ empty: false, kind: 'armor', saveType: 0 })
    expect(() => adapter.item(900)).toThrow(/超出/)
    expect(adapter.validate()).toEqual([])
    expect(adapter.serializePair()).toEqual({ bin: f.bin, sfo: f.sfo })
    const corrupt = Buffer.from(f.bin); corrupt[100] ^= 1
    expect(() => new Mhp3SaveAdapter(corrupt, f.sfo, profile)).toThrow(/校验/)
    adapter.selectCharacter(2)
    expect(adapter.meta.itemCapacity).toBe(1000)
  })

  test('typed edits, packed charm, 45th preset, wearing, undo and cross-format transfer', () => {
    const root = mkRoot(), dir = join(root, 'source'), data = synthetic()
    mkdirSync(dir)
    const path = join(dir, P3_PSP.bin)
    writeFileSync(path, data.bin)
    writeFileSync(join(dir, 'PARAM.SFO'), data.sfo)
    writeFileSync(join(dir, 'ICON0.PNG'), 'synthetic icon')
    writeFileSync(join(root, 'mhp3-save-profile.json'), JSON.stringify(profileDocument))
    p3WeaponFixture(join(root, 'mhp3.sqlite')).close()
    const t = serviceFor(root, path)
    const equipment = () => t.service.getSection({ ...t.identity(), section: 'equipment-box' }) as SaveBoxSection
    const cell = (at: number) => equipment().cells[at] as SaveEquipmentCell
    expect(() => t.apply({ kind: 'set-p3-equipment', slot: 0, changes: { selection: { kind: 'weapon', key: 'mhp3:weapon:5:1' } } })).toThrow(/穿戴/)
    expect(() => t.apply({ kind: 'set-p3-equipment', slot: 3, changes: { selection: { kind: 'armor', key: 'armor_head:1' } } })).toThrow(/身份/)
    expect(t.state().dirty).toBe(false)
    t.apply({ kind: 'set-p3-equipment', slot: 0, changes: { level: 8, decorations: [825] } })
    expect(cell(0)).toMatchObject({ equipped: true, level: 8, saveType: 4, decorations: [825, 0, 0] })
    t.update(t.service.undo(t.identity().sessionId, t.identity().revision).session)
    expect(t.state().dirty).toBe(false)
    t.update(t.service.redo(t.identity().sessionId, t.identity().revision).session)
    t.apply({ kind: 'set-p3-equipment', slot: 1, changes: { level: 1 } })
    expect(cell(1).recordHex.slice(8, 12)).toBe('21a2')
    t.apply({ kind: 'set-p3-equipment', slot: 3, changes: { selection: { kind: 'charm' },
      charm: { grade: 4, slots: 2, skill1Id: 3, skill1Points: 7, skill2Id: 2, skill2Points: -8 }, decorations: [826] } })
    expect(cell(3)).toMatchObject({ kind: 'charm', charmGrade: 4, slots: 2, skill2Points: -8 })
    expect(readP3Charm(Buffer.from(cell(3).recordHex, 'hex')).skill1Points).toBe(7)
    t.apply({ kind: 'swap-box-slots', domain: 'hunter-equipment', sourceSlot: 3, targetSlot: 100 })
    expect(t.service.getSection({ ...t.identity(), section: 'equipment-box', query: '女王护石' })).toMatchObject({ page: 1, matchingSlots: [100] })
    t.apply({ kind: 'swap-box-slots', domain: 'hunter-equipment', sourceSlot: 0, targetSlot: 4 })
    expect(cell(4).equipped).toBe(true)
    t.apply({ kind: 'clear-box-slot', domain: 'hunter-equipment', slot: 1 })
    for (const [domain, format] of [['items', 'full'], ['items', 'csv'], ['hunter-equipment', 'full'], ['hunter-equipment', 'csv']] as const) {
      const destination = join(root, `${domain}.${format}`)
      t.service.exportBox({ ...t.identity(), domain, format }, destination)
      const draft = t.service.previewImport({ ...t.identity(), domain, format }, destination)
      expect(draft.invalid).toBe(0)
      const before = t.state().undoCount
      t.update(t.service.applyImport({ ...t.identity(), token: draft.token, replaceAll: true }).session)
      expect(t.state().undoCount).toBe(before)
    }
    const bad = join(root, 'wrong.csv')
    writeFileSync(bad, 'MHP2G_TRANSFER,1,ITEM_BOX\npage,slot,item_id,count\n1,1,10,3\n')
    expect(() => t.service.previewImport({ ...t.identity(), domain: 'items', format: 'csv' }, bad)).toThrow(/不匹配/)
    const destination = join(root, 'copy', P3_PSP.bin)
    t.update(t.service.save(t.identity().sessionId, t.identity().revision, destination).session)
    const output = new Mhp3SaveAdapter(readFileSync(destination), readFileSync(join(dirname(destination), 'PARAM.SFO')), profile)
    expect(output.payload.readUInt16LE(L.start + L.refs + 4)).toBe(4)
    expect(output.payload.subarray(L.start + 0x80, L.start + 0x8c)).toEqual(Buffer.from(cell(4).recordHex, 'hex'))
    expect(output.payload[data.preset]).toBe(44)
    expect(output.payload.subarray(data.preset + 2, data.preset + 16)).toEqual(Buffer.alloc(14, 255))
    expect(output.payload[data.preset + 39]).toBe(0)
    expect(output.payload.subarray(L.start + L.items, L.start + L.items + 4000)).toEqual(data.payload.subarray(L.start + L.items, L.start + L.items + 4000))
    expect(output.payload.subarray(L.start + L.stride)).toEqual(data.payload.subarray(L.start + L.stride))
    expect(readFileSync(path)).toEqual(data.bin)
    expect(readFileSync(join(dirname(destination), 'ICON0.PNG'), 'utf8')).toBe('synthetic icon')
  })

  test('P3 paired rollback and externally changed SFO use the P3 journal', () => {
    const root = mkRoot(), path = join(root, P3_PSP.bin)
    const old = { bin: Buffer.from('original bin'), sfo: Buffer.from('original sfo') }
    const next = { bin: Buffer.from('new bin'), sfo: Buffer.from('new sfo') }
    writeFileSync(path, old.bin)
    const sfo = join(root, 'PARAM.SFO')
    writeFileSync(sfo, old.sfo)
    const files = new PspSaveFiles(path, P3_PSP)
    expect(() => files.save(next, () => {}, undefined, () => { throw new Error('synthetic failure') })).toThrow(/synthetic failure/)
    expect([readFileSync(path), readFileSync(sfo)]).toEqual([old.bin, old.sfo])
    writeFileSync(sfo, 'external')
    expect(() => files.save(next, () => {})).toThrow(/外部修改/)
    expect(readFileSync(path)).toEqual(old.bin)
  })
})

test.skipIf(!process.env.P3_SAVE_SAMPLE)('private P3 sample round trips and reopens as a complete application-written copy', () => {
  const sample = process.env.P3_SAVE_SAMPLE!
  const dataDir = process.env.P3_SAVE_DATA ?? 'data'
  const root = mkRoot(), source = join(root, P3_PSP.directory)
  cpSync(sample, source, { recursive: true, errorOnExist: true, force: false })
  const path = join(source, P3_PSP.bin)
  const sfoPath = join(source, 'PARAM.SFO')
  const bin = readFileSync(path), sfo = readFileSync(sfoPath)
  const profile = readP3SaveProfile(dataDir)
  const original = new Mhp3SaveAdapter(bin, sfo, profile)
  expect(original.serializePair()).toEqual({ bin, sfo })
  expect(original.validate()).toEqual([])
  const t = serviceFor(dataDir, path, 2)
  const box = t.service.getSection({ ...t.identity(), section: 'equipment-box' }) as SaveBoxSection
  const equipped = (box.cells as SaveEquipmentCell[]).find(cell => cell.equipped && cell.kind === 'armor' && cell.saveType === 4)!
  const weapon = (box.cells as SaveEquipmentCell[]).find(cell => cell.equipped && cell.kind === 'weapon')!
  const empty = box.cells.find(cell => cell.empty)!
  const level = equipped.level > 0 ? equipped.level - 1 : Math.min(1, equipped.upgrade!.naturalMaximum)
  const charm = { grade: 1, skill1Id: 17, skill1Points: 10, skill2Id: 0, skill2Points: 0, slots: 0 }
  t.apply({ kind: 'set-personal-field', field: 'zenny', value: 1234567 })
  t.apply({ kind: 'set-item', slot: 0, itemId: 8, count: 17 })
  t.apply({ kind: 'set-p3-equipment', slot: equipped.slot, changes: { level } })
  t.apply({ kind: 'set-p3-equipment', slot: weapon.slot, changes: { level: 1 - weapon.level } })
  t.apply({ kind: 'set-p3-equipment', slot: empty.slot, changes: { selection: { kind: 'charm' }, charm } })
  const decorated = (box.cells as SaveEquipmentCell[]).find(cell => cell.equipped && cell.kind === 'armor' && !!cell.slots)!
  t.apply({ kind: 'set-p3-equipment', slot: decorated.slot, changes: { decorations: [815] } })
  const newSlot = 99
  t.apply({ kind: 'swap-box-slots', domain: 'hunter-equipment', sourceSlot: weapon.slot, targetSlot: newSlot })
  const destination = join(root, 'preview', P3_PSP.directory, P3_PSP.bin)
  mkdirSync(dirname(dirname(destination)))
  t.service.save(t.identity().sessionId, t.identity().revision, destination)
  const reopened = new Mhp3SaveAdapter(readFileSync(destination), readFileSync(join(dirname(destination), 'PARAM.SFO')), profile)
  reopened.selectCharacter(2)
  expect(reopened.validate()).toEqual([])
  expect(reopened.item(0)).toMatchObject({ itemId: 8, count: 17 })
  expect(reopened.equipment(equipped.slot).level).toBe(level)
  expect(reopened.equipment(decorated.slot).decorations).toEqual([815, 0, 0])
  expect(reopened.equipment(newSlot)).toMatchObject({ equipped: true, level: 1 - weapon.level })
  expect(reopened.equipment(empty.slot)).toMatchObject({ charmGrade: 1, skill1Id: 17, skill1Points: 10, slots: 0 })
  expect(reopened.payload.readUInt32LE(L.start + L.stride * 2 + L.zenny)).toBe(1234567)
  expect(reopened.payload.subarray(0, L.start + L.stride * 2)).toEqual(original.payload.subarray(0, L.start + L.stride * 2))
  expect(readFileSync(join(sample, P3_PSP.bin))).toEqual(bin)
  expect(readFileSync(join(sample, 'PARAM.SFO'))).toEqual(sfo)
  if (process.env.P3_SAVE_PREVIEW) {
    const target = process.env.P3_SAVE_PREVIEW
    mkdirSync(target)
    cpSync(dirname(destination), join(target, P3_PSP.directory), { recursive: true, errorOnExist: true, force: false })
    writeFileSync(join(target, 'changes.json'), JSON.stringify({ character: 3, zenny: 1234567,
      item: { slot: 1, itemId: 8, count: 17 }, armor: { slot: equipped.slot + 1, level },
      weapon: { slot: newSlot + 1, previousSlot: weapon.slot + 1, boosted: !weapon.level },
      decoration: { equipmentSlot: decorated.slot + 1, itemId: 815 },
      charm: { slot: empty.slot + 1, ...charm } }, null, 2) + '\n')
  }
}, 30000)
