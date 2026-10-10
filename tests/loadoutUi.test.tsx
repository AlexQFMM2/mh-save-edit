// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { calculateLoadout } from '../api/loadout/calculator'
import { createEmptyLogicalLoadout, LOADOUT_SLOTS, type AutoLoadoutJobDetail, type AutoLoadoutJobSummary, type AutoLoadoutResult, type LoadoutArmor, type LoadoutCatalogSnapshot, type LoadoutFacets, type LoadoutRelicLookup, type LoadoutWeapon, type LoadoutWeaponCandidate } from '../api/loadout/types'
import { AutoLoadoutDrawer } from '../ui/components/AutoLoadoutDrawer/AutoLoadoutDrawer'
import { AutoLoadoutHistoryDrawer } from '../ui/components/AutoLoadoutHistoryDrawer/AutoLoadoutHistoryDrawer'
import { AutoLoadoutJobProgress } from '../ui/components/AutoLoadoutJobProgress/AutoLoadoutJobProgress'
import { AutoLoadoutResultList } from '../ui/components/AutoLoadoutResultList/AutoLoadoutResultList'
import { EquipmentPickerDrawer } from '../ui/components/EquipmentPickerDrawer/EquipmentPickerDrawer'
import { LoadoutSlotIcon } from '../ui/components/LoadoutSlotIcon/LoadoutSlotIcon'
import { LoadoutSaveWriteDrawer } from '../ui/components/LoadoutSaveWriteDrawer/LoadoutSaveWriteDrawer'
import { LoadoutWorkspaceDrawer } from '../ui/components/LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import { RelicEquipmentEditor } from '../ui/components/RelicEquipmentEditor/RelicEquipmentEditor'
import { RelicLookupSelect } from '../ui/components/RelicLookupSelect/RelicLookupSelect'
import { SearchableSelect } from '../ui/components/SearchableSelect/SearchableSelect'
import { SaveEquipmentEditorDrawer } from '../ui/components/SaveEquipmentEditorDrawer/SaveEquipmentEditorDrawer'
afterEach(cleanup)
describe('LoadoutWorkspaceDrawer',()=>{it('uses one modal portal, styles fragment footer actions, focuses the first work control and closes with Escape',()=>{const close=vi.fn();const trigger=document.createElement('button');document.body.append(trigger);trigger.focus();render(<LoadoutWorkspaceDrawer title="选择武器" onClose={close} footer={<><button type="button">取消</button><button type="button">应用</button></>}><button type="button">候选</button></LoadoutWorkspaceDrawer>);expect(screen.getByRole('dialog',{name:'选择武器'}).closest('.loadout-workspace-drawer')).toBeTruthy();expect(screen.getByRole('button',{name:'应用'}).classList.contains('workspace-drawer__footer-action')).toBe(true);expect(document.activeElement).toBe(screen.getByRole('button',{name:'候选'}));fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1)})})

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

