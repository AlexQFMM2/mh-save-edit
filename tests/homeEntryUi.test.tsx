// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../ui/App'

const searchItems = vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 100, hasNext: false }))
const getItemFacets = vi.fn(async () => ({ rarities: [], maxStacks: [], relations: [] }))
const catalogAccess = vi.fn(() => ({ searchItems, getItemFacets }))
const loadoutAccess = vi.fn(() => ({}))
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
    expect(screen.getByRole('button', { name: /打开存档/ }).hasAttribute('disabled')).toBe(true)
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
    ['catalog/decorations', '装饰品图鉴'], ['catalog/skills', '技能图鉴'],
    ['catalog/weapons', '武器图鉴'], ['catalog/armor', '防具图鉴'],
    ['catalog/monsters', '怪物图鉴'], ['catalog/quests', '任务图鉴'],
    ['edit', '存档修改'], ['edit/loadout', '配装器'],
  ])('keeps P2G %s available as an honest placeholder without runtime calls', async (path, title) => {
    window.history.replaceState(null, '', `/#/game/mhp2g/${path}`)
    render(<App />)
    await screen.findByRole('heading', { name: title })
    expect(screen.getByText('功能开发中')).toBeTruthy()
    expect(window.location.hash).toBe(`#/game/mhp2g/${path}`)
    expect(catalogAccess).not.toHaveBeenCalled()
    expect(loadoutAccess).not.toHaveBeenCalled()
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
