// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoadoutCatalogRepository } from '../api/loadout/repository'
import { loadoutArmorFiltersSchema, loadoutWeaponFiltersSchema } from '../api/loadout/schemas'
import { Mh4gSaveAdapter, encryptMh4g } from '../api/save/adapters/mh4g'
import { SaveSessionService } from '../api/save/sessionService'
import type { SaveEquipmentCell } from '../api/save/types'
import { SaveEquipmentEditorDrawer } from '../ui/components/SaveEquipmentEditorDrawer/SaveEquipmentEditorDrawer'
import { SaveEquipmentEmbeddedDetail } from '../ui/components/SaveEquipmentEmbeddedDetail/SaveEquipmentEmbeddedDetail'
import { createRelicSaveCatalog, syntheticRelicRecord } from './fixtures/relicSaveCatalog'

const disposers: (() => void)[] = []
afterEach(() => { cleanup(); for (const dispose of disposers.splice(0)) dispose() })

function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'mh4g-relic-ui-'))
  const db = createRelicSaveCatalog(join(directory, 'mh4g.sqlite'))
  const repo = new LoadoutCatalogRepository(db, 'mh4g')
  const plain = Buffer.alloc(81408); plain.writeUInt16LE(0x10, 0); plain.writeUInt16LE(0x1731, 2)
  const adapter = new Mh4gSaveAdapter(encryptMh4g(plain))
  adapter.setEquipment(19, syntheticRelicRecord())
  const path = join(directory, 'user1'); writeFileSync(path, adapter.serialize())
  const service = new SaveSessionService(directory)
  let session = service.openPath(path, { contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }).session!
  const cell = () => {
    const section = service.getSection({ sessionId: session.sessionId, revision: session.revision, section: 'equipment-box', page: 1 })
    if (section.kind !== 'equipment-box') throw new Error('Expected equipment section')
    return section.cells[19] as SaveEquipmentCell
  }
  const api = {
    getBootstrap: vi.fn().mockResolvedValue({ gameId: 'mh4g', dataVersion: 'synthetic', decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }),
    getFacets: vi.fn().mockResolvedValue({ skills: [], weaponTypes: [{ typeId: 10, nameCn: '盾斧' }], weaponRarities: [], armorRarities: [], charmClasses: [] }),
    getRelicLookups: vi.fn(async () => repo.getRelicLookups()),
    searchWeapons: vi.fn(async (request: unknown) => repo.searchWeapons(loadoutWeaponFiltersSchema.parse(request))),
    searchArmors: vi.fn(async (request: unknown) => repo.searchArmors(loadoutArmorFiltersSchema.parse(request))),
  }
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: api, catalog: { getWeapon: vi.fn().mockResolvedValue(null) } } })
  const applyRecord = vi.fn(async (recordHex: string) => {
    session = service.apply({ kind: 'set-equipment-record', sessionId: session.sessionId, revision: session.revision, domain: 'hunter-equipment', slot: 19, recordHex }).session
  })
  const saveAndReopen = () => {
    session = service.save(session.sessionId, session.revision).session!
    service.close(session.sessionId)
    session = service.openPath(path, { contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }).session!
  }
  disposers.push(() => { service.dispose(); db.close(); rmSync(directory, { recursive: true, force: true }) })
  return { api, repo, cell, applyRecord, saveAndReopen, path }
}

function openEditor(cell: SaveEquipmentCell, applyRecord: (record: string) => Promise<void>, close = vi.fn()) {
  return render(<SaveEquipmentEditorDrawer gameId="mh4g" domain="hunter-equipment" cell={cell} onApply={vi.fn()} onApplyRecord={applyRecord} onClose={close} />)
}

