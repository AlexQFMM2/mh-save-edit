// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import type { PalicoArmorDetail, PalicoSupportMoveDetail, PalicoWeaponSummary } from '../api/catalog/types'
import { PalicoAbilityDetailPanel } from '../ui/components/PalicoAbilityDetailPanel/PalicoAbilityDetailPanel'
import { PalicoEntryList } from '../ui/components/PalicoEntryList/PalicoEntryList'
import { PalicoEquipmentBrowser } from '../ui/components/PalicoEquipmentBrowser/PalicoEquipmentBrowser'
import { PalicoEquipmentDetailPanel } from '../ui/components/PalicoEquipmentDetailPanel/PalicoEquipmentDetailPanel'
import { gameVersions } from '../ui/data/gameVersions'
import { PalicoEquipmentCatalogPage } from '../ui/pages/PalicoEquipmentCatalogPage/PalicoEquipmentCatalogPage'

afterEach(cleanup)

const armor: PalicoArmorDetail = {
  gameId: 'mhgu', kind: 'armor', equipmentId: 100, dexId: 100, saveId: 100,
  nameCn: '迅猫头盔', nameEn: 'Narga F Helm', nameJp: 'ナルガネコヘルム', part: 'head', rarity: 7,
  defense: 60, fireRes: 1, waterRes: 0, thunderRes: -2, iceRes: 1, dragonRes: 0,
  price: 800, iconPath: null, descriptionCn: '迅龙素材制成的头部装备。', descriptionEn: '', descriptionJp: '',
  materials: [{ gameId: 'mhgu', saveId: 300, nameCn: '迅龙素材', nameEn: 'Nargacuga Material', quantity: 2 }], source: 'synthetic',
}

describe('Palico catalog UI', () => {
  it('supports roving keyboard selection in the Palico lists and equipment tables', () => {
    const selectEntry = vi.fn()
    render(<PalicoEntryList entries={[{ id: 1, nameCn: '回复笛之技', nameEn: 'Herb Horn' }, { id: 2, nameCn: '鬼人笛之技', nameEn: 'Rousing Roar' }]} selectedId={1} loading={false} label="支援行动" onSelect={selectEntry} />)
    fireEvent.keyDown(screen.getByRole('option', { name: /回复笛之技/ }), { key: 'ArrowDown' })
    expect(selectEntry).toHaveBeenCalledWith(2)

    cleanup()
    const selectWeapon = vi.fn()
    const weapons: PalicoWeaponSummary[] = [weapon(1, '测试猫剑'), weapon(2, '测试猫锤')]
    render(<PalicoEquipmentBrowser mode="weapon" items={weapons} selectedId={1} loading={false} onSelect={selectWeapon} />)
    fireEvent.keyDown(screen.getByText('测试猫剑').closest('button')!, { key: 'ArrowDown' })
    expect(selectWeapon).toHaveBeenCalledWith(2)
  })

  it('exposes armor material relations as buttons', () => {
    const selectItem = vi.fn()
    render(<PalicoEquipmentDetailPanel detail={armor} loading={false} onSelectItem={selectItem} />)
    fireEvent.click(screen.getByRole('button', { name: /迅龙素材/ }))
    expect(selectItem).toHaveBeenCalledWith(300)
  })

  it('shows native unlock conditions and opens the related monster', () => {
    const selectMonster = vi.fn()
    const detail: PalicoSupportMoveDetail = {
      gameId: 'mhgu', supportMoveId: 2, nameCn: '回复笛之技', nameEn: 'Health Horn', nameJp: '回復笛の技',
      descriptionCn: '吹奏回复笛。', descriptionEn: '', descriptionJp: '', generationTier: 3, generationGroup: 'A',
      role: 'generated', teachable: true, gaugeCost: 2, evidenceStatus: 'verified', types: [], source: 'native',
      unlocks: [{ unlockKey: 'monster:48', nativeUnlockId: 34, kind: 'monster', level: null, monsterId: 48, monsterNameCn: '跳狗龙王', descriptionCn: '狩猎「跳狗龙王」后解锁。', descriptionEn: 'Unlock by hunting Great Maccao.', evidenceStatus: 'verified', source: 'native+wiki' }],
    }
    render(<PalicoAbilityDetailPanel kind="move" detail={detail} loading={false} onSelectMonster={selectMonster} />)
    expect(screen.getByText('2 槽')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /跳狗龙王/ }))
    expect(selectMonster).toHaveBeenCalledWith(48)
  })

  it('restores armor filters from the URL without rerunning the list after selection', async () => {
    const body = { ...armor, equipmentId: 101, dexId: 101, saveId: 101, nameCn: '迅猫铠甲', nameEn: 'Narga F Mail', nameJp: 'ナルガネコメイル', part: 'body' as const, defense: 90 }
    const searchPalicoArmors = vi.fn().mockResolvedValue({ items: [armor, body], page: 1, pageSize: 100, total: 2, hasNext: false })
    const getPalicoArmor = vi.fn().mockResolvedValue(armor)
    installCatalogMocks({ searchPalicoArmors, getPalicoArmor })

    renderPage('mhgu', '/game/mhgu/catalog/palico/equipment?view=armor&q=迅猫&rarity=7&sort=defense&direction=desc&equipment=100')
    await waitFor(() => expect(searchPalicoArmors).toHaveBeenCalled())
    expect(searchPalicoArmors.mock.calls[0][0]).toMatchObject({ gameId: 'mhgu', query: '迅猫', rarity: 7, sort: 'defense', direction: 'desc' })
    expect(screen.getByText('迅猫铠甲')).toBeTruthy()

    fireEvent.click(screen.getByRole('row', { name: /迅猫铠甲/ }))
    await waitFor(() => expect(getPalicoArmor).toHaveBeenCalledWith({ gameId: 'mhgu', kind: 'armor', equipmentId: 101 }))
    expect(searchPalicoArmors).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('迅猫头盔').length).toBeGreaterThan(0)
  })

  it('switches equipment modes with arrow keys and rejects non-MHGU routes', async () => {
    const searchPalicoWeapons = vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, hasNext: false })
    const searchPalicoArmors = vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, hasNext: false })
    installCatalogMocks({ searchPalicoWeapons, searchPalicoArmors })
    renderPage('mhgu', '/game/mhgu/catalog/palico/equipment?view=set&set=set:0001')
    const weaponTab = screen.getByRole('tab', { name: '武器' })
    expect(weaponTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByRole('tab', { name: '防具套装' })).toBeNull()
    await waitFor(() => expect(searchPalicoWeapons).toHaveBeenCalled())
    weaponTab.focus()
    fireEvent.keyDown(weaponTab, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('tab', { name: '防具' }).getAttribute('aria-selected')).toBe('true'))
    expect(searchPalicoArmors).toHaveBeenCalled()

    cleanup()
    renderPage('mh4g', '/game/mh4g/catalog/palico/equipment')
    expect(await screen.findByText('MH4G overview')).toBeTruthy()
  })
})

