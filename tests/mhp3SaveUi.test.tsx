// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SaveEquipmentCell } from '../api/save/types'
import { P3SaveEquipmentEditorDrawer } from '../ui/components/SaveEquipmentEditorDrawer/P3SaveEquipmentEditorDrawer'
import { SaveItemPickerDrawer } from '../ui/components/SaveItemPickerDrawer/SaveItemPickerDrawer'

const equipment: SaveEquipmentCell = {
  slot: 2, empty: false, kind: 'armor', saveType: 0, saveId: 1, level: 2, slots: 2, equipped: true,
  nameCn: '合成胴甲', nameEn: '', typeNameCn: '胴部', iconPath: null, armorKey: 'mhp3:armor:0:1', weaponKey: null,
  armorDexId: null, palicoEquipmentId: null, appearanceId: null, decorations: [825, 0, 0],
  decorationLabels: [], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null,
  skill1NameCn: null, skill2NameCn: null, recordHex: '010001000200390300000000', diagnostics: [],
  upgrade: { label: '防具强化次数', maximum: 255, naturalMaximum: 8, value: 2 },
}
const page = <T,>(...items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length, hasNext: false })
const apply = vi.fn(async () => {})
const close = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: {
    catalog: {
      searchArmors: async () => page({ gameId: 'mhp3', armorKey: 'mhp3:armor:0:2', nativeType: 0, nativeId: 2, nameCn: '候选胴甲', nameJp: '候補', combat: 'both', slots: 2, iconPath: null }),
      getArmor: async () => null,
      searchItems: async () => page(...[10, 20].map(itemId => ({ gameId: 'mhp3', itemId, nameCn: `合成道具${itemId}`, nameEn: '', p3: { quantityKind: 'count' }, maxStack: 5 }))),
      searchDecorations: async () => page({ gameId: 'mhp3', itemId: 825, nameCn: '同名合成珠', nameJp: '試験珠', slots: 1, skills: [] }),
      searchSkills: async () => page(),
    },
  } })
})
afterEach(cleanup)
const editor = () => <P3SaveEquipmentEditorDrawer cell={equipment} onApply={apply} onClose={close} onOpenCatalog={() => {}} />

test('P3 shared equipment result keys and keyboard selection commit only on Apply', async () => {
  render(editor())
  const row = await screen.findByRole('button', { name: /候选胴甲/ })
  fireEvent.keyDown(row, { key: ' ' })
  expect(apply).not.toHaveBeenCalled()
  expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
  await waitFor(() => expect(apply).toHaveBeenCalledWith({ selection: { kind: 'armor', key: 'mhp3:armor:0:2' } }))
})

test('P3 shared decoration editor keeps Escape and sends only changed instance fields', async () => {
  const first = render(editor())
  fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
  fireEvent.click(await screen.findByRole('button', { name: '移除' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(close).toHaveBeenCalledTimes(1)
  expect(apply).not.toHaveBeenCalled()
  first.unmount()
  render(editor())
  fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
  await screen.findByRole('button', { name: '移除' })
  fireEvent.change(screen.getByRole('spinbutton', { name: '防具强化次数' }), { target: { value: 5 } })
  fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
  await waitFor(() => expect(apply).toHaveBeenCalledWith({ level: 5 }))
})

test('P3 item picker uses native itemId and preserves the 99-item box default', async () => {
  render(<SaveItemPickerDrawer gameId="mhp3" selectedId={10} initialCount={99} onApply={apply} onClose={close} />)
  fireEvent.keyDown(await screen.findByRole('option', { name: /合成道具20/ }), { key: 'Enter' })
  expect(apply).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
  await waitFor(() => expect(apply).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'mhp3', itemId: 20 }), 99))
})
