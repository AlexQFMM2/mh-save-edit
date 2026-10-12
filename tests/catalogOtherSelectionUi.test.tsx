// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import type { ArmorSummary, CatalogGameId, HunterArtDetail, MonsterDetail, WeaponSummary } from '../api/catalog/types'
import { MonsterCatalogPage } from '../ui/pages/MonsterCatalogPage/MonsterCatalogPage'
import { QuestCatalogPage } from '../ui/pages/QuestCatalogPage/QuestCatalogPage'
import { HunterArtCatalogPage } from '../ui/pages/HunterArtCatalogPage/HunterArtCatalogPage'
import { ArmorCatalogPage } from '../ui/pages/ArmorCatalogPage/ArmorCatalogPage'
import { WeaponCatalogPage } from '../ui/pages/WeaponCatalogPage/WeaponCatalogPage'
import { gameVersions } from '../ui/data/gameVersions'
import { p2gQuest } from './fixtures/p2gQuestUi'

afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })
const games: CatalogGameId[] = ['mhp2g', 'mh3g', 'mh4g', 'mhgu']
function install(api: Record<string, unknown>) { window.mhSaveEditor = { catalog: api } as unknown as Window['mhSaveEditor'] }
function page(kind: string, gameId: CatalogGameId = 'mhgu', search = '') {
  render(<MemoryRouter initialEntries={[`/${kind}${search}`]}><Routes>
    <Route element={<Outlet context={{ game: gameVersions.find(game => game.id === gameId) }} />}>
      <Route path="/monsters" element={<MonsterCatalogPage />} />
      <Route path="/quests" element={<QuestCatalogPage />} />
      <Route path="/arts" element={<HunterArtCatalogPage />} />
      <Route path="/armor" element={<ArmorCatalogPage />} />
      <Route path="/weapons" element={<WeaponCatalogPage />} />
    </Route>
  </Routes></MemoryRouter>)
}
const paged = <T,>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length, hasNext: false })

