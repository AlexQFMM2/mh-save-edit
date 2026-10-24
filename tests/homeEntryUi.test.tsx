// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../ui/App'
import { p2gLoadoutFixture } from './fixtures/p2gLoadout'

const searchItems = vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100, hasNext: false }))
const getItemFacets = vi.fn(async () => ({ rarities: [], maxStacks: [], relations: [] }))
const emptyPage = () => ({ items: [], total: 0, page: 1, pageSize: 100, hasNext: false })
const searchDecorations = vi.fn(async () => emptyPage())
const searchSkills = vi.fn(async () => emptyPage())
const searchWeapons = vi.fn(async () => emptyPage())
const searchArmors = vi.fn(async () => emptyPage())
const searchArmorSets = vi.fn(async () => emptyPage())
const searchMonsters = vi.fn(async () => [])
const searchQuests = vi.fn(async () => emptyPage())
const catalogAccess = vi.fn(() => ({
  searchItems, getItemFacets, searchDecorations, searchSkills, searchWeapons, searchMonsters, searchQuests, searchArmors, searchArmorSets,
  getArmorFacets: async () => ({ parts: [], combats: [], genders: [], rarities: [], slots: [], skills: [] }),
  getDecorationFacets: async () => ({ slots: [], skills: [] }),
  getWeaponFacets: async () => ({ weaponTypes: [], attributes: [], rarities: [], slots: [], sharpnessStages: ['base'] }),
  getQuestFacets: async () => ({ systems: [], levels: [], questTypes: [], locations: [], ranks: [], availabilities: [] }),
}))
const getBootstrap = vi.fn(async () => p2gLoadoutFixture().snapshot)
const loadoutAccess = vi.fn(() => ({ getBootstrap, getFacets: async () => ({ skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] }), listAutoLoadoutJobs: async () => [], subscribeAutoLoadoutJobs: () => () => {} }))
const openSave = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/#/')
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: {
    version: 'test',
    save: { getSession: async () => null, subscribe: () => () => undefined, open: openSave },
    get catalog() { return catalogAccess() },
    get loadout() { return loadoutAccess() },
  } })
})
afterEach(cleanup)

describe('P2G home entry boundary', () => {
  it('opens the shared overview from the keyboard with catalog and pending feature entries', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '译名词典' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '选择 Monster Hunter Portable 2nd G' }))
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Monster Hunter Portable 2nd G' })
    expect(window.location.hash).toBe('#/game/mhp2g/overview')
    expect(screen.getByRole('button', { name: /打开存档/ }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('link', { name: /资料图鉴/ }).getAttribute('href')).toBe('#/game/mhp2g/catalog/items')
    expect(document.querySelectorAll('.workspace-sidebar a')).toHaveLength(10)
    expect(screen.getByText('PPSSPP')).toBeTruthy()
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it('opens the real item route using only the P2G catalog', async () => {
    window.history.replaceState(null, '', '/#/game/mhp2g/catalog/items')
    render(<App />)
    await screen.findByText('没有符合当前条件的道具。')
    expect(searchItems).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'mhp2g', sort: 'itemId' }))
    expect(getItemFacets).toHaveBeenCalledWith('mhp2g')
    expect(window.location.hash).toBe('#/game/mhp2g/catalog/items')
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it.each([
    ['catalog/decorations', '.decoration-catalog-page', searchDecorations], ['catalog/skills', '.skill-catalog-page', searchSkills],
    ['catalog/armor', '.armor-catalog-page', searchArmorSets], ['catalog/weapons', '.weapon-catalog-page', searchWeapons], ['catalog/monsters', '.monster-catalog-page', searchMonsters], ['catalog/quests', '.quest-catalog-page', searchQuests],
  ])('opens the implemented P2G %s route using native read-only queries', async (path, selector, search) => {
    window.history.replaceState(null, '', `/#/game/mhp2g/${path}`)
    render(<App />)
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({ gameId: 'mhp2g' })), { timeout: 5000 })
    expect(document.querySelector(selector)).toBeTruthy()
    expect(screen.queryByText('功能开发中')).toBeNull()
    expect(window.location.hash).toBe(`#/game/mhp2g/${path}`)
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it.each([
    ['edit', '存档修改'],
  ])('opens the P2G %s environment picker without reading a save', async (path, title) => {
    window.history.replaceState(null, '', `/#/game/mhp2g/${path}`)
    render(<App />)
    await screen.findByRole('heading', { name: '选择存档环境' })
    expect(screen.getByText('P2G · PPSSPP')).toBeTruthy()
    expect(window.location.hash).toBe(`#/game/mhp2g/${path}`)
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it('opens the native six-slot loadout route without opening a save', async () => {
    window.history.replaceState(null, '', '/#/game/mhp2g/edit/loadout')
    render(<App />)
    await screen.findByRole('region', { name: '六槽装备与属性' })
    expect(document.querySelectorAll('.loadout-equipment-row')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: '选择护石' })).toBeNull()
    expect(getBootstrap).toHaveBeenCalledWith('mhp2g')
    expect(openSave).not.toHaveBeenCalled()
  })

  it.each(['catalog/hunter-arts', 'catalog/palico/skills'])('redirects unsupported P2G %s without runtime calls', async path => {
    window.history.replaceState(null, '', `/#/game/mhp2g/${path}`)
    render(<App />)
    await waitFor(() => expect(window.location.hash).toBe('#/game/mhp2g/overview'))
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })
})

