import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, test } from 'vitest'
// @ts-expect-error Synthetic catalog fixture.
import { createLoadoutCatalog } from './fixtures/p2gLoadoutCatalog.mjs'
import { syntheticP2gProfile, syntheticP2gProfileDocument, syntheticP2gSave } from './fixtures/p2gSave'
import { Mhp2gSaveAdapter, P2G_LAYOUT as L } from '../api/save/adapters/mhp2g'
import { SaveSessionService } from '../api/save/sessionService'
import { P2gLoadoutCatalogRepository } from '../api/loadout/p2gRepository'
import { createEmptyLogicalLoadout } from '../api/loadout/types'
import type { SaveBoxSection, SaveCommandDraft, SaveEquipmentCell } from '../api/save/types'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()) })
function setup(twoCharacters = false) {
  const root = mkdtempSync(join(tmpdir(), 'p2g-session-test-')); cleanups.push(() => rmSync(root, { recursive: true, force: true }))
  const data = createLoadoutCatalog(root)
  writeFileSync(join(data, 'mhp2g-save-profile.json'), JSON.stringify(syntheticP2gProfileDocument))
  const dir = join(root, 'source'); mkdirSync(dir)
  const f = syntheticP2gSave(), path = join(dir, 'MHP2NDG.BIN')
  if (twoCharacters) {
    const adapter = new Mhp2gSaveAdapter(f.bin, f.sfo, syntheticP2gProfile)
    adapter.payload.copy(adapter.payload, L.start + L.stride, L.start, L.start + L.stride)
    const pair = adapter.serializePair()
    f.bin = pair.bin; f.sfo = pair.sfo
  }
  writeFileSync(path, f.bin); writeFileSync(join(dir, 'PARAM.SFO'), f.sfo)
  const service = new SaveSessionService(data); cleanups.push(() => service.dispose())
  let session = service.openPath(path, { contentGameId: 'mhp2g', formatId: 'mhp2g-psp-ppsspp' }).session!
  session = service.selectCharacter(session.sessionId, 0, session.revision)
  const identity = () => ({ sessionId: session.sessionId, revision: session.revision })
  const apply = (command: SaveCommandDraft) => { session = service.apply({ ...command, ...identity() }).session }
  const box = () => service.getSection({ ...identity(), section: 'equipment-box' }) as SaveBoxSection
  const cell = (slot: number) => box().cells.find(c => c.slot === slot) as SaveEquipmentCell
  return { root, data, f, path, service, identity, apply, cell, snapshot: () => session, setSession: (s: typeof session) => { session = s } }
}
describe('P2G shared save session', () => {
  test('switching characters clears history so redo cannot edit a hidden character', () => {
    const t = setup(true)
    t.apply({ kind: 'set-personal-field', field: 'zenny', value: 1234 })
    expect(() => t.service.selectCharacter(t.identity().sessionId, 1, t.identity().revision)).toThrow(/未保存/)
    t.setSession(t.service.undo(t.identity().sessionId, t.identity().revision).session)
    expect(t.snapshot().redoCount).toBe(1)
    // Selecting the current character does not discard its history.
    t.setSession(t.service.selectCharacter(t.identity().sessionId, 0, t.identity().revision))
    expect(t.snapshot().redoCount).toBe(1)
    t.setSession(t.service.selectCharacter(t.identity().sessionId, 1, t.identity().revision))
    expect(t.snapshot()).toMatchObject({ dirty: false, undoCount: 0, redoCount: 0 })
    expect(() => t.service.redo(t.identity().sessionId, t.identity().revision)).toThrow(/没有可重做/)
    t.setSession(t.service.selectCharacter(t.identity().sessionId, 0, t.identity().revision))
    const personal = t.service.getSection({ ...t.identity(), section: 'personal-info' })
    expect(personal.kind === 'personal-info' && personal.fields.find(field => field.key === 'zenny')?.value).toBe(0)
  })
  test('one edit synchronizes worn gear, preserves high bits and other characters, and undoes as one command', () => {
    const t = setup()
    t.apply({ kind: 'set-equipment-fields', domain: 'hunter-equipment', slot: 0, changes: { level: 8 } })
    expect(t.cell(0).upgradeWord).toBe(0x8108)
    expect(t.snapshot().undoCount).toBe(1)
    t.setSession(t.service.undo(t.identity().sessionId, t.identity().revision).session)
    expect(t.cell(0).upgradeWord).toBe(0x8103); expect(t.snapshot().dirty).toBe(false)
    t.setSession(t.service.redo(t.identity().sessionId, t.identity().revision).session)
    const destination = join(t.root, 'copy', 'MHP2NDG.BIN')
    t.service.save(t.identity().sessionId, t.identity().revision, destination)
    const reopened = new Mhp2gSaveAdapter(readFileSync(destination), readFileSync(join(t.root, 'copy/PARAM.SFO')), syntheticP2gProfile)
    const expected = Buffer.from(t.f.payload)
    expected[L.start + L.box + 4] = 8; expected[L.start + L.gear + 12 + 4] = 8
    expect(reopened.payload.equals(expected)).toBe(true)
    expect(readFileSync(t.path).equals(t.f.bin)).toBe(true)
  })
  test('native identities and bowgun flags; bows cannot use the gun upgrade field', () => {
    const t = setup()
    const result = t.service.addCatalogEquipment({ ...t.identity(), gameId: 'mhp2g', domain: 'hunter-equipment', saveType: 6, saveId: 1 }); t.setSession(result.session)
    expect(t.cell(1).upgrade?.naturalMaximum).toBe(4)
    const gun = Buffer.from(t.cell(1).recordHex, 'hex'); gun.writeUInt16LE(0xa524, 4)
    t.apply({ kind: 'set-equipment-record', domain: 'hunter-equipment', slot: 1, recordHex: gun.toString('hex') })
    t.apply({ kind: 'set-equipment-fields', domain: 'hunter-equipment', slot: 1, changes: { level: 3, decorations: [2, 3] } })
    expect(t.cell(1).upgradeWord).toBe(0xa523); expect(t.cell(1).decorations).toEqual([2, 3, 0])
    t.setSession(t.service.addCatalogEquipment({ ...t.identity(), gameId: 'mhp2g', domain: 'hunter-equipment', saveType: 6, saveId: 2 }).session)
    expect(t.cell(2).upgrade).toBeUndefined()
    expect(() => t.apply({ kind: 'set-equipment-fields', domain: 'hunter-equipment', slot: 2, changes: { level: 3 } })).toThrow(/弓/)
    expect(() => t.apply({ kind: 'clear-box-slot', domain: 'hunter-equipment', slot: 0 })).toThrow(/穿戴/)
    expect(() => t.apply({ kind: 'set-equipment-fields', domain: 'hunter-equipment', slot: 0, changes: { reset: true, saveType: 5, saveId: 1 } })).toThrow(/穿戴/)
    expect(t.cell(0).recordHex).toBe(t.f.payload.subarray(L.start + L.box, L.start + L.box + 12).toString('hex'))
  })
  test('full and CSV transfer retain all twelve bytes; rejected imports roll back every earlier write', () => {
    const t = setup(), record = Buffer.from([1, 8, 221, 0, 255, 129, 0, 0, 1, 0, 0, 0])
    t.apply({ kind: 'set-equipment-record', domain: 'hunter-equipment', slot: 9, recordHex: record.toString('hex') })
    for (const format of ['full', 'csv'] as const) {
      const file = join(t.root, `box.${format}`), request = { ...t.identity(), domain: 'hunter-equipment' as const, format }
      t.service.exportBox(request, file)
      const preview = t.service.previewImport(request, file)
      expect(preview.invalid).toBe(0)
      t.setSession(t.service.applyImport({ ...t.identity(), token: preview.token, replaceAll: true }).session)
      expect(t.cell(9).recordHex).toBe(record.toString('hex'))
    }
    t.apply({ kind: 'swap-box-slots', domain: 'hunter-equipment', sourceSlot: 0, targetSlot: 4 })
    const bad = join(t.root, 'reject.csv')
    writeFileSync(bad, `MHP2G_TRANSFER,1,EQUIPMENT_BOX\nslot,record_hex\n0,${record.toString('hex')}\n4,${'00'.repeat(12)}\n`)
    const preview = t.service.previewImport({ ...t.identity(), domain: 'hunter-equipment', format: 'csv' }, bad)
    expect(() => t.service.applyImport({ ...t.identity(), token: preview.token })).toThrow(/穿戴/)
    expect(t.cell(9).recordHex).toBe(record.toString('hex'))
    expect(t.cell(0).empty).toBe(true); expect(t.cell(4).equipped).toBe(true)
    expect(t.snapshot().undoCount).toBe(2)
  })
  test('shared catalog item and logical loadout writes use native IDs with one undo', () => {
    const t = setup(), db = new Database(join(t.data, 'mhp2g.sqlite'), { readonly: true })
    const catalog = new P2gLoadoutCatalogRepository(db).getSnapshot(); db.close()
    t.setSession(t.service.addCatalogItem({ ...t.identity(), gameId: 'mhp2g', saveId: 2, count: 99 }).session)
    const items = t.service.getSection({ ...t.identity(), section: 'item-box' }) as SaveBoxSection
    expect(items.cells[0]).toMatchObject({ itemId: 2, count: 99, empty: false })
    const loadout = createEmptyLogicalLoadout('mhp2g', catalog.dataVersion)
    loadout.weapon = { ...catalog.weapons[0], decorations: [catalog.decorations[0]], lock: 'unlocked' }
    const armor = catalog.armors[0]; loadout.armor[armor.part] = { ...armor, decorations: [], lock: 'unlocked' }
    const preview = t.service.previewLoadoutWrite({ ...t.identity(), loadout }); expect(preview.requiredSlots).toBe(2)
    t.setSession(t.service.addLoadout({ ...t.identity(), loadout }).session)
    expect(t.cell(1).weaponKey).toBe(loadout.weapon.weaponKey); expect(t.cell(1).decorations[0]).toBe(catalog.decorations[0].itemId)
    expect(t.cell(2).armorKey).toBe(armor.armorKey)
    t.setSession(t.service.undo(t.identity().sessionId, t.identity().revision).session)
    expect(t.cell(1).empty).toBe(true); expect(t.cell(2).empty).toBe(true)
  })
})
