// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { createEmptyLogicalLoadout, LOADOUT_SLOTS, type AutoLoadoutJobDetail, type AutoLoadoutJobSummary, type AutoLoadoutResult, type LoadoutArmor, type LoadoutCatalogSnapshot, type LoadoutFacets, type LoadoutWeapon, type LoadoutWeaponCandidate } from '../api/loadout/types'
import { AutoLoadoutDrawer } from '../ui/components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { AutoLoadoutHistoryDrawer } from '../ui/components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer'
import { AutoLoadoutJobProgress } from '../ui/components/AutoLoadoutJobProgress/AutoLoadoutJobProgress'
import { AutoLoadoutResultList } from '../ui/components/AutoLoadoutResultList/AutoLoadoutResultList'
import { EquipmentPickerDrawer } from '../ui/components/EquipmentPickerDrawer/EquipmentPickerDrawer'
import { LoadoutSlotIcon } from '../ui/components/LoadoutSlotIcon/LoadoutSlotIcon'
import { LoadoutWorkspaceDrawer } from '../ui/components/LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import { SearchableSelect } from '../ui/components/SearchableSelect/SearchableSelect'
afterEach(cleanup)
describe('LoadoutWorkspaceDrawer',()=>{it('uses one modal portal, styles fragment footer actions, focuses the first work control and closes with Escape',()=>{const close=vi.fn();const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();render(<LoadoutWorkspaceDrawer title="选择武器" onClose={close} footer={<><button type="button">取消</button><button type="button">应用</button></>}><button type="button">候选</button></LoadoutWorkspaceDrawer>);expect(screen.getByRole('dialog',{name:'选择武器'}).closest('.loadout-workspace-drawer')).toBeTruthy();expect(screen.getByRole('button',{name:'应用'}).classList.contains('loadout-workspace-drawer__footer-action')).toBe(true);expect(document.activeElement).toBe(screen.getByRole('button',{name:'候选'}));fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1)})})

describe('LoadoutWorkspaceDrawer with searchable controls',()=>{it('closes the select before the drawer when Escape is pressed',()=>{const close=vi.fn();render(<LoadoutWorkspaceDrawer title="编辑条件" onClose={close}><SearchableSelect ariaLabel="技能" value="a" options={[{value:'a',label:'攻击'}]} onChange={()=>{}} /></LoadoutWorkspaceDrawer>);fireEvent.click(screen.getByRole('button',{name:'技能'}));const search=screen.getByRole('combobox',{name:'技能关键词'});fireEvent.keyDown(search,{key:'Escape'});expect(close).not.toHaveBeenCalled();expect(screen.queryByRole('combobox',{name:'技能关键词'})).toBeNull()})})

describe('SearchableSelect scrolling', () => {
  it('keeps the portal menu open when its option list scrolls', () => {
    render(<SearchableSelect ariaLabel="护石技能" value="a" options={[{ value: 'a', label: '攻击' }, { value: 'b', label: '痛击' }]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '护石技能' }))
    fireEvent.scroll(screen.getByRole('listbox', { name: '护石技能' }))
    expect(screen.getByRole('combobox', { name: '护石技能关键词' })).toBeTruthy()
  })
})

describe('LoadoutSlotIcon', () => {
  it('provides all seven accessible fallback icons and uses an equipment image when available', () => {
    const view = render(<div>{LOADOUT_SLOTS.map(slot => <LoadoutSlotIcon key={slot} slot={slot} />)}<LoadoutSlotIcon slot="weapon" item={{ nameCn: '测试大剑', iconPath: 'weapon/test.png' }} /></div>)
    expect(view.container.querySelectorAll('.loadout-slot-icon__fallback')).toHaveLength(7)
    expect(screen.getByRole('img', { name: '武器：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '头部防具：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '胸部防具：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '腕部防具：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '腰部防具：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '腿部防具：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '护石：未选择' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '武器：测试大剑' }).querySelector('img')).toBeTruthy()
  })
})

