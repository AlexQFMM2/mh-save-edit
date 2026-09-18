// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { EquipmentPickerContent } from '../ui/components/EquipmentPickerContent/EquipmentPickerContent'
import { WeaponCatalogPage } from '../ui/pages/WeaponCatalogPage/WeaponCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'

afterEach(cleanup)
const facets = { skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] }
function pickerApi() {
  const search = vi.fn().mockImplementation(request => Promise.resolve({ items: [], total: 201, page: request.page, pageSize: 100, hasNext: request.page < 3 }))
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { searchWeapons: search, searchArmors: search } } })
  return search
}
function Context() { return <><output data-testid="location">{useLocation().search}</output><Outlet context={{ game: gameVersions.find(game => game.id === 'mhgu'), onOpenSave: () => {} }} /></> }
function catalog(url: string) { return <MemoryRouter initialEntries={[url]}><Routes><Route element={<Context />}><Route path="/weapons" element={<WeaponCatalogPage />} /></Route></Routes></MemoryRouter> }

describe('equipment filter transitions', () => {
  it('resets picker pagination when enabling final-only and never changes the selection implicitly', async () => {
    const search = pickerApi(); const select = vi.fn()
    render(<EquipmentPickerContent gameId="mhgu" slot="weapon" facets={facets} relicLookups={[]} decorations={[]} onSelectionChange={select} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '下一页' })).toHaveProperty('disabled', false))
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    fireEvent.click(screen.getByRole('checkbox', { name: '只看无法再强化' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ finalOnly: true, page: 1 })))
    expect(select.mock.calls.every(([value]) => value === null)).toBe(true)
  })
  it.each([['blademaster', '近战（含通用）'], ['gunner', '远程（含通用）']])('supports bilingual profession selection for %s', async (combat, label) => {
    const search = pickerApi()
    render(<EquipmentPickerContent gameId="mhgu" slot="head" facets={facets} relicLookups={[]} decorations={[]} onSelectionChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '防具职业' }))
    fireEvent.change(screen.getByRole('combobox', { name: '防具职业关键词' }), { target: { value: combat } })
    fireEvent.click(screen.getByRole('option', { name: label }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ combat, part: 'head', page: 1 })))
    expect(screen.queryByRole('checkbox', { name: '只看无法再强化' })).toBeNull()
  })
  it('restores final-only from the URL, resets pagination on change and clears it with reset', async () => {
    const search = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100, hasNext: false })
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: { searchWeapons: search, getWeaponFacets: vi.fn().mockResolvedValue({ weaponTypes: [], attributes: [], rarities: [], slots: [], sharpnessStages: ['base'] }) } } })
    const view = render(catalog('/weapons?view=list&final=1&page=3'))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ finalOnly: true, page: 3 })))
    expect(screen.getByRole('checkbox', { name: '只看无法再强化' })).toHaveProperty('checked', true)
    fireEvent.click(screen.getByRole('checkbox', { name: '只看无法再强化' }))
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ finalOnly: false, page: 1 })))
    fireEvent.click(screen.getByRole('checkbox', { name: '只看无法再强化' }))
    const url = '/weapons' + screen.getByTestId('location').textContent
    view.unmount(); render(catalog(url))
    expect(screen.getByRole('checkbox', { name: '只看无法再强化' })).toHaveProperty('checked', true)
    fireEvent.click(screen.getByRole('button', { name: '重置全部筛选条件' }))
    expect(screen.getByTestId('location').textContent).toBe('')
    expect(screen.getByRole('checkbox', { name: '只看无法再强化' })).toHaveProperty('checked', false)
  })
})
