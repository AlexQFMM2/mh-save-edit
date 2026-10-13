import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Synthetic ESM fixture.
import { createLoadoutCatalog } from './fixtures/p2gLoadoutCatalog.mjs'
import { P2gLoadoutCatalogRepository } from '../api/loadout/p2gRepository'
import { createEmptyLogicalLoadout } from '../api/loadout/types'
import { logicalLoadoutSchema } from '../api/loadout/schemas'
import { loadoutChannels } from '../api/loadout/channels'
const handlers = vi.hoisted(() => new Map<string, (event: unknown, payload: unknown) => any>())
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] }, ipcMain: { handle: (key: string, fn: any) => handlers.set(key, fn), removeHandler: (key: string) => handlers.delete(key) } }))
import { registerLoadoutIpc } from '../api/loadout/ipc'
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); handlers.clear() })
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'p2g-loadout-repository-'))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  const data = createLoadoutCatalog(dir)
  const db = new Database(join(data, 'mhp2g.sqlite'))
  cleanups.push(() => db.close())
  return { dir, data, db, repository: new P2gLoadoutCatalogRepository(db) }
}
describe('native P2G loadout repository and production IPC', () => {
  it('collects all pages, keeps signed points, native identities and bilingual queries without charm tables', () => {
    const { db, repository } = setup()
    const snapshot = repository.getSnapshot()
    expect(snapshot.weapons).toHaveLength(10)
    expect(snapshot.armors).toHaveLength(104)
    expect(snapshot.decorations).toHaveLength(2)
    expect(snapshot.charmClasses).toEqual([])
    expect(snapshot.charmRanges).toEqual([])
    expect(snapshot.relicLookups).toEqual([])
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%charm%'").all()).toEqual([])
    expect(repository.searchArmors({ gameId: 'mhp2g', query: 'テスト頭102', part: 'head' }).items[0]).toMatchObject({ armorKey: 'armor_head:102', dexId: null, saveId: null, skills: [{ points: -1 }] })
    expect(repository.searchWeapons({ gameId: 'mhp2g', query: 'テスト武器ranged4' }).items[0]).toMatchObject({ weaponKey: 'weapon_ranged:4', saveId: null, saveType: null })
    expect(repository.searchDecorations({ gameId: 'mhp2g', query: 'テスト珠乙' }).items[0]).toMatchObject({ gameId: 'mhp2g', itemId: 3 })
    expect(repository.getBootstrap().skills.some(s => s.activations.some(a => a.components?.length))).toBe(true)
    const loadout = createEmptyLogicalLoadout('mhp2g', snapshot.dataVersion)
    loadout.weapon = { ...snapshot.weapons[0], decorations: [snapshot.decorations[0]], lock: 'unlocked' }
    for (const a of snapshot.armors) { loadout.armor[a.part] = { ...a, decorations: [], lock: 'unlocked' }; expect(logicalLoadoutSchema.safeParse(loadout).success).toBe(true) }
    const oldVersion = snapshot.dataVersion
    db.prepare("UPDATE catalog_build_metadata SET builder_sha256='synthetic-new-version' WHERE game_id='mhp2g'").run()
    expect(new P2gLoadoutCatalogRepository(db).getBootstrap().dataVersion).not.toBe(oldVersion)
    expect(() => repository.searchWeapons({ gameId: 'mhp2g', saveId: 1 })).toThrow(/原生/)
    expect(() => repository.searchArmors({ gameId: 'mhp2g', part: 'head', sourceKind: 'relicTemplate' })).toThrow(/原生/)
    expect(() => repository.searchDecorations({ gameId: 'mhgu' })).toThrow(/版本/)
  })
  it('dispatches native bootstrap, rehydrates imported stats, persists game history filters, and rejects invalid requests', () => {
    const { dir, data } = setup()
    cleanups.push(registerLoadoutIpc(data, dir))
    const call = (channel: string, input: unknown) => handlers.get(channel)!(null, input)
    const snapshot = call(loadoutChannels.getSnapshot, 'mhp2g')
    expect(call(loadoutChannels.getFacets, 'mhp2g').charmClasses).toEqual([])
    const loadout = createEmptyLogicalLoadout('mhp2g', 'stale')
    loadout.weapon = { ...snapshot.weapons[0], defense: 99999, decorations: [snapshot.decorations[0]], lock: 'equipment' }
    const hydrated = call(loadoutChannels.reconcileLoadout, loadout)
    expect(hydrated.weapon.defense).toBe(snapshot.weapons[0].defense)
    expect(hydrated.dataVersion).toBe(snapshot.dataVersion)
    expect(loadout.weapon!.defense).toBe(99999)
    expect(call(loadoutChannels.listAutoJobs, { gameId: 'mhp2g' })).toEqual([])
    expect(() => call(loadoutChannels.searchWeapons, { gameId: 'mhp2g', saveId: 1 })).toThrow()
    expect(() => call(loadoutChannels.reconcileLoadout, { ...loadout, weapon: { ...loadout.weapon, saveId: 1 } })).toThrow()
    const target = snapshot.skills.flatMap((s: any) => s.activations).find((a: any) => a.direction === 'negative')
    expect(() => call(loadoutChannels.startAuto, { requestId: 'invalid', gameId: 'mhp2g', dataVersion: snapshot.dataVersion, baseLoadout: hydrated, targets: [{ activationKey: target.activationKey, skillId: snapshot.skills.find((s: any) => s.activations.includes(target)).skillId, nameCn: target.nameCn, threshold: 10 }], timeoutMs: 1000, resultLimit: 1 })).toThrow(/目标不存在|不可用/)
  })
})