describe('AutoLoadoutJobProgress', () => {
  const createdAt = new Date().toISOString()
  const summary = (overrides: Partial<AutoLoadoutJobSummary> = {}): AutoLoadoutJobSummary => ({ jobId: '6fc17f1c-3e57-45af-83cc-2ec32a79a66c', parentJobId: null, gameId: 'mh3g', dataVersion: 'test', status: 'running', createdAt, startedAt: createdAt, updatedAt: createdAt, completedAt: null, targets: [{ activationKey: 'test:10', skillId: 10, threshold: 10, nameCn: '测试发动' }], timeoutMs: 10_000, progress: { requestId: 'request', stage: '搜索候选', checked: 25, results: 2, elapsedMs: 5_000 }, resultCount: 2, error: null, selectedFingerprint: null, viewedAt: null, ...overrides })

  it('announces time-budget progress and leaves preparing progress indeterminate', () => {
    const view = render(<AutoLoadoutJobProgress job={summary()} />)
    const progress = screen.getByRole('progressbar', { name: '搜索时间预算' })
    expect(progress.getAttribute('aria-valuenow')).toBe('5000')
    expect(progress.getAttribute('aria-valuemax')).toBe('10000')
    expect(progress.getAttribute('aria-valuetext')).toMatch(/时间预算.*5.0 秒 \/ 10.0 秒/)
    view.rerender(<AutoLoadoutJobProgress job={summary({ status: 'queued', progress: { requestId: 'request', stage: '等待搜索', checked: 0, results: 0, elapsedMs: 0 } })} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull()
    expect(screen.getByRole('progressbar').getAttribute('data-indeterminate')).toBe('true')
  })
})

describe('AutoLoadoutJobProgress', () => {
  it('exposes determinate time-budget progress and indeterminate preparation state', () => {
    const createdAt = new Date().toISOString()
    const base: AutoLoadoutJobSummary = { jobId: '6fc17f1c-3e57-45af-83cc-2ec32a79a66c', parentJobId: null, gameId: 'mh3g', dataVersion: 'test', status: 'running', createdAt, startedAt: createdAt, updatedAt: createdAt, completedAt: null, targets: [], timeoutMs: 10_000, progress: { requestId: 'request', stage: '搜索组合', checked: 15, results: 2, elapsedMs: 4_000 }, resultCount: 2, error: null, selectedFingerprint: null, viewedAt: null }
    const view = render(<AutoLoadoutJobProgress job={base} />)
    const progressbar = screen.getByRole('progressbar', { name: '搜索时间预算' })
    expect(progressbar.getAttribute('aria-valuenow')).toBe('4000')
    expect(progressbar.getAttribute('aria-valuemax')).toBe('10000')
    expect(progressbar.getAttribute('aria-valuetext')).toMatch(/时间预算.*4.0 秒.*10.0 秒/)

    view.rerender(<AutoLoadoutJobProgress job={{ ...base, status: 'queued', progress: { ...base.progress!, stage: '等待搜索', elapsedMs: 0 } }} />)
    const waiting = screen.getByRole('progressbar', { name: '搜索时间预算' })
    expect(waiting.hasAttribute('aria-valuenow')).toBe(false)
    expect(waiting.getAttribute('data-indeterminate')).toBe('true')
  })
})

describe('AutoLoadoutDrawer', () => {
  it('restores persistent job state in React StrictMode and closing does not cancel it', async () => {
    const snapshot: LoadoutCatalogSnapshot = {
      gameId: 'mh3g',
      dataVersion: 'test',
      weapons: [],
      armors: [],
      decorations: [],
      skills: [{ skillId: 10, nameCn: '测试', nameEn: 'Test', nameJp: 'テスト', activations: [{ activationKey: 'test:10', skillId: 10, threshold: 10, direction: 'positive', nameCn: '测试发动' }] }],
      charmClasses: [],
      charmRanges: [],
      relicLookups: [],
    }
    const weapon: LoadoutWeapon = { kind: 'weapon', gameId: 'mh3g', candidateKey: 'weapon', sourceKind: 'catalog', weaponKey: 'weapon', templateKey: null, saveType: 1, saveId: 1, nameCn: '测试大剑', nameEn: 'Test GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked' }
    const loadout = createEmptyLogicalLoadout('mh3g', 'test')
    loadout.weapon = weapon
    const createdAt = new Date().toISOString()
    const summary = { jobId: '6fc17f1c-3e57-45af-83cc-2ec32a79a66c', parentJobId: null, gameId: 'mh3g' as const, dataVersion: 'test', status: 'completed' as const, createdAt, startedAt: createdAt, updatedAt: createdAt, completedAt: createdAt, targets: [{ activationKey: 'test:10', skillId: 10, threshold: 10, nameCn: '测试发动' }], timeoutMs: 12000, progress: { requestId: 'request', stage: '已完成', checked: 25, results: 0, elapsedMs: 500 }, resultCount: 0, error: null, selectedFingerprint: null, viewedAt: createdAt }
    const startAutoLoadout = vi.fn().mockResolvedValue(summary)
    const getAutoLoadoutJob = vi.fn().mockResolvedValue({ ...summary, request: { requestId: 'request', gameId: 'mh3g', dataVersion: 'test', baseLoadout: loadout, targets: summary.targets, resultLimit: 20, timeoutMs: 12000 }, results: [] })
    const controlAutoLoadoutJob = vi.fn()
    const close = vi.fn()
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { startAutoLoadout, listAutoLoadoutJobs: vi.fn().mockResolvedValue([]), getAutoLoadoutJob, controlAutoLoadoutJob, markAutoLoadoutJobViewed: vi.fn(), subscribeAutoLoadoutJobs: vi.fn(() => () => undefined), reconcileLoadout: vi.fn() } } })

    render(<StrictMode><AutoLoadoutDrawer snapshot={snapshot} loadout={loadout} calculation={calculateLoadout(snapshot, loadout)} onApply={vi.fn()} onClose={close} /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: '自动配装目标技能' }))
    fireEvent.click(screen.getByRole('option', { name: /测试发动/ }))
    fireEvent.click(screen.getByRole('button', { name: /完成/ }))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /开始搜索/ }))

    await waitFor(() => expect(startAutoLoadout).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 12000 })))
    await waitFor(() => expect(getAutoLoadoutJob).toHaveBeenCalledWith(summary.jobId))
    await waitFor(() => expect(screen.getAllByText(/已完成/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' }).at(-1)!)
    expect(close).toHaveBeenCalled()
    expect(controlAutoLoadoutJob).not.toHaveBeenCalled()
  })
})