describe('MH4G relic save integration', () => {
  it('recognizes the numeric identity beyond page 1, edits the existing bytes and rehydrates after saving', async () => {
    const state = setup()
    expect(state.cell()).toMatchObject({ nameCn: '合成同名发掘武器', weaponKey: null, relic: { templateKey: 'w:20:10129', weaponTypeId: 10 }, slots: 3, diagnostics: [] })
    const view = openEditor({ ...state.cell(), nameCn: '任意显示名称，不参与识别' }, state.applyRecord)
    const attack = await screen.findByRole('button', { name: '攻击档' })
    expect(attack.textContent).toContain('321')
    expect(screen.getByRole('button', { name: '属性 / 异常值' }).textContent).toBe('120')
    expect(state.api.searchWeapons).toHaveBeenCalledWith(expect.objectContaining({ saveType: 20, saveId: 10129, sourceKind: 'relicTemplate' }))
    expect(state.api.searchWeapons.mock.calls[0][0]).not.toHaveProperty('query')
    expect(state.api.getRelicLookups).toHaveBeenCalledWith('mh4g')
    fireEvent.click(attack); fireEvent.click(screen.getByRole('option', { name: /攻击 345/ }))
    fireEvent.click(screen.getByRole('button', { name: '属性 / 异常值' })); fireEvent.click(screen.getByRole('option', { name: '160' }))
    const expected = syntheticRelicRecord(); expected[13] = 21; expected[4] = 4
    expect(state.applyRecord).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
    await waitFor(() => expect(state.applyRecord).toHaveBeenCalledWith(expected.toString('hex')))
    view.unmount(); state.saveAndReopen()
    expect(new Mh4gSaveAdapter(readFileSync(state.path)).equipment(19).recordHex.toLowerCase()).toBe(expected.toString('hex'))
    expect(state.cell().recordHex.toLowerCase()).toBe(expected.toString('hex'))
    const reopened = openEditor(state.cell(), state.applyRecord)
    expect((await screen.findByRole('button', { name: '攻击档' })).textContent).toContain('345')
    expect(screen.getByRole('button', { name: '属性 / 异常值' }).textContent).toBe('160')
    reopened.unmount()
    render(<SaveEquipmentEmbeddedDetail gameId="mh4g" cell={state.cell()} />)
    await screen.findByText(/攻击 345/)
    expect(screen.getByText('160')).toBeTruthy()
    expect(screen.getByText('合成固定珠')).toBeTruthy()
    expect(screen.queryByText(/没有可关联/)).toBeNull()
  })

  it('does not write on cancel, preserves draft edits across tabs, and keeps unknown values', async () => {
    const state = setup()
    const raw = syntheticRelicRecord(); raw[4] = 105
    await state.applyRecord(raw.toString('hex')); state.applyRecord.mockClear()
    const close = vi.fn()
    const view = openEditor(state.cell(), state.applyRecord, close)
    fireEvent.click(await screen.findByRole('button', { name: '攻击档' }))
    fireEvent.click(screen.getByRole('option', { name: /攻击 345/ }))
    expect(screen.getByRole('button', { name: '属性 / 异常值' }).textContent).toContain('原值 105')
    fireEvent.click(screen.getByRole('button', { name: '替换装备' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
    expect(screen.getByRole('button', { name: '攻击档' }).textContent).toContain('345')
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(state.applyRecord).not.toHaveBeenCalled()
    expect(state.cell().recordHex.toLowerCase()).toBe(raw.toString('hex'))
    view.unmount()
    openEditor(state.cell(), state.applyRecord)
    fireEvent.click(await screen.findByRole('button', { name: '攻击档' }))
    fireEvent.click(screen.getByRole('option', { name: /攻击 345/ }))
    fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
    raw[13] = 21
    await waitFor(() => expect(state.applyRecord).toHaveBeenCalledWith(raw.toString('hex')))
    state.saveAndReopen()
    expect(state.cell().recordHex.toLowerCase()).toBe(raw.toString('hex'))
  })

  it('blocks applying instance edits if the option lookup fails', async () => {
    const state = setup(); state.api.getRelicLookups.mockRejectedValue(new Error('合成读取失败'))
    openEditor(state.cell(), state.applyRecord)
    expect((screen.getByRole('button', { name: '应用字段修改' }) as HTMLButtonElement).disabled).toBe(true)
    expect((await screen.findByRole('alert')).textContent).toContain('合成读取失败')
    fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
    expect(state.applyRecord).not.toHaveBeenCalled()
  })

  it('keeps ordinary weapons and relic armor with the same save ID separate', async () => {
    const state = setup()
    expect(state.repo.searchWeapons(loadoutWeaponFiltersSchema.parse({ gameId: 'mh4g', saveType: 7, saveId: 10129 })).items).toMatchObject([{ sourceKind: 'catalog', nameCn: '合成普通武器' }])
    expect(state.repo.searchArmors(loadoutArmorFiltersSchema.parse({ gameId: 'mh4g', part: 'head', saveType: 5, saveId: 10129, sourceKind: 'relicTemplate' })).items).toMatchObject([{ kind: 'armor', templateKey: 'a:5:10129' }])
    const record = syntheticRelicRecord(); record[0] = 5
    await state.applyRecord(record.toString('hex'))
    expect(state.cell()).toMatchObject({ kind: 'armor', nameCn: '合成发掘头盔', typeNameCn: '头部', relic: { templateKey: 'a:5:10129', weaponTypeId: null }, slots: 3 })
    openEditor(state.cell(), state.applyRecord)
    await screen.findByRole('button', { name: '防御档' })
    expect(state.api.searchArmors).toHaveBeenCalledWith(expect.objectContaining({ saveType: 5, saveId: 10129, part: 'head' }))
  })
})
