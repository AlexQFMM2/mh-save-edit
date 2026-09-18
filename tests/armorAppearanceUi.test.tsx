// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SaveBoxSection, SaveEquipmentCell } from '../api/save/types'
import { ArmorAppearanceIcon } from '../ui/components/ArmorAppearanceIcon/ArmorAppearanceIcon'
import { SaveBoxWorkspace } from '../ui/components/SaveBoxWorkspace/SaveBoxWorkspace'
import { SaveEquipmentEditorDrawer } from '../ui/components/SaveEquipmentEditorDrawer/SaveEquipmentEditorDrawer'
import { MemoryRouter } from 'react-router-dom'

const cell: SaveEquipmentCell = { slot: 0, empty: false, kind: 'armor', saveType: 1, saveId: 9, level: 0, slots: 1, appearanceId: 7, appearance: { appearanceId: 7, nameCn: '合成外观头盔', nameEn: '', part: 'head', rarity: 1, iconPath: '/assets/catalog/appearance/hunter.png', iconSource: 'custom-appearance-sprite', sourceStatus: 'confirmed', iconFallback: false }, decorations: [], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, nameCn: '实际测试头盔', nameEn: '', typeNameCn: '头部', iconPath: '/ordinary.png', weaponKey: null, armorDexId: null, palicoEquipmentId: null, decorationLabels: [], skill1NameCn: null, skill2NameCn: null, recordHex: '00'.repeat(36), diagnostics: [] }
const section: SaveBoxSection = { kind: 'equipment-box', domain: 'hunter-equipment', page: 1, pageSize: 100, pageCount: 1, totalSlots: 1, nonEmptyCount: 1, cells: [cell] }
const callbacks = { onPage: vi.fn(), onReplaceItem: vi.fn(), onEditEquipment: vi.fn(), onSetCount: vi.fn(), onClear: vi.fn(), onCopy: vi.fn(), onImport: vi.fn(), onExport: vi.fn() }
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })

describe('hunter appearance icons', () => {
  it('keeps an appearance choice in the save drawer draft until explicit Apply', async () => {
    const candidate = { kind: 'armor', gameId: 'mhgu', candidateKey: 'head:7', sourceKind: 'catalog', dexId: 77, templateKey: null, saveType: 1, saveId: 7, nameCn: '合成外观头盔', nameEn: '', part: 'head', combat: 'both', gender: 'both', rarity: 1, slots: 1, baseDefense: 1, maxDefense: 1, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, iconPath: null, skills: [] }
    const searchArmors = vi.fn().mockResolvedValue({ items: [candidate], total: 1, page: 1, pageSize: 100, hasNext: false })
    const searchArmorAppearances = vi.fn().mockImplementation(({ page }) => Promise.resolve({ items: [{ ...cell.appearance, appearanceId: page === 2 ? 8 : 7, nameCn: page === 2 ? '原生专用外观' : '合成外观头盔' }], total: 101, page, pageSize: 100, hasNext: page === 1 }))
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { save: { searchArmorAppearances }, catalog: { getArmor: vi.fn().mockResolvedValue(null) }, loadout: { getBootstrap: vi.fn().mockResolvedValue({ gameId: 'mhgu', dataVersion: 'test', decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }), getFacets: vi.fn().mockResolvedValue({ skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] }), searchArmors } } })
    const onApply = vi.fn().mockResolvedValue(undefined); const onClose = vi.fn()
    render(<MemoryRouter><SaveEquipmentEditorDrawer gameId="mhgu" domain="hunter-equipment" cell={{ ...cell, appearanceId: 0, appearance: null }} onApply={onApply} onApplyRecord={vi.fn()} onClose={onClose} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '编辑实例' }))
    fireEvent.click(await screen.findByRole('button', { name: /合成外观头盔/ }))
    expect(onApply).not.toHaveBeenCalled()
    expect(searchArmorAppearances).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'mhgu', saveType: 1, page: 1 }))
    fireEvent.click(screen.getByRole('button', { name: '下一页外观' }))
    fireEvent.click(await screen.findByRole('button', { name: /原生专用外观/ }))
    fireEvent.click(screen.getByRole('button', { name: '上一页外观' }))
    await screen.findByRole('button', { name: /合成外观头盔/ })
    expect(screen.getByText('当前外观：原生专用外观')).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '应用字段修改' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ appearanceId: 8 })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['head', 'chest', 'arms', 'waist', 'legs'] as const)('uses a clipped viewport of the unchanged source for %s', part => {
    const { container } = render(<ArmorAppearanceIcon part={part} name="合成外观" />)
    const image = container.querySelector('img')!
    expect(image.getAttribute('src')).toContain('/assets/catalog/appearance/hunter.png')
    expect(image.style.top).not.toBe('')
    expect(screen.getByRole('img').getAttribute('data-part')).toBe(part)
    fireEvent.error(image)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('渐变图标不可用')
    expect(screen.getByText('幻')).toBeTruthy()
  })
  it('uses gradient icons in box and heading while retaining the ordinary actual-equipment preview', async () => {
    const { container } = render(<SaveBoxWorkspace gameId="mhgu" section={section} busy={false} {...callbacks} />)
    await waitFor(() => expect(container.querySelector('.save-equipment-embedded-detail')?.getAttribute('aria-busy')).toBe('false'))
    const gridCell = screen.getByRole('gridcell', { name: /幻化：合成外观头盔/ })
    expect(gridCell.querySelector('.armor-appearance-icon')?.getAttribute('data-part')).toBe('head')
    expect(container.querySelectorAll('.armor-appearance-icon')).toHaveLength(3)
    expect(screen.getByText('实际装备')).toBeTruthy()
    expect(screen.getByText('幻化外观')).toBeTruthy()
    expect(container.querySelector('img[src$="ordinary.png"]')).toBeTruthy()
  })
  it.each(['mh3g', 'mh4g', 'mhgu'] as const)('does not invent appearance state for zero ID or unsupported %s', async gameId => {
    const cells = [{ ...cell, appearanceId: gameId === 'mhgu' ? 0 : 7 }]
    const { container } = render(<SaveBoxWorkspace gameId={gameId} section={{ ...section, cells }} busy={false} {...callbacks} />)
    await waitFor(() => expect(container.querySelector('.save-equipment-embedded-detail')?.getAttribute('aria-busy')).toBe('false'))
    expect(container.querySelector('.armor-appearance-icon')).toBeNull()
    expect(screen.queryByText('幻化外观')).toBeNull()
    expect(screen.queryByText(/未知外观/)).toBeNull()
  })
  it('preserves a visible unknown-appearance warning rather than inventing a resolved target', async () => {
    const { container } = render(<SaveBoxWorkspace gameId="mhgu" section={{ ...section, cells: [{ ...cell, appearance: null, appearanceId: 99 }] }} busy={false} {...callbacks} />)
    await waitFor(() => expect(container.querySelector('.save-equipment-embedded-detail')?.getAttribute('aria-busy')).toBe('false'))
    expect(screen.getByRole('gridcell', { name: /未知外观 #99/ })).toBeTruthy()
    expect(screen.getByText('未知外观（原值保留）')).toBeTruthy()
  })
})