function weapon(equipmentId: number, nameCn: string): PalicoWeaponSummary {
  return {
    gameId: 'mhgu', kind: 'weapon', equipmentId, dexId: equipmentId, saveId: equipmentId, nameCn,
    nameEn: `Weapon ${equipmentId}`, nameJp: `武器${equipmentId}`, rarity: 1, attackType: 'cut', specializationId: 1,
    specializationCn: '平衡', specializationEn: 'Balanced', meleeAttack: 10, meleeAffinity: 0, rangedAttack: 8,
    rangedAffinity: 0, specialAttackCn: null, specialAttackEn: null, specialAttackValue: null, defense: 0,
    sharpnessId: 2, price: 100, iconPath: null,
  }
}

function installCatalogMocks(overrides: Record<string, unknown> = {}) {
  const emptyPage = { items: [], page: 1, pageSize: 100, total: 0, hasNext: false }
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { version: 'test', catalog: {
    getPalicoCatalogFacets: vi.fn().mockResolvedValue({ typeOptions: [], gaugeCosts: [], memoryCosts: [], learnLevels: [], generationGroups: [], unlockKinds: [], rarities: [], specializations: [], specialAttacks: [], sharpnessIds: [] }),
    searchPalicoWeapons: vi.fn().mockResolvedValue(emptyPage), searchPalicoArmors: vi.fn().mockResolvedValue(emptyPage),
    getPalicoWeapon: vi.fn().mockResolvedValue(null),
    getPalicoArmor: vi.fn().mockResolvedValue(null), ...overrides,
  } } })
}

function renderPage(gameId: 'mhgu' | 'mh4g', entry: string) {
  const game = gameVersions.find((value) => value.id === gameId)!
  return render(<MemoryRouter initialEntries={[entry]}><Routes>
    <Route element={<Outlet context={{ game, onOpenSave: () => undefined }} />}>
      <Route path="/game/:gameId/catalog/palico/equipment" element={<PalicoEquipmentCatalogPage />} />
      <Route path="/game/:gameId/overview" element={<div>{game.id.toUpperCase()} overview</div>} />
    </Route>
  </Routes></MemoryRouter>)
}
