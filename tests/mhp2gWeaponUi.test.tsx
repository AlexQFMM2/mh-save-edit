// @vitest-environment jsdom
// All labels, identities and values below are synthetic.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { P2gWeaponDetail, P2gWeaponFacets } from '../api/catalog/p2gWeaponTypes'
import type { CatalogItemDetail } from '../api/catalog/types'
import { p2gWeaponFiltersSchema } from '../api/catalog/p2gWeaponSchemas'
import { WeaponCatalogPage } from '../ui/pages/WeaponCatalogPage/WeaponCatalogPage'
import { ItemCatalogPage } from '../ui/pages/ItemCatalogPage/ItemCatalogPage'
import { WeaponDetailPanel } from '../ui/components/WeaponDetailPanel/WeaponDetailPanel'
import { catalogWeaponDetail, catalogWeaponSummary, parseCatalogWeaponKey } from '../ui/utils/catalogWeapon'
import { weaponSharpnessStages } from '../ui/utils/weaponCatalog'
import { gameVersions } from '../ui/data/gameVersions'

vi.mock('../ui/components/WeaponTreeCanvas/WeaponTreeCanvas', () => ({ WeaponTreeCanvas: ({ tree, onSelect }: any) => <div aria-label="模拟派生画布">{tree.nodes.map((w: any) => <button key={w.weaponKey} onClick={() => onSelect(w.weaponKey)}>{w.nameCn}</button>)}</div> }))
const first: P2gWeaponDetail = {
  gameId: 'mhp2g', weaponKey: 'weapon_blademaster:1', nativeTable: 'weapon_blademaster', nativeIndex: 1, typeId: 1, typeNameCn: '大剑', typeNameEn: 'Great Sword', kind: 'standardMelee', nameCn: '合成大剑甲', nameJp: 'テスト甲', nameEn: '', rarity: 2, displayAttack: 240, trueRawAttack: 50, affinity: -10, defense: 0, slots: 1, attributes: [], sharpness: { base: [10, 10, 10, 10, 0, 0, 0], handicraft: [10, 10, 10, 15, 5, 0, 0] }, isDirectlyProducible: true, isFinalForm: false, iconPath: '', nameSource: 'synthetic', nativeRowSha256: 'a'.repeat(64), raw: {}, special: { kind: 'standardMelee' }, parents: [], children: [],
  recipes: [1, 2].map(i => ({ recipeKey: `synthetic:${i}`, kind: 'production', cost: 100 * i, materials: [{ gameId: 'mhp2g', itemId: i, nameCn: `合成材料${i}`, nameJp: `材料${i}`, nameEn: '', quantity: i, position: 0 }], outputs: [{ gameId: 'mhp2g', weaponKey: 'weapon_blademaster:1', typeId: 1, nameCn: '合成大剑甲', nameJp: 'テスト甲', nameEn: '', rngModulo100Range: null }] })),
}
const second = { ...first, weaponKey: 'weapon_blademaster:2', nativeIndex: 2, nameCn: '合成大剑乙' }
const cross = { ...first, weaponKey: 'weapon_blademaster:3', nativeIndex: 3, nameCn: '合成太刀', typeId: 2, typeNameCn: '太刀' }
const facets: P2gWeaponFacets = { weaponTypes: [1, 2].map(typeId => ({ typeId, nativeClassId: typeId - 1, nameCn: typeId === 1 ? '大剑' : '太刀', nameEn: typeId === 1 ? 'Great Sword' : 'Long Sword', kind: 'standardMelee', sortOrder: typeId })), attributes: [], rarities: [2], slots: [1], sharpnessStages: ['base', 'handicraft1'] }
const item: CatalogItemDetail = { gameId: 'mhp2g', itemId: 1, nameCn: '合成材料1', nameEn: '', nameJp: '材料1', dexId: null, rarity: 1, maxStack: 99, iconPath: null, isPlaceholder: false, sellPrice: null, buyPrice: null, hexId: null, mappingStatus: 'synthetic', relations: [], weaponRecipes: first.recipes.slice(0, 1) }
const api = { searchWeapons: vi.fn(), getWeapon: vi.fn(), getWeaponFacets: vi.fn(), getWeaponTree: vi.fn(), getItem: vi.fn(), searchItems: vi.fn(), getItemFacets: vi.fn() }
beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset())
  api.searchWeapons.mockImplementation(async filters => { p2gWeaponFiltersSchema.parse(filters); return { items: [first, second], page: filters.page || 1, pageSize: 100, total: 201, hasNext: true } })
  api.getWeapon.mockImplementation(async ({ weaponKey }) => [first, second, cross].find(w => w.weaponKey === weaponKey) || null)
  api.getWeaponFacets.mockResolvedValue(facets)
  api.getWeaponTree.mockImplementation(async (_game, typeId) => ({ gameId: 'mhp2g', weaponTypeId: typeId, dataVersion: 'synthetic', nodes: [first, cross].map(w => ({ ...w, isCrossType: w.typeId !== typeId })), edges: [] }))
  api.getItem.mockResolvedValue(item)
  api.searchItems.mockResolvedValue({ items: [item], page: 1, pageSize: 100, total: 1, hasNext: false })
  api.getItemFacets.mockResolvedValue({ rarities: [1], maxStacks: [99], relations: [] })
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: api } })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(window, 'mhSaveEditor') })
function mount(search = '?view=list&type=1&weapon=weapon_blademaster%3A1') {
  function Location() { const loc = useLocation(); return <output data-testid="location">{loc.pathname}{loc.search}</output> }
  render(<MemoryRouter initialEntries={['/game/mhp2g/catalog/weapons' + search]}><Location /><Routes><Route element={<Outlet context={{ game: gameVersions[0] }} />}><Route path="/game/mhp2g/catalog/weapons" element={<WeaponCatalogPage />} /><Route path="/game/mhp2g/catalog/items" element={<ItemCatalogPage />} /></Route></Routes></MemoryRouter>)
}
describe('P2G shared weapon page', () => {
  it('keeps native identities separate and preserves both exact sharpness arrays', () => {
    const w = catalogWeaponSummary(first)
    expect(w).not.toHaveProperty('saveId'); expect(w).not.toHaveProperty('saveType')
    const stages = weaponSharpnessStages(w.sharpness!, 'mhp2g')
    expect(stages.map(s => [s.label, Object.values(s.segments)])).toEqual([['基础', first.sharpness!.base], ['匠', first.sharpness!.handicraft]])
    expect(parseCatalogWeaponKey(first.weaponKey, 'mhp2g')).toBe(first.weaponKey)
    expect(parseCatalogWeaponKey('7:1', 'mhp2g')).toBeUndefined()
    expect(parseCatalogWeaponKey(first.weaponKey, 'mhgu')).toBeUndefined()
  })
  it('restores native filters and selection from URL without sending later-game fields', async () => {
    mount('?view=list&type=1&weapon=weapon_blademaster%3A2&sort=nativeId&direction=desc&rarity=2&slots=1&hidden=1&debug=1')
    await screen.findByRole('heading', { name: second.nameCn })
    expect(api.getWeapon).toHaveBeenCalledWith({ gameId: 'mhp2g', weaponKey: second.weaponKey })
    const filters = api.searchWeapons.mock.calls[0][0]
    expect(filters).toMatchObject({ gameId: 'mhp2g', sort: 'nativeId', direction: 'desc', rarity: 2, slots: 1 })
    expect(filters.directlyProducible).toBeUndefined(); expect(filters).not.toHaveProperty('includeHiddenAttributes'); expect(filters).not.toHaveProperty('includePlaceholders')
    expect(screen.queryByText('包含觉醒')).toBeNull(); expect(screen.queryByText('占位条目')).toBeNull()
    expect(screen.queryByText(/写入存档|Dex|存档顺序/)).toBeNull()
    expect(screen.getAllByText('原始会心')).toHaveLength(2)
  })
  it('changes selection without repeating list searches and paginates explicitly', async () => {
    mount(); await screen.findByRole('heading', { name: first.nameCn })
    expect(api.searchWeapons).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('option', { name: new RegExp(second.nameCn) }))
    await screen.findByRole('heading', { name: second.nameCn })
    expect(api.searchWeapons).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(api.searchWeapons).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  })
  it('changes selection without reloading the tree and follows cross-type nodes', async () => {
    mount('?view=tree&type=1&weapon=weapon_blademaster%3A1')
    await screen.findByLabelText('模拟派生画布')
    fireEvent.click(within(screen.getByLabelText('模拟派生画布')).getByRole('button', { name: first.nameCn }))
    expect(api.getWeaponTree).toHaveBeenCalledTimes(1)
    fireEvent.click(within(screen.getByLabelText('模拟派生画布')).getByRole('button', { name: cross.nameCn }))
    await waitFor(() => expect(api.getWeaponTree).toHaveBeenLastCalledWith('mhp2g', 2))
    await screen.findByRole('heading', { name: cross.nameCn })
    expect(screen.getByTestId('location').textContent).toContain('type=2')
  })
  it('includes material matches beyond page one in the tree count', async () => {
    const values = Array.from({ length: 101 }, (_, index) => ({ ...first, nativeIndex: index + 1, weaponKey: `weapon_blademaster:${index + 1}`, matchReason: '命中：生产材料·合成材料1' }))
    api.searchWeapons.mockImplementation(async filters => ({ items: values.slice((filters.page - 1) * 100, filters.page * 100), page: filters.page, pageSize: 100, total: values.length, hasNext: filters.page === 1 }))
    api.getWeaponTree.mockResolvedValue({ gameId: 'mhp2g', weaponTypeId: 1, dataVersion: 'synthetic-material', nodes: values.map(w => ({ ...w, matchReason: undefined, isCrossType: false })), edges: [] })
    mount('?view=tree&type=1&q=合成材料1')
    await screen.findByText('101 把')
    expect(api.searchWeapons).toHaveBeenCalledTimes(2)
    expect(api.searchWeapons).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, query: '合成材料1' }))
    expect(api.getWeaponTree).toHaveBeenCalledTimes(1)
  })
  it('groups alternative recipes and closes the item drawer before locating a weapon', async () => {
    mount(); await screen.findByRole('heading', { name: first.nameCn })
    expect(screen.getAllByText('任选一组材料')).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: '生产配方 1' })).getByText('合成材料1')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '生产配方 2' })).getByText('合成材料2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '合成材料1' }))
    const dialog = await screen.findByRole('dialog', { name: '关联道具' })
    await within(dialog).findByRole('heading', { name: item.nameCn })
    expect(api.getItem).toHaveBeenCalledWith({ gameId: 'mhp2g', itemId: 1 })
    fireEvent.click(within(dialog).getByText(/武器用途与配方/))
    fireEvent.click(within(dialog).getByRole('button', { name: first.nameCn }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('location').textContent).toContain('target=weapon_blademaster%3A1')
  })
  it('opens a weapon drawer for body relations and closes before locating another object', async () => {
    api.getWeapon.mockResolvedValueOnce({ ...first, children: [{ ...cross }] })
    mount(); await screen.findByRole('heading', { name: first.nameCn })
    fireEvent.click(screen.getByRole('button', { name: cross.nameCn }))
    const dialog = await screen.findByRole('dialog', { name: '关联武器' })
    await within(dialog).findByRole('heading', { name: cross.nameCn })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.click(within(dialog).getByRole('button', { name: '合成材料1' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('location').textContent).toContain('/catalog/items?target=1&item=1')
  })
  it('traps focus through collapsed recipe summaries and Escape restores the trigger', async () => {
    mount(); await screen.findByRole('heading', { name: first.nameCn })
    const trigger = screen.getByRole('button', { name: '合成材料1' })
    trigger.focus(); fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: '关联道具' })
    await within(dialog).findByRole('heading', { name: item.nameCn })
    const summary = within(dialog).getByText(/武器用途与配方/)
    summary.focus(); fireEvent.keyDown(summary, { key: 'Tab' })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '关闭关联道具' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
  it('renders applicable ranged fields without inventing steadiness, siege or shot mode', () => {
    const special: P2gWeaponDetail['special'] = { kind: 'bowgun', weaponKind: 'heavy', reloadRaw: 2, recoilRaw: 4, ammo: [{ ammoIndex: 0, code: 'synthetic', item: { gameId: 'mhp2g', itemId: 1, nameCn: '合成弹', nameJp: '', nameEn: '' }, available: false, capacityTemplate: 6, loadQuantity: null }], rapidFire: [] }
    render(<WeaponDetailPanel gameId="mhp2g" weapon={catalogWeaponDetail({ ...first, sharpness: null, kind: 'bowgun', special })} loading={false} sharpnessStage="base" />)
    expect(screen.getByText('装填与弹种')).toBeTruthy(); expect(screen.getByText('普通')).toBeTruthy(); expect(screen.getByText('小')).toBeTruthy()
    expect(screen.queryByText(/蹲射|偏移|射击模式/)).toBeNull()
    fireEvent.click(screen.getByLabelText('显示不可装填弹种'))
    expect(screen.getByText('不可装填')).toBeTruthy(); expect(screen.getByText(/容量模板 6/)).toBeTruthy()
    expect(screen.queryByText('6 发')).toBeNull()
  })
  it('shows a two-stage bow with only the third charge unlocked by Load Up', () => {
    const special: P2gWeaponDetail['special'] = { kind: 'bow', baseChargeCount: 2, loadUpChargeCount: 3, coatingMaskRaw: 0, charges: [1, 2, 3, 4].map(level => ({ level, typeCode: 'rapid', shotLevel: 1, available: level <= 3, requiresLoadUp: level === 3 })), coatings: [] }
    render(<WeaponDetailPanel gameId="mhp2g" weapon={catalogWeaponDetail({ ...first, kind: 'bow', sharpness: null, special })} loading={false} sharpnessStage="base" />)
    expect(screen.getByText('2 段')).toBeTruthy(); expect(screen.getByText('3 段')).toBeTruthy()
    expect(screen.getAllByText('需要装填数 UP')).toHaveLength(1); expect(screen.getByText('不可用')).toBeTruthy()
  })
  it('retains unknown horn timings and exposes native note order in the expanded song', () => {
    const special: P2gWeaponDetail['special'] = { kind: 'huntingHorn', notes: [1, 3, 5], songs: [{ patternIndex: 0, effectIndex: 0, notes: [1, 3, 5], nativePatternNewestFirst: [5, 3, 1, 0], effectNameJp: '攻撃力強化【小】', duration: null, repeatEffect: null, skillDuration: null }] }
    render(<WeaponDetailPanel gameId="mhp2g" weapon={catalogWeaponDetail({ ...first, kind: 'huntingHorn', special })} loading={false} sharpnessStage="base" />)
    fireEvent.click(screen.getByRole('button', { name: '展开旋律（1）' }))
    expect(screen.getByText('白 → 蓝 → 红')).toBeTruthy()
    expect(screen.getByText('攻击力强化【小】').title).toBe('攻撃力強化【小】')
    expect(screen.getByText(/持续时间：未知.*重复演奏效果：未知/)).toBeTruthy()
    expect(screen.queryByText(/重奏|审校|synthetic/)).toBeNull()
  })
  it('renders Chinese gunlance shelling in the detail panel', () => {
    render(<WeaponDetailPanel gameId="mhp2g" weapon={catalogWeaponDetail({ ...first, special: { kind: 'gunlance', shelling: { typeJa: '拡散', level: 3 } } })} loading={false} sharpnessStage="base" />)
    expect(screen.getByText('扩散')).toBeTruthy()
    expect(screen.queryByText('拡散')).toBeNull()
  })
  it('reports the missing weapon delivery while leaving the page responsive', async () => {
    api.getWeaponFacets.mockRejectedValue(new Error('P2G 武器资料尚未安装'))
    api.searchWeapons.mockRejectedValue(new Error('P2G 武器资料尚未安装'))
    mount('?view=tree')
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'P2G 武器资料尚未安装')
    expect(screen.getByLabelText('搜索武器')).toBeTruthy()
  })
})