describe('LoadoutSaveWriteDrawer', () => {
  it('shows capacity and exact destinations before confirming a whole-loadout write', () => {
    const apply = vi.fn()
    const close = vi.fn()
    render(<LoadoutSaveWriteDrawer busy={false} preview={{ capacity: 1400, nonEmptyCount: 27, requiredSlots: 2, targets: [
      { loadoutSlot: 'weapon', nameCn: '测试大剑', slot: 28, page: 1, cell: 29 },
      { loadoutSlot: 'charm', nameCn: '天之护石', slot: 103, page: 2, cell: 4 },
    ] }} onApply={apply} onClose={close} />)
    expect(screen.getByText('27 格')).toBeTruthy()
    expect(screen.getByText('第 1 页第 29 格')).toBeTruthy()
    expect(screen.getByText('第 2 页第 4 格')).toBeTruthy()
    expect(screen.getByText(/仍需在修改器页面点击保存/)).toBeTruthy()
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认加入' }))
    expect(apply).toHaveBeenCalledOnce()
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

    render(<AutoLoadoutHistoryDrawer gameId="mh3g" snapshot={snapshot} onApply={vi.fn()} onCopyConditions={vi.fn()} onClose={close} />)
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
  it('only applies a valid paged candidate through the footer, not keyboard or double click', async () => {
    const candidate: LoadoutWeaponCandidate = { kind: 'weapon', gameId: 'mh3g', candidateKey: 'weapon:1', sourceKind: 'catalog', weaponKey: 'weapon:1', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试大剑', nameEn: 'Test GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 2, attack: 100, affinity: 0, defense: 0, iconPath: null }
    const facets: LoadoutFacets = { skills: [], weaponTypes: [{ typeId: 1, nameCn: '大剑' }], weaponRarities: [1], armorRarities: [], charmClasses: [] }
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { searchWeapons: vi.fn().mockResolvedValue({ items: [candidate], page: 1, pageSize: 100, total: 1, hasNext: false }), searchArmors: vi.fn() }, catalog: { getWeapon: vi.fn().mockResolvedValue(null) } } })
    const onApply = vi.fn()
    render(<EquipmentPickerDrawer gameId="mh3g" slot="weapon" facets={facets} relicLookups={[]} decorations={[]} onApply={onApply} onClose={vi.fn()} />)
    await screen.findByRole('button', { name: /测试大剑/ })
    const row = screen.getByRole('button', { name: /测试大剑/ })
    fireEvent.keyDown(row, { key: 'Enter' }); fireEvent.keyDown(row, { key: ' ' }); fireEvent.doubleClick(row)
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
    expect(onApply).toHaveBeenCalledWith(candidate)
  })

  it('loads advanced relic options only after a relic template is selected', async () => {
    const candidate: LoadoutWeaponCandidate = { kind: 'weapon', gameId: 'mh4g', candidateKey: 'relic:w:7:1', sourceKind: 'relicTemplate', weaponKey: null, templateKey: 'w:7:1', saveType: 7, saveId: 1, nameCn: '发掘大剑', nameEn: 'Relic GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 110, affinity: 0, defense: 0, iconPath: null, instance: { source: 'catalogTemplate', recordHex: '00'.repeat(28), legality: 'unknown', encoding: 'encodable', issues: [] } }
    const facets: LoadoutFacets = { skills: [], weaponTypes: [{ typeId: 1, nameCn: '大剑' }], weaponRarities: [1], armorRarities: [], charmClasses: [] }
    const lookups: LoadoutRelicLookup[] = [
      { kind: 'equipment_lookup', key: 'attack_tier:7:melee:0', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 0, name_cn: '110 | |', name_en: '110 | |' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack_tier:7:melee:3', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 3, name_cn: '140 | |', name_en: '140 | |' }, source: 'test' },
    ]
    const getRelicLookups = vi.fn().mockResolvedValue(lookups)
    const onApply = vi.fn()
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { searchWeapons: vi.fn().mockResolvedValue({ items: [candidate], page: 1, pageSize: 100, total: 1, hasNext: false }), searchArmors: vi.fn(), getRelicLookups } } })

    render(<EquipmentPickerDrawer gameId="mh4g" slot="weapon" facets={facets} relicLookups={[]} decorations={[]} onApply={onApply} onClose={vi.fn()} />)
    const row = await screen.findByRole('button', { name: /发掘大剑/ })
    expect(getRelicLookups).not.toHaveBeenCalled()
    fireEvent.click(row)
    await screen.findByText('发掘装备高级编辑')
    expect(getRelicLookups).toHaveBeenCalledWith('mh4g')
    fireEvent.click(screen.getByRole('button', { name: '攻击档' }))
    fireEvent.click(screen.getByRole('option', { name: '攻击 140' }))
    fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
    const applied = onApply.mock.calls.at(-1)?.[0] as LoadoutWeaponCandidate
    expect(applied.instance?.recordHex.slice(26, 28)).toBe('03')
  })
})

