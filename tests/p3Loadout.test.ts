import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { validateCharm } from '../api/loadout/charm'
import { P3LoadoutCatalogRepository } from '../api/loadout/p3Repository'
import { createEmptyLogicalLoadout, type LoadoutArmor, type LoadoutWeapon, type LogicalLoadout } from '../api/loadout/types'
import { Mhp3SaveAdapter, P3_LAYOUT as L } from '../api/save/adapters/mhp3'
import { pspProfileSchema } from '../api/save/p2g/profile'
import { PspSavedataCodec } from '../api/save/p2g/codec'
import { P3_PSP } from '../api/save/psp/format'
import type { P3SaveProfile } from '../api/save/p3/profile'
import { SaveSessionService } from '../api/save/sessionService'
import type { SaveBoxSection, SaveEquipmentCell } from '../api/save/types'
import { syntheticP2gProfileDocument, syntheticPspSfo } from './fixtures/p2gSave'
import { p3LoadoutFixture } from './fixtures/p3LoadoutCatalog'

const roots: string[] = []
const services: SaveSessionService[] = []
afterEach(() => {
  for (const service of services.splice(0)) service.dispose()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const { rankGates: _, ...keys } = syntheticP2gProfileDocument
const profileDocument = { ...keys, gameId: 'mhp3', armorCaps: { 'mhp3:armor:4:1': 10 } }
const profile: P3SaveProfile = { ...pspProfileSchema.parse(keys), gameId: 'mhp3', armorCaps: { 'mhp3:armor:4:1': 10 } }
const request = { contentGameId: 'mhp3', formatId: P3_PSP.formatId } as const

function mkRoot() { const root = mkdtempSync(join(tmpdir(), 'mhp3-loadout-test-')); roots.push(root); return root }

function syntheticSave() {
  const payload = Buffer.alloc(P3_PSP.payloadSize)
  const base = L.start
  payload.write('Synthetic', base, 'utf16le')
  payload[base + L.occupied] = 1
  payload[base + L.obtained] = 0xc0
  payload.fill(255, base + L.refs, base + L.refs + 14)
  for (let n = 0; n < L.presetCount; n++) payload.fill(255, base + L.presets + n * L.presetSize + 2, base + L.presets + n * L.presetSize + 16)
  const codec = new PspSavedataCodec(profile, P3_PSP)
  const bin = codec.encode(payload, 42, Buffer.alloc(16, 0x21))
  return { bin, sfo: syntheticPspSfo(codec, bin) }
}

function repository(): P3LoadoutCatalogRepository {
  const db = p3LoadoutFixture()
  return new P3LoadoutCatalogRepository(db)
}

describe('P3 loadout repository and calculation', () => {
  test('exposes native candidates, charm classes and confirmed charm legality', () => {
    const repo = repository()
    const bootstrap = repo.getBootstrap()
    expect(bootstrap.dataVersion).toMatch(/^[0-9a-f]{16}$/)
    expect(bootstrap.skills.map(skill => skill.skillId)).toEqual([1, 2, 3])
    expect(bootstrap.charmClasses).toHaveLength(7)
    expect(bootstrap.charmRanges.length).toBeGreaterThan(0)
    const snapshot = repo.getSnapshot()
    expect(snapshot.weapons.length).toBeGreaterThan(0)
    expect(snapshot.armors.length).toBe(4)
    expect(snapshot.weapons[0]).toMatchObject({ gameId: 'mhp3', sourceKind: 'catalog' })
    expect((snapshot.weapons[0] as LoadoutWeapon & { weaponKey: string }).weaponKey).toMatch(/^mhp3:weapon:\d+:\d+$/)
    expect((snapshot.armors[0] as LoadoutArmor & { armorKey: string }).armorKey).toBe('mhp3:armor:4:1')
    expect(repo.getFacets().charmClasses).toHaveLength(7)
    expect(repo.searchWeapons({ gameId: 'mhp3', query: '合成', pageSize: 5 }).items.length).toBeGreaterThan(0)
    expect(() => repo.searchWeapons({ gameId: 'mhp2g' })).toThrow(/原生图鉴身份/)
    expect(() => repo.searchArmors({ gameId: 'mhp3', part: 'head', saveId: 3 })).toThrow(/原生图鉴身份/)
    const natural = { kind: 'charm' as const, gameId: 'mhp3' as const, classId: 0, classNameCn: '兵士护石', slots: 2,
      skill1: { skillId: 3, points: 2, nameCn: '测试技能' }, skill2: null, decorations: [], legality: 'unknown' as const, encoding: 'encodable' as const, issues: [] }
    expect(validateCharm(snapshot, natural).legality).toBe('confirmed')
    expect(validateCharm(snapshot, { ...natural, skill1: { skillId: 3, points: 9, nameCn: '测试技能' } }).legality).toBe('invalid')
  })

  test('calculates skills with native torso-copy and charm contribution', () => {
    const repo = repository(), snapshot = repo.getSnapshot()
    const loadout: LogicalLoadout = createEmptyLogicalLoadout('mhp3', snapshot.dataVersion)
    loadout.weapon = { ...snapshot.weapons[0], decorations: [], lock: 'unlocked' }
    loadout.armor.head = { ...snapshot.armors[0], decorations: [], lock: 'unlocked' }
    loadout.charm = { kind: 'charm', gameId: 'mhp3', classId: 0, classNameCn: '兵士护石', slots: 2,
      skill1: { skillId: 3, points: 2, nameCn: '测试技能' }, skill2: null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' }
    const result = calculateLoadout(snapshot, loadout)
    expect(result.encoding).toBe('encodable')
    expect(result.slots.map(slot => slot.slot)).toContain('charm')
    expect(result.skills.find(skill => skill.skillId === 3)?.total).toBe(5)
    expect(result.defense).toBeGreaterThan(0)
  })
})

describe('P3 loadout save write', () => {
  test('previews and writes the whole loadout into empty equipment slots', () => {
    const root = mkRoot(), dir = join(root, 'source'), data = syntheticSave()
    mkdirSync(dir)
    const path = join(dir, P3_PSP.bin)
    writeFileSync(path, data.bin)
    writeFileSync(join(dir, 'PARAM.SFO'), data.sfo)
    writeFileSync(join(root, 'mhp3-save-profile.json'), JSON.stringify(profileDocument))
    const db = p3LoadoutFixture(join(root, 'mhp3.sqlite'))
    const repo = new P3LoadoutCatalogRepository(db)
    const snapshot = repo.getSnapshot()
    const loadout: LogicalLoadout = createEmptyLogicalLoadout('mhp3', snapshot.dataVersion)
    loadout.weapon = { ...snapshot.weapons[0], decorations: [], lock: 'unlocked' }
    loadout.armor.head = { ...snapshot.armors[0], decorations: [], lock: 'unlocked' }
    loadout.charm = { kind: 'charm', gameId: 'mhp3', classId: 0, classNameCn: '兵士护石', slots: 2,
      skill1: { skillId: 3, points: 2, nameCn: '测试技能' }, skill2: null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' }
    const service = new SaveSessionService(root); services.push(service)
    const opened = service.openPath(path, request)
    const selected = service.selectCharacter(opened.session!.sessionId, 0, opened.session!.revision)
    const identity = () => ({ sessionId: selected.sessionId, revision: selected.revision })
    const preview = service.previewLoadoutWrite({ ...identity(), loadout })
    expect(preview.requiredSlots).toBe(3)
    expect(preview.targets.map(target => target.loadoutSlot)).toEqual(['weapon', 'head', 'charm'])
    const mutation = service.addLoadout({ ...identity(), loadout })
    const after = { sessionId: mutation.session.sessionId, revision: mutation.session.revision }
    const cells = (service.getSection({ ...after, section: 'equipment-box' }) as SaveBoxSection).cells as SaveEquipmentCell[]
    expect(cells[0]).toMatchObject({ kind: 'weapon' })
    expect(cells[1]).toMatchObject({ kind: 'armor', saveType: 4 })
    expect(cells[2]).toMatchObject({ kind: 'charm', charmGrade: 0, slots: 2 })
    expect(cells[2].recordHex).toHaveLength(24)
    expect(mutation.message).toContain('整套配装')
    db.close()
  })
})
