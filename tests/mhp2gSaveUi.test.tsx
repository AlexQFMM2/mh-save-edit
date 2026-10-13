// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SaveEquipmentEditorDrawer } from '../ui/components/SaveEquipmentEditorDrawer/SaveEquipmentEditorDrawer'
import { SaveItemPickerDrawer } from '../ui/components/SaveItemPickerDrawer/SaveItemPickerDrawer'
import type { SaveEquipmentCell } from '../api/save/types'
import { nativeArmor, p2gLoadoutFixture } from './fixtures/p2gLoadout'

const fixture = p2gLoadoutFixture(), legs = nativeArmor('legs', 2)
const fields = vi.fn(async () => {}), record = vi.fn(async () => {}), close = vi.fn()
const cell: SaveEquipmentCell = { slot: 0, empty: false, kind: 'armor', saveType: 0, saveId: 1, level: 3, slots: 1, appearanceId: null, decorations: [1, 0, 0], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, nameCn: '合成腿甲', nameEn: '', typeNameCn: '腿部', iconPath: null, weaponKey: null, armorDexId: null, armorKey: 'armor_legs:1', palicoEquipmentId: null, decorationLabels: [], skill1NameCn: null, skill2NameCn: null, recordHex: '010001000381010000000000', diagnostics: [], upgrade: { label: '防具强化次数', maximum: 255, naturalMaximum: 10, value: 3 } }
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: {
    loadout: { getBootstrap: async () => fixture.snapshot, getFacets: async () => ({ skills: fixture.snapshot.skills, weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] }), searchArmors: async () => ({ items: [legs], total: 1, page: 1, pageSize: 100, hasNext: false }) },
    catalog: { getArmor: async () => null, searchItems: async () => ({ items: [1, 2].map(itemId => ({ gameId: 'mhp2g', itemId, nameCn: `合成道具${itemId}`, nameEn: '', iconPath: null, maxStack: 99, rarity: 1 })) }) },
  } })
})
afterEach(cleanup)
const editor = () => <SaveEquipmentEditorDrawer gameId="mhp2g" domain="hunter-equipment" cell={cell} onApply={fields} onApplyRecord={record} onClose={close} />
describe('P2G reuses shared save components', () => {
  test('shared equipment picker commits legs type zero only with the footer Apply', async () => {
    render(editor())
    const candidate = await screen.findByRole('button', { name: new RegExp(legs.nameCn) })
    fireEvent.click(candidate); fireEvent.keyDown(candidate, { key: 'Enter' })
    expect(fields).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled()
    expect(document.querySelector('.equipment-picker-content')).toBeTruthy()
    expect(document.querySelector('.equipment-picker-preview')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
    await waitFor(() => expect(fields).toHaveBeenCalledWith({ reset: true, saveType: 0, saveId: 2 }))
  })
  test('shared decoration editor buffers changes until Apply; Escape discards the draft', async () => {
    let view = render(editor()); fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
    fireEvent.click(await screen.findByRole('button', { name: '移除' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: '防具强化次数' }), { target: { value: '7' } })
    expect(fields).not.toHaveBeenCalled(); fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1)
    view.unmount(); view = render(editor()); fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
    expect(screen.getByRole('spinbutton', { name: '防具强化次数' })).toHaveProperty('value', '3')
    fireEvent.click(await screen.findByRole('button', { name: '移除' }))
    fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
    await waitFor(() => expect(fields).toHaveBeenCalledWith({ decorations: [0, 0, 0] }))
  })
  test('shared item picker distinguishes native item IDs and requires Apply', async () => {
    const apply = vi.fn()
    render(<SaveItemPickerDrawer gameId="mhp2g" selectedId={1} initialCount={5} onApply={apply} onClose={close} />)
    const second = await screen.findByRole('option', { name: /合成道具2/ })
    fireEvent.click(second); fireEvent.keyDown(second, { key: 'Enter' })
    expect(apply).not.toHaveBeenCalled()
    expect(screen.getByRole('option', { name: /合成道具1/ }).getAttribute('aria-selected')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'mhp2g', itemId: 2 }), 5)
  })
})