describe('RelicEquipmentEditor', () => {
  it('uses named searchable choices and preserves hidden record bytes', () => {
    const candidate: LoadoutWeaponCandidate = { kind: 'weapon', gameId: 'mh4g', candidateKey: 'relic:w:7:1', sourceKind: 'relicTemplate', weaponKey: null, templateKey: 'w:7:1', saveType: 7, saveId: 1, nameCn: '发掘大剑', nameEn: 'Relic GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 110, affinity: 0, defense: 0, iconPath: null, instance: { source: 'catalogTemplate', recordHex: `${'ab'.repeat(13)}00${'cd'.repeat(14)}`, legality: 'unknown', encoding: 'encodable', issues: [] } }
    const lookups: LoadoutRelicLookup[] = [
      { kind: 'equipment_lookup', key: 'attack:0', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 0, name_cn: '110 | |', name_en: '110 | |' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:3', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 3, name_cn: '140 | |', name_en: '140 | |' }, source: 'test' },
    ]
    const onChange = vi.fn()
    render(<RelicEquipmentEditor candidate={candidate} lookups={lookups} decorations={[]} onChange={onChange} />)
    expect(screen.queryByDisplayValue(candidate.instance!.recordHex)).toBeNull()
    expect(screen.queryByText(/0x[0-9a-f]/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '攻击档' }))
    fireEvent.click(screen.getByRole('option', { name: '攻击 140' }))
    const changed = onChange.mock.calls.at(-1)?.[0] as LoadoutWeaponCandidate
    expect(changed.instance?.recordHex.slice(26, 28)).toBe('03')
    expect(changed.instance?.recordHex.slice(0, 26)).toBe(candidate.instance!.recordHex.slice(0, 26))
    expect(changed.instance?.recordHex.slice(28)).toBe(candidate.instance!.recordHex.slice(28))
  })
})

describe('SaveEquipmentEditorDrawer', () => {
  it('preserves a catalog weapon native save level when replacing a save-box entry', async () => {
    const candidate: LoadoutWeaponCandidate = { kind: 'weapon', gameId: 'mhgu', candidateKey: 'catalog:greatsword:7:2:3', sourceKind: 'catalog', weaponKey: 'greatsword:7:2:3', templateKey: null, saveType: 7, saveId: 2, saveLevel: 3, nameCn: '强化测试大剑', nameEn: 'Upgraded Test GS', typeId: 1, typeNameCn: '大剑', rarity: 3, slots: 1, attack: 120, affinity: 0, defense: 0, iconPath: null }
    const bootstrap = { gameId: 'mhgu' as const, dataVersion: 'test', decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }
    const facets: LoadoutFacets = { skills: [], weaponTypes: [{ typeId: 1, nameCn: '大剑' }], weaponRarities: [3], armorRarities: [], charmClasses: [] }
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { getBootstrap: vi.fn().mockResolvedValue(bootstrap), getFacets: vi.fn().mockResolvedValue(facets), searchWeapons: vi.fn().mockResolvedValue({ items: [candidate], page: 1, pageSize: 100, total: 1, hasNext: false }), searchArmors: vi.fn() }, catalog: { getWeapon: vi.fn().mockResolvedValue(null) } } })
    const apply = vi.fn().mockResolvedValue(undefined)
    render(<SaveEquipmentEditorDrawer gameId="mhgu" domain="hunter-equipment" cell={{ slot: 0, empty: false, kind: 'weapon', saveType: 7, saveId: 1, level: 0, slots: null, appearanceId: null, decorations: [0, 0, 0], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, nameCn: '测试大剑', nameEn: 'Test GS', typeNameCn: '大剑', iconPath: null, weaponKey: 'greatsword:7:1:0', armorDexId: null, palicoEquipmentId: null, decorationLabels: [], skill1NameCn: null, skill2NameCn: null, recordHex: '00'.repeat(36), diagnostics: [] }} onApply={apply} onApplyRecord={vi.fn().mockResolvedValue(undefined)} onClose={vi.fn()} />)
    const row = await screen.findByRole('button', { name: /强化测试大剑/ })
    fireEvent.click(row)
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '应用选择' }))
    await waitFor(() => expect(apply).toHaveBeenCalledWith(expect.objectContaining({ reset: true, saveType: 7, saveId: 2, level: 3 })))
  })

  it('does not expose instance editing for an empty equipment cell', () => {
    const bootstrap = { gameId: 'mhgu' as const, dataVersion: 'test', decorations: [], skills: [], charmClasses: [], charmRanges: [], relicLookups: [] }
    const facets: LoadoutFacets = { skills: [], weaponTypes: [], weaponRarities: [], armorRarities: [], charmClasses: [] }
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { loadout: { getBootstrap: vi.fn().mockResolvedValue(bootstrap), getFacets: vi.fn().mockResolvedValue(facets), searchWeapons: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, hasNext: false }), searchArmors: vi.fn() }, catalog: { getWeapon: vi.fn().mockResolvedValue(null) } } })
    render(<SaveEquipmentEditorDrawer gameId="mhgu" domain="hunter-equipment" cell={{ slot: 0, empty: true, kind: 'empty', saveType: 0, saveId: 0, level: 0, slots: null, appearanceId: null, decorations: [0, 0, 0], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, nameCn: '空格', nameEn: '', typeNameCn: '空格', iconPath: null, weaponKey: null, armorDexId: null, palicoEquipmentId: null, decorationLabels: [], skill1NameCn: null, skill2NameCn: null, recordHex: '00'.repeat(36), diagnostics: [] }} onApply={vi.fn().mockResolvedValue(undefined)} onApplyRecord={vi.fn().mockResolvedValue(undefined)} onClose={vi.fn()} />)
    const edit = screen.getByRole('button', { name: '编辑实例' }) as HTMLButtonElement
    expect(edit.disabled).toBe(true)
    expect(edit.title).toMatch(/空格没有可编辑的实例/)
  })
})

