// @vitest-environment jsdom
// Synthetic catalog records only.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P3LoadoutCatalogRepository } from '../api/loadout/p3Repository'
import { LoadoutBuilderPage } from '../ui/pages/LoadoutBuilderPage/LoadoutBuilderPage'
import { getLoadoutDraft, restoreLoadoutDraft, setLoadoutDraftJob } from '../ui/stores/loadoutDraftStore'
import { createEmptyLogicalLoadout } from '../api/loadout/types'
import { p3LoadoutFixture } from './fixtures/p3LoadoutCatalog'

vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useOutletContext: () => ({ game: { id: 'mhp3' } }) }))
vi.mock('../ui/components/SaveSessionProvider/SaveSessionProvider', () => ({ useSaveSession: () => ({ session: null, notify: vi.fn() }) }))

const repository = () => new P3LoadoutCatalogRepository(p3LoadoutFixture())
const api = { searchArmors: vi.fn(), searchWeapons: vi.fn(), searchDecorations: vi.fn(), getBootstrap: vi.fn(), getFacets: vi.fn(), reconcileLoadout: vi.fn(), validateCharm: vi.fn(), listAutoLoadoutJobs: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(), controlAutoLoadout: vi.fn() }

beforeEach(() => {
  vi.resetAllMocks()
  const repo = repository(), snapshot = repo.getSnapshot()
  restoreLoadoutDraft('mhp3', createEmptyLogicalLoadout('mhp3', snapshot.dataVersion)); setLoadoutDraftJob('mhp3', undefined)
  api.getBootstrap.mockResolvedValue(snapshot)
  api.getFacets.mockResolvedValue(repo.getFacets())
  api.listAutoLoadoutJobs.mockResolvedValue([]); api.subscribeAutoLoadoutJobs.mockReturnValue(() => {})
  api.searchArmors.mockImplementation(async filters => ({ items: snapshot.armors.map(armor => ({ ...armor, decorations: [], lock: 'unlocked' as const })), total: snapshot.armors.length, page: filters.page ?? 1, pageSize: 100, hasNext: false }))
  api.searchWeapons.mockResolvedValue({ items: snapshot.weapons, total: snapshot.weapons.length, page: 1, pageSize: 100, hasNext: false })
  api.searchDecorations.mockResolvedValue({ items: snapshot.decorations, total: snapshot.decorations.length, page: 1, pageSize: 100, hasNext: false })
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: { getArmor: vi.fn(async () => null) }, loadout: api } })
})
afterEach(cleanup)

const page = () => <MemoryRouter><LoadoutBuilderPage /></MemoryRouter>

describe('P3 loadout page', () => {
  it('renders seven native slots including the charm row and applies a picked armor to the draft', async () => {
    const user = userEvent.setup()
    render(page())
    await screen.findByRole('region', { name: '七槽装备与属性' })
    expect(document.querySelectorAll('.loadout-equipment-row')).toHaveLength(7)
    expect(screen.getByText('护石')).toBeTruthy()
    const before = structuredClone(getLoadoutDraft('mhp3'))
    const trigger = screen.getByRole('button', { name: '选择头' })
    await user.click(trigger)
    const options = await screen.findAllByRole('button', { name: /合成防具/ })
    await user.click(options[0])
    await waitFor(() => expect(screen.getByRole('button', { name: '应用选择' })).toHaveProperty('disabled', false))
    expect(getLoadoutDraft('mhp3')).toEqual(before)
    await user.click(screen.getByRole('button', { name: '应用选择' }))
    const head: unknown = getLoadoutDraft('mhp3').loadout?.armor.head
    expect(head).toBeTruthy()
    expect((head as { armorKey?: string }).armorKey).toMatch(/^mhp3:armor:4:[1-4]$/)
  })

  it('offers the seven native charm grades in the charm drawer', async () => {
    const user = userEvent.setup()
    api.validateCharm.mockImplementation(async charm => ({ legality: 'confirmed', encoding: 'encodable', issues: [], ranges: [] }))
    render(page())
    await screen.findByRole('region', { name: '七槽装备与属性' })
    await user.click(screen.getByRole('button', { name: '选择护石' }))
    expect(await screen.findByRole('dialog', { name: '编辑护石' })).toBeTruthy()
    const trigger = screen.getAllByRole('button', { name: /品级|护石品级/ })[0]
    await user.click(trigger)
    for (const name of ['兵士护石', '斗士护石', '骑士护石', '城塞护石', '女王护石', '王之护石', '龙之护石']) {
      expect(await screen.findByRole('option', { name: new RegExp(name) })).toBeTruthy()
    }
  })
})