describe('other catalog pages preserve lists when only selection changes', () => {
  it.each(games)('%s monster selection and tabs do not repeat searches', async gameId => {
    const monsters: MonsterDetail[] = [1, 2].map(monsterId => ({
      gameId, monsterId, nameCn: `测试兽${monsterId}`, nameEn: '', nameJp: '', iconSmallPath: null, iconLargePath: null,
      isPlaceholder: false, weakness: [], ailments: [], traps: [], drops: [], quests: [],
    }))
    const searchMonsters = vi.fn().mockResolvedValue(monsters)
    install({ searchMonsters, getMonster: vi.fn(async ({ monsterId }) => monsters[monsterId - 1]) })
    page('monsters', gameId)
    await screen.findByRole('heading', { name: '测试兽1' })
    const rows = screen.getByRole('listbox', { name: '怪物搜索结果' })
    rows.scrollTop = 400
    fireEvent.click(within(rows).getByRole('button', { name: /测试兽2/ }))
    await screen.findByRole('heading', { name: '测试兽2' })
    fireEvent.click(screen.getByRole('tab', { name: '肉质' }))
    expect(screen.getByRole('listbox', { name: '怪物搜索结果' })).toBe(rows)
    expect(rows.scrollTop).toBe(400)
    expect(searchMonsters).toHaveBeenCalledOnce()
  })

  it.each(games)('%s quest selection and tabs do not repeat searches', async gameId => {
    const quests = [1, 2].map(id => ({ ...p2gQuest, gameId, questKey: gameId === 'mhp2g' ? `mhp2g:q${id}` : `dex:${id}`, nameCn: `测试任务${id}`, p2g: undefined, monsters: [], rewards: [], isPlaceholder: false, match: null }))
    const searchQuests = vi.fn().mockResolvedValue(paged(quests))
    install({ searchQuests, getQuest: vi.fn(async ({ questKey }) => quests.find(quest => quest.questKey === questKey)), getQuestFacets: vi.fn().mockResolvedValue({ systems: [], levels: [], ranks: [], questTypes: [], locations: [], availabilities: [] }) })
    page('quests', gameId)
    await screen.findByRole('heading', { name: '测试任务1' })
    const rows = document.querySelector<HTMLElement>('.quest-list__scroller')!
    rows.scrollTop = 400
    fireEvent.click(within(rows).getByRole('button', { name: '测试任务2' }))
    await screen.findByRole('heading', { name: '测试任务2' })
    fireEvent.click(screen.getByRole('tab', { name: '报酬' }))
    expect(document.querySelector('.quest-list__scroller')).toBe(rows)
    expect(rows.scrollTop).toBe(400)
    expect(searchQuests).toHaveBeenCalledOnce()
  })

  it('MHGU hunter art selection queries details only', async () => {
    const arts: HunterArtDetail[] = [1, 2].map(hunterArtId => ({
      gameId: 'mhgu', hunterArtId, nameCn: `测试狩技${hunterArtId}`, nameEn: '', nameJp: '', weaponTypeId: 1, weaponTypeNameCn: '测试武器', weaponTypeNameEn: '', level: 1, contentVariant: 'common',
      isPlaceholder: false, unlockKind: 'initial', match: null, shortDescriptionCn: '', longDescriptionCn: '', shortDescriptionEn: '', longDescriptionEn: '', shortDescriptionJp: '', longDescriptionJp: '', unlocks: [], quests: [],
    }))
    const searchHunterArts = vi.fn().mockResolvedValue(arts)
    install({ searchHunterArts, getHunterArt: vi.fn(async ({ hunterArtId }) => arts[hunterArtId - 1]), getHunterArtFacets: vi.fn().mockResolvedValue({ weaponTypes: [], levels: [], unlockKinds: [] }) })
    page('arts')
    await screen.findByRole('heading', { name: '测试狩技1' })
    const rows = screen.getByRole('listbox', { name: '狩技列表' })
    rows.scrollTop = 400
    fireEvent.click(within(rows).getByRole('option', { name: /测试狩技2/ }))
    await screen.findByRole('heading', { name: '测试狩技2' })
    expect(rows.scrollTop).toBe(400)
    expect(searchHunterArts).toHaveBeenCalledOnce()
  })

  it.each(['list', 'set'])('armor %s selection preserves the results and requests details only', async view => {
    const armors: ArmorSummary[] = [1, 2].map(dexId => ({ gameId: 'mhgu', dexId, nameCn: `测试防具${dexId}`, nameEn: '', nameJp: '', part: 'head', combat: 'both', gender: 'both', rarity: 1, slots: 1, baseDefense: 1, maxDefense: 2, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, price: null, iconPath: null, isPlaceholder: false, skills: [] }))
    const sets = armors.map(armor => ({ gameId: 'mhgu', setKey: `set:${armor.dexId}`, sortOrder: armor.dexId, rarity: 1, totalSlots: 1, totalBaseDefense: 1, totalMaxDefense: 2, rows: [{ combat: 'blademaster', nameCn: '测试套装', members: { head: armor } }, { combat: 'gunner', nameCn: '', members: {} }] }))
    const searchArmors = vi.fn().mockResolvedValue(paged(armors)), searchArmorSets = vi.fn().mockResolvedValue(paged(sets)), getArmor = vi.fn().mockResolvedValue(null)
    install({ searchArmors, searchArmorSets, getArmor, getArmorFacets: vi.fn().mockResolvedValue({ rarities: [], slots: [], skills: [] }) })
    page('armor', 'mhgu', `?view=${view}`)
    await waitFor(() => expect(getArmor).toHaveBeenCalledWith({ gameId: 'mhgu', dexId: 1 }))
    const selector = view === 'list' ? '.armor-list' : '.armor-set-matrix'
    const rows = document.querySelector<HTMLElement>(selector)!
    rows.scrollTop = 400
    fireEvent.click(within(rows).getByText('测试防具2'))
    await waitFor(() => expect(getArmor).toHaveBeenLastCalledWith({ gameId: 'mhgu', dexId: 2 }))
    expect(document.querySelector(selector)).toBe(rows)
    expect(rows.scrollTop).toBe(400)
    expect(view === 'list' ? searchArmors : searchArmorSets).toHaveBeenCalledOnce()
  })

  it('weapon list selection preserves results and requests details only', async () => {
    const weapons: WeaponSummary[] = [1, 2].map(id => ({ gameId: 'mhgu', weaponKey: `7:${id}:0`, typeId: 1, typeNameCn: '测试类型', typeNameEn: '', kind: 'standardMelee', saveType: 7, saveId: id, saveLevel: 0, displayLevel: null, dexId: id, nameCn: `测试武器${id}`, nameEn: '', rarity: 1, displayAttack: 10, trueRawAttack: 10, affinity: 0, defense: 0, slots: 1, isDirectlyProducible: true, isFinalForm: false, iconPath: null, isPlaceholder: false, attributes: [], sharpness: null, specialSummary: [] }))
    const searchWeapons = vi.fn().mockResolvedValue(paged(weapons)), getWeapon = vi.fn().mockResolvedValue(null)
    install({ searchWeapons, getWeapon, getWeaponFacets: vi.fn().mockResolvedValue({ weaponTypes: [], attributes: [], rarities: [], slots: [], sharpnessStages: ['base'] }) })
    page('weapons', 'mhgu', '?view=list')
    await waitFor(() => expect(getWeapon).toHaveBeenCalledWith({ gameId: 'mhgu', weaponKey: '7:1:0' }))
    const rows = screen.getByRole('listbox', { name: '武器列表' })
    rows.scrollTop = 400
    fireEvent.click(within(rows).getByText('测试武器2'))
    await waitFor(() => expect(getWeapon).toHaveBeenLastCalledWith({ gameId: 'mhgu', weaponKey: '7:2:0' }))
    expect(screen.getByRole('listbox', { name: '武器列表' })).toBe(rows)
    expect(rows.scrollTop).toBe(400)
    expect(searchWeapons).toHaveBeenCalledOnce()
  })
})