describe('AutoLoadoutHistoryDrawer', () => {
  it('opens a persisted task and uses Escape as detail back before closing the drawer', async () => {
    const snapshot: LoadoutCatalogSnapshot = { gameId: 'mh3g', dataVersion: 'test', weapons: [], armors: [], decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }
    const baseLoadout = createEmptyLogicalLoadout('mh3g', 'test')
    const createdAt = new Date().toISOString()
    const summary: AutoLoadoutJobSummary = { jobId: '6fc17f1c-3e57-45af-83cc-2ec32a79a66c', parentJobId: null, gameId: 'mh3g', dataVersion: 'test', status: 'completed', createdAt, startedAt: createdAt, updatedAt: createdAt, completedAt: createdAt, targets: [{ activationKey: 'test:10', skillId: 10, threshold: 10, nameCn: '测试发动' }], timeoutMs: 10_000, progress: { requestId: 'request', stage: '已完成', checked: 25, results: 0, elapsedMs: 800 }, resultCount: 0, error: null, selectedFingerprint: null, viewedAt: null }
    const detail: AutoLoadoutJobDetail = { ...summary, request: { requestId: 'request', gameId: 'mh3g', dataVersion: 'test', baseLoadout, targets: summary.targets, resultLimit: 20, timeoutMs: 10_000 }, results: [] }
    const close = vi.fn()
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { listAutoLoadoutJobs: vi.fn().mockResolvedValue([summary]), getAutoLoadoutJob: vi.fn().mockResolvedValue(detail), markAutoLoadoutJobViewed: vi.fn().mockResolvedValue(undefined), subscribeAutoLoadoutJobs: vi.fn(() => () => undefined), controlAutoLoadoutJob: vi.fn(), retryAutoLoadoutJob: vi.fn(), deleteAutoLoadoutJobs: vi.fn(), reconcileLoadout: vi.fn(), selectAutoLoadoutJobResult: vi.fn() } } })

    render(<AutoLoadoutHistoryDrawer gameId="mh3g" snapshot={snapshot} onApply={vi.fn()} onClose={close} />)
    const task = await screen.findByRole('button', { name: /测试发动.*MH3G/ })
    fireEvent.click(task)
    await screen.findByRole('dialog', { name: '自动任务详情' })
    const resultTab = screen.getByRole('tab', { name: '结果 (0)' })
    fireEvent.keyDown(resultTab, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: '进度' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByRole('dialog', { name: '自动任务历史' })).toBeTruthy()
    expect(close).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })
})