describe('RelicLookupSelect', () => {
  it('orders attack choices by displayed attack, affinity and defense values', () => {
    const lookups: LoadoutRelicLookup[] = [
      { kind: 'equipment_lookup', key: 'attack:20', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 20, name_cn: '340 | -25% |', name_en: '340 | -25% |' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:28', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 28, name_cn: '255 | +75% | DEF+25', name_en: '255 | +75% | DEF+25' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:2', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 2, name_cn: '130 | +10% |', name_en: '130 | +10% |' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:19', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 19, name_cn: '310 | | DEF+5', name_en: '310 | | DEF+5' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:91', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 91, name_cn: '355 | | DEF+100', name_en: '355 | | DEF+100' }, source: 'test' },
      { kind: 'equipment_lookup', key: 'attack:0', payload: { domain: 'attack_tier', save_type: 7, variant: 'melee', code: 0, name_cn: '110 | |', name_en: '110 | |' }, source: 'test' },
    ]
    render(<RelicLookupSelect lookups={lookups} domain="attack_tier" saveType={7} variant="melee" value={0} ariaLabel="攻击档" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '攻击档' }))
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      '攻击 110',
      '攻击 130 · 会心 +10%',
      '攻击 255 · 会心 +75% · 防御 +25',
      '攻击 310 · 防御 +5',
      '攻击 340 · 会心 -25%',
      '攻击 355 · 防御 +100',
    ])
  })

  it('renders all melee sharpness choices as accessible seven-color bars and keeps the special mapping explicit', () => {
    const lookups: LoadoutRelicLookup[] = [...Array.from({ length: 22 }, (_, code) => ({
      kind: 'equipment_lookup' as const,
      key: `sharpness:${code}`,
      payload: { domain: 'sharpness', save_type: 7, variant: 'melee', code, name_cn: String(code), name_en: String(code) },
      source: 'test',
    })), {
      kind: 'equipment_lookup',
      key: 'sharpness:218',
      payload: { domain: 'sharpness', save_type: 7, variant: 'melee', code: 218, name_cn: 'special', name_en: 'special' },
      source: 'test',
    }]
    const onChange = vi.fn()
    render(<RelicLookupSelect lookups={lookups} domain="sharpness" saveType={7} variant="melee" value={21} ariaLabel="斩味配置" onChange={onChange} />)

    expect(screen.getByRole('img', { name: /方案 22；红 95、橙 80.*紫 25；合计 450\/450/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '斩味配置' }))
    expect(screen.getAllByRole('option')).toHaveLength(23)
    expect(screen.getAllByRole('img')).toHaveLength(24)
    fireEvent.change(screen.getByRole('combobox', { name: '斩味配置关键词' }), { target: { value: '紫 215' } })
    const special = screen.getByRole('option', { name: /特殊方案.*推定映射，待实机确认/ })
    expect(special.textContent).toContain('推定映射')
    fireEvent.click(special)
    expect(onChange).toHaveBeenCalledWith(218)
  })

  it('does not draw a sharpness bar for ranged configuration domains', () => {
    const lookups: LoadoutRelicLookup[] = [{ kind: 'equipment_lookup', key: 'magazine:0', payload: { domain: 'sharpness', save_type: 7, variant: 'light_bowgun', code: 0, name_cn: '0', name_en: '0' }, source: 'test' }]
    render(<RelicLookupSelect lookups={lookups} domain="sharpness" saveType={7} variant="light_bowgun" value={0} ariaLabel="弹匣配置" onChange={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('弹匣配置 1')).toBeTruthy()
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