describe('P3 workspace shell', () => {
  it('opens from the keyboard with PPSSPP and pending features', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.tab() // Global dictionary.
    await user.tab() // P2G.
    await user.tab() // P3.
    const card = screen.getByRole('button', { name: '选择 Monster Hunter Portable 3rd' })
    expect(document.activeElement).toBe(card)
    expect(card.querySelector('img')?.getAttribute('src')).toContain('home/p3-post.png')
    // AnimatePresence keeps the previous game's backdrop until its exit finishes.
    await waitFor(() => expect(document.querySelector('.guild-backdrop__game-image')?.getAttribute('style')).toContain('home/p3-bg.webp'))
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Monster Hunter Portable 3rd' })
    expect(window.location.hash).toBe('#/game/mhp3/overview')
    expect(screen.getByText('PPSSPP')).toBeTruthy()
    expect(screen.getByRole('button', { name: /打开存档/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('link', { name: '狩技' })).toBeNull()
    expect(screen.queryByText('支援倾向')).toBeNull()
    await user.click(screen.getByRole('link', { name: /资料图鉴/ }))
    await screen.findByText('没有符合当前条件的道具。')
    expect(searchItems).toHaveBeenLastCalledWith(expect.objectContaining({gameId:'mhp3'}))
    expect(searchWeapons).not.toHaveBeenCalled()
    expect(searchDecorations).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: '游戏总览' }))
    await screen.findByRole('heading', { name: 'Monster Hunter Portable 3rd' })
    await user.click(screen.getByRole('button', { name: '返回选择游戏版本' }))
    await screen.findByRole('heading', { name: '请选择游戏版本' })
    expect(searchItems).toHaveBeenLastCalledWith(expect.objectContaining({gameId:'mhp3'}))
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it('opens the P3 decoration route without calling skill, loadout or save services', async () => {
    window.history.replaceState(null, '', '/#/game/mhp3/catalog/decorations')
    render(<App />)
    await screen.findByText('没有符合条件的装饰品。')
    expect(searchDecorations).toHaveBeenCalledWith(expect.objectContaining({gameId:'mhp3',sort:'itemId'}))
    expect(searchSkills).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it.each([
    ['catalog/skills', '技能图鉴'], ['catalog/weapons', '武器图鉴'],
    ['catalog/armor', '防具图鉴'], ['catalog/monsters', '怪物图鉴'],
    ['catalog/quests', '任务图鉴'], ['edit', '存档修改'], ['edit/loadout', '配装器'],
  ])('keeps direct P3 %s links away from existing game services', async (path, title) => {
    window.history.replaceState(null, '', `/#/game/mhp3/${path}`)
    render(<App />)
    await screen.findByRole('heading', { name: title })
    expect(screen.getByText('功能待接入')).toBeTruthy()
    expect(window.location.hash).toBe(`#/game/mhp3/${path}`)
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })

  it.each(['catalog/hunter-arts', 'catalog/palico/skills'])('redirects unsupported P3 %s', async path => {
    window.history.replaceState(null, '', `/#/game/mhp3/${path}`)
    render(<App />)
    await waitFor(() => expect(window.location.hash).toBe('#/game/mhp3/overview'))
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
    expect(openSave).not.toHaveBeenCalled()
  })
})