describe('EquipmentPickerDrawer', () => {
  it('applies a valid paged equipment candidate on double click', async () => {
    const candidate: LoadoutWeaponCandidate = { kind: 'weapon', gameId: 'mh3g', candidateKey: 'weapon:1', sourceKind: 'catalog', weaponKey: 'weapon:1', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试大剑', nameEn: 'Test GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 2, attack: 100, affinity: 0, defense: 0, iconPath: null }
    const facets: LoadoutFacets = { skills: [], weaponTypes: [{ typeId: 1, nameCn: '大剑' }], weaponRarities: [1], armorRarities: [], charmClasses: [] }
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { searchWeapons: vi.fn().mockResolvedValue({ items: [candidate], page: 1, pageSize: 100, total: 1, hasNext: false }), searchArmors: vi.fn() } } })
    const onApply = vi.fn()
    render(<EquipmentPickerDrawer gameId="mh3g" slot="weapon" facets={facets} relicLookups={[]} onApply={onApply} onClose={vi.fn()} />)
    await screen.findByRole('button', { name: /测试大剑/ })
    fireEvent.doubleClick(screen.getByRole('button', { name: /测试大剑/ }))
    expect(onApply).toHaveBeenCalledWith(candidate)
  })
})

describe('AutoLoadoutResultList', () => {
  const snapshot: LoadoutCatalogSnapshot = { gameId: 'mh3g', dataVersion: 'test', weapons: [], armors: [], decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }
  const result = (fingerprint: string, defense: number, slots: number): AutoLoadoutResult => {
    const loadout = createEmptyLogicalLoadout('mh3g', 'test')
    const armor: LoadoutArmor = { kind: 'armor', gameId: 'mh3g', candidateKey: fingerprint, sourceKind: 'catalog', dexId: defense, templateKey: null, saveType: 5, saveId: defense, nameCn: `${fingerprint}头`, nameEn: fingerprint, part: 'head', combat: 'both', gender: 'both', rarity: 1, slots, baseDefense: defense, maxDefense: defense + 10, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, iconPath: null, skills: [], decorations: [], lock: 'unlocked' }
    loadout.armor.head = armor
    return { fingerprint, loadout, calculation: calculateLoadout(snapshot, loadout) }
  }

  it('renders one seven-slot table per result and sorts by defense or remaining slots', async () => {
    const highDefense = result('high-defense', 80, 0)
    const highSlots = result('high-slots', 20, 3)
    const view = render(<AutoLoadoutResultList results={[highSlots, highDefense]} onSelect={() => {}} />)
    expect(view.getAllByRole('table')).toHaveLength(2)
    expect(view.getAllByRole('row')).toHaveLength(16)

    fireEvent.click(view.getByRole('button', { name: '自动配装结果排序' }))
    fireEvent.click(screen.getByRole('option', { name: '防御力降序' }))
    expect(view.container.querySelector('article')?.textContent).toContain('high-defense头')

    fireEvent.click(view.getByRole('button', { name: '自动配装结果排序' }))
    fireEvent.click(screen.getByRole('option', { name: '剩余孔数降序' }))
    expect(view.container.querySelector('article')?.textContent).toContain('high-slots头')
  })
})
