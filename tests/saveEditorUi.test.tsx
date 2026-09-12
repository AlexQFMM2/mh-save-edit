// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SaveBoxSection, SavePalicoDetail, SavePalicoGenerationRules, SavePalicoSection, SavePersonalSection, SaveSessionSnapshot } from '../api/save/types'
import { CatalogWriteControl } from '../ui/components/CatalogWriteControl/CatalogWriteControl'
import { ConfirmationDialog } from '../ui/components/ConfirmationDialog/ConfirmationDialog'
import { SaveBoxWorkspace } from '../ui/components/SaveBoxWorkspace/SaveBoxWorkspace'
import { SaveCharacterPicker } from '../ui/components/SaveCharacterPicker/SaveCharacterPicker'
import { SaveEnvironmentPicker } from '../ui/components/SaveEnvironmentPicker/SaveEnvironmentPicker'
import { SavePersonalEditor } from '../ui/components/SavePersonalEditor/SavePersonalEditor'
import { SavePalicoEditor } from '../ui/components/SavePalicoEditor/SavePalicoEditor'
import { SaveSessionProvider } from '../ui/components/SaveSessionProvider/SaveSessionProvider'
import { useSaveSession } from '../ui/components/SaveSessionProvider/SaveSessionProvider'
import { SaveEquipmentEmbeddedDetail } from '../ui/components/SaveEquipmentEmbeddedDetail/SaveEquipmentEmbeddedDetail'
import { SaveSessionHeader } from '../ui/components/SaveSessionHeader/SaveSessionHeader'

const itemSection: SaveBoxSection = {
  kind: 'item-box', domain: 'items', page: 1, pageSize: 100, pageCount: 2, totalSlots: 200, nonEmptyCount: 2,
  cells: Array.from({ length: 100 }, (_, slot) => ({ slot, empty: slot !== 0 && slot !== 12, itemId: slot === 0 ? 10 : slot === 12 ? 20 : 0, count: slot === 0 ? 3 : slot === 12 ? 7 : 0, nameCn: slot === 0 ? '回复药' : slot === 12 ? '秘药' : '空格', nameEn: slot === 0 ? 'Potion' : slot === 12 ? 'Max Potion' : '', iconPath: null, maxStack: 99, rarity: 1, diagnostics: [] })),
}

const palicoRules: SavePalicoGenerationRules = {
  patterns: [
    { scope: 'normal_move', patternId: 0, sequence: 'AB', validLength: 8, weight: 1 },
    { scope: 'charisma_move', patternId: 0, sequence: 'ABC', validLength: 9, weight: 1 },
    { scope: 'skill', patternId: 0, sequence: 'AC', validLength: 6, weight: 1 },
  ],
  grants: [
    { forteId: -1, kind: 'move', role: 'common', entryId: 50 },
    { forteId: -1, kind: 'move', role: 'common', entryId: 51 },
    ...Array.from({ length: 8 }, (_, forteId) => ({ forteId, kind: 'move' as const, role: 'primary' as const, entryId: forteId + 1 })),
    ...Array.from({ length: 6 }, (_, index) => ({ forteId: index + 1, kind: 'move' as const, role: 'secondary' as const, entryId: 20 + index })),
    { forteId: 7, kind: 'move', role: 'secondary_fixed', entryId: 40 },
    ...Array.from({ length: 8 }, (_, forteId) => [
      { forteId, kind: 'skill' as const, role: 'innate' as const, entryId: 60 + forteId * 2 },
      { forteId, kind: 'skill' as const, role: 'innate' as const, entryId: 61 + forteId * 2 },
    ]).flat(),
  ],
  pools: [
    { kind: 'move', group: 'A', entryId: 80 }, { kind: 'move', group: 'B', entryId: 81 }, { kind: 'move', group: 'C', entryId: 82 },
    { kind: 'skill', group: 'A', entryId: 83 }, { kind: 'skill', group: 'B', entryId: 84 }, { kind: 'skill', group: 'C', entryId: 85 },
  ],
  source: 'synthetic',
}

function palicoDetail(): SavePalicoDetail {
  return {
    index: 0, empty: false, name: 'Mochi', level: 99, experience: 123456, forte: 1, forteNameCn: '战斗', target: 0,
    targetNameCn: '平衡', received: false, diagnostics: [], enthusiasm: 5, greeting: '', nameGiver: '', previousOwner: '',
    equippedActions: [2, 50, 0, 0, 0, 0, 0, 0], equippedSkills: [62, 0, 0, 0, 0, 0, 0, 0],
    learnedActions: [2, 20, 50, 51, 80, 81, 90, 91, ...Array(8).fill(57)],
    learnedSkills: [62, 63, 83, 85, 92, 93, ...Array(6).fill(96)], actionPattern: 0, actionValidLength: 8,
    skillPattern: 0, skillValidLength: 6, voice: 0, eyes: 0, clothing: 0, coat: 0, ears: 0, tail: 0,
    coatColor: '00000000', rightEyeColor: '00000000', leftEyeColor: '00000000', vestColor: '00000000',
    status: 0, trainingState: 7, assignment: 4, prowlerSelected: 1, assignmentReferencesHex: 'aabb',
  }
}

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'mhSaveEditor')
})

function session(overrides: Partial<SaveSessionSnapshot> = {}): SaveSessionSnapshot {
  return {
    sessionId: '9f36c995-c15a-49f7-ac4d-8f89bf508e57', revision: 1, state: 'readyClean', contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra',
    platform: '3ds', emulator: 'citra', fileName: 'user1', characterSlot: 0, characterName: 'Hunter', dirty: false, readOnly: false,
    undoCount: 0, redoCount: 0, diagnostics: [], capabilities: { canWrite: true, canSaveAs: true, canEditPersonal: true, canEditItems: true, canEditEquipment: true, canEditPalicoes: false, canSwapItems: false, canSwapEquipment: false, hasCharacters: false, hasPalicoes: false, itemCapacity: 1000, itemCountMax: 0xffff, hunterEquipmentCapacity: 1000, palicoEquipmentCapacity: 0 },
    ...overrides,
  }
}

function installSaveSession(value: SaveSessionSnapshot | null) {
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { save: { getSession: vi.fn().mockResolvedValue(value), listCharacters: vi.fn().mockResolvedValue([]), subscribe: vi.fn(() => () => undefined) } } })
}

function NavigationBlockHarness() {
  const { setNavigationBlockReason } = useSaveSession()
  return <><button type="button" onClick={() => setNavigationBlockReason('输入无效')}>阻止离开</button><a href="#/other-page">离开页面</a><a href="#/game/mh3g/catalog/items">同版本图鉴</a><a href="#/game/mh4g/overview">切换到 MH4G</a></>
}

describe('save editor UI primitives', () => {
  it('keeps physical box order, jumps between search matches and opens a cell on double click', () => {
    const edit = vi.fn()
    const page = vi.fn()
    render(<SaveBoxWorkspace gameId="mh3g" section={itemSection} busy={false} onPage={page} onReplaceItem={edit} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} />)
    const search = screen.getByPlaceholderText(/Enter 跳到下一项/)
    fireEvent.change(search, { target: { value: '药' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByRole('gridcell', { name: /秘药/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.doubleClick(screen.getByRole('gridcell', { name: /秘药/ }))
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ slot: 12, itemId: 20 }))
    fireEvent.keyDown(screen.getByRole('gridcell', { name: /秘药/ }), { key: 'PageDown' })
    expect(page).toHaveBeenCalledWith(2)
  })

  it('keeps read-only boxes browsable while disabling every mutation entry point', () => {
    const edit = vi.fn()
    const importBox = vi.fn()
    const exportBox = vi.fn()
    render(<SaveBoxWorkspace gameId="mh3g" section={itemSection} busy={false} editable={false} onPage={vi.fn()} onReplaceItem={edit} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={importBox} onExport={exportBox} />)
    const cell = screen.getByRole('gridcell', { name: /回复药/ })
    fireEvent.doubleClick(cell)
    fireEvent.keyDown(cell, { key: 'Enter' })
    expect(edit).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: '导入' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '替换道具' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '复制到首个空格' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '清空格子' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '导出' }))
    expect(exportBox).toHaveBeenCalledOnce()
    expect(importBox).not.toHaveBeenCalled()
  })

  it('delegates Enter to the full-box search without reordering the visible page', () => {
    const findNext = vi.fn()
    const selection = vi.fn()
    render(<SaveBoxWorkspace gameId="mh3g" section={{ ...itemSection, query: '秘药', matchingSlots: [112], matchingCount: 1 }} busy={false} selectedSlot={12} query="秘药" onSelectionChange={selection} onQueryChange={vi.fn()} onFindNext={findNext} onPage={vi.fn()} onReplaceItem={vi.fn()} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} />)
    const cells = screen.getAllByRole('gridcell')
    expect(cells[0].getAttribute('aria-label')).toMatch(/第 1 格/)
    expect(cells[12].getAttribute('aria-label')).toMatch(/第 13 格/)
    expect(screen.getByText(/1 项匹配/)).toBeTruthy()
    fireEvent.keyDown(screen.getByPlaceholderText(/Enter 跳到下一项/), { key: 'Enter' })
    expect(findNext).toHaveBeenCalledWith('秘药', 12)
    expect(selection).not.toHaveBeenCalled()
  })

  it('dims rather than removes physical slots when a box display filter is active', () => {
    const change = vi.fn()
    const view = render(<SaveBoxWorkspace gameId="mh3g" section={itemSection} busy={false} viewFilter="non-empty" onViewFilterChange={change} onPage={vi.fn()} onReplaceItem={vi.fn()} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(100)
    expect(screen.getByRole('gridcell', { name: /第 2 格/ }).className).toContain('is-dimmed')
    expect(screen.getByRole('gridcell', { name: /回复药/ }).className).not.toContain('is-dimmed')
    fireEvent.click(screen.getByRole('button', { name: '箱格突出显示' }))
    fireEvent.change(screen.getByRole('combobox', { name: '箱格突出显示关键词' }), { target: { value: '诊断' } })
    fireEvent.click(screen.getByRole('option', { name: '突出诊断' }))
    expect(change).toHaveBeenCalledWith('diagnostic')
    view.unmount()
  })

  it('does not overwrite a controlled cross-page target while the next page is loading', () => {
    const selection = vi.fn()
    const view = render(<SaveBoxWorkspace gameId="mh3g" section={itemSection} busy={false} selectedSlot={112} query="秘药" onSelectionChange={selection} onQueryChange={vi.fn()} onFindNext={vi.fn()} onPage={vi.fn()} onReplaceItem={vi.fn()} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} />)
    expect(selection).not.toHaveBeenCalled()
    const nextPage = { ...itemSection, page: 2, cells: itemSection.cells.map((cell, index) => ({ ...cell, slot: index + 100, nameCn: index === 12 ? '秘药' : cell.nameCn })) }
    view.rerender(<SaveBoxWorkspace gameId="mh3g" section={nextPage} busy={false} selectedSlot={112} query="秘药" onSelectionChange={selection} onQueryChange={vi.fn()} onFindNext={vi.fn()} onPage={vi.fn()} onReplaceItem={vi.fn()} onEditEquipment={vi.fn()} onSetCount={vi.fn()} onClear={vi.fn()} onCopy={vi.fn()} onImport={vi.fn()} onExport={vi.fn()} />)
    expect(screen.getByRole('gridcell', { name: /秘药/ }).getAttribute('aria-selected')).toBe('true')
    expect(selection).not.toHaveBeenCalled()
  })

  it('reports an invalid personal input draft and commits one valid field on blur', async () => {
    const section: SavePersonalSection = { kind: 'personal-info', fields: [{ key: 'money', group: 'currency', label: '金钱', value: 100, valueType: 'number', writable: true, min: 0, max: 999 }] }
    const commit = vi.fn().mockResolvedValue(undefined)
    const validity = vi.fn()
    const session = { contentGameId: 'mh3g', formatId: 'mh3g-3ds-citra', platform: '3ds', emulator: 'citra', fileName: 'user1', characterName: 'Hunter', revision: 1, undoCount: 0, redoCount: 0, diagnostics: [] } as unknown as SaveSessionSnapshot
    render(<SavePersonalEditor section={section} session={session} busy={false} onCommit={commit} onDraftValidityChange={validity} />)
    const input = screen.getByLabelText('金钱')
    fireEvent.change(input, { target: { value: '1000' } })
    await waitFor(() => expect(validity).toHaveBeenLastCalledWith(true))
    fireEvent.blur(input)
    expect(screen.getByText(/必须在 0～999/)).toBeTruthy()
    expect(commit).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.blur(input)
    await waitFor(() => expect(commit).toHaveBeenCalledWith('money', 500))
  })

  it('does not render catalog write controls outside a save provider', () => {
    const { container } = render(<CatalogWriteControl gameId="mh3g" kind="item" saveId={1} />)
    expect(container.childElementCount).toBe(0)
  })

  it.each([
    [null, '读取存档后可加入'],
    [session({ contentGameId: 'mh4g', formatId: 'mh4g-3ds-citra' }), '当前存档版本不匹配'],
    [session({ state: 'selectingCharacter', characterSlot: null, characterName: null }), '选择角色后可加入'],
    [session({ readOnly: true, capabilities: { ...session().capabilities, canWrite: false } }), '只读存档不可加入'],
  ])('explains why catalog writes are unavailable', async (snapshot, label) => {
    installSaveSession(snapshot)
    render(<SaveSessionProvider><CatalogWriteControl gameId="mh3g" kind="item" saveId={1} /></SaveSessionProvider>)
    const button = await screen.findByRole('button', { name: label })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the exact first empty box cell and clamps item count to the save encoding limit', async () => {
    window.location.hash = '#/game/mhgu/catalog/items'
    const snapshot = session({ contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu', platform: 'switch', emulator: 'yuzu', capabilities: { ...session().capabilities, itemCapacity: 2300, itemCountMax: 127 } })
    const previewCatalogItemWrite = vi.fn().mockResolvedValue({ capacity: 2300, nonEmptyCount: 1200, itemNameCn: '测试道具', requestedCount: 3, targets: [{ slot: 137, page: 2, cell: 38, beforeCount: 0, afterCount: 3, addedCount: 3 }] })
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { save: { getSession: vi.fn().mockResolvedValue(snapshot), listCharacters: vi.fn().mockResolvedValue([]), previewCatalogItemWrite, subscribe: vi.fn(() => () => undefined) } } })
    render(<SaveSessionProvider><CatalogWriteControl gameId="mhgu" kind="item" saveId={1} maxCount={999} /></SaveSessionProvider>)
    fireEvent.click(await screen.findByRole('button', { name: '加入道具箱' }))
    expect(await screen.findByText(/第 2 页 · 第 38 格（\+3）/)).toBeTruthy()
    expect(screen.getByText('1100 格')).toBeTruthy()
    expect((screen.getByRole('spinbutton') as HTMLInputElement).max).toBe('127')
    expect(previewCatalogItemWrite).toHaveBeenCalledWith(expect.objectContaining({ sessionId: snapshot.sessionId, revision: snapshot.revision, gameId: 'mhgu', saveId: 1, count: 99 }))
  })

  it('focuses cancel and exposes save, discard and cancel as distinct leave actions', () => {
    const calls = { save: vi.fn(), discard: vi.fn(), cancel: vi.fn() }
    render(<ConfirmationDialog title="离开？" message="尚未保存" confirmLabel="保存并离开" alternateLabel="放弃并离开" alternateDestructive onConfirm={calls.save} onAlternate={calls.discard} onCancel={calls.cancel} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' }))
    fireEvent.click(screen.getByRole('button', { name: '放弃并离开' }))
    expect(calls.discard).toHaveBeenCalledOnce()
  })

  it('cancels on Escape, traps focus and returns focus after closing', () => {
    const opener = document.createElement('button')
    opener.textContent = '打开确认'
    document.body.append(opener)
    opener.focus()
    const cancel = vi.fn()
    const view = render(<ConfirmationDialog title="确认操作" message="测试" onConfirm={vi.fn()} onCancel={cancel} />)
    const cancelButton = screen.getByRole('button', { name: '取消' })
    const confirmButton = screen.getByRole('button', { name: '确认' })
    expect(document.activeElement).toBe(cancelButton)
    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirmButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(cancel).toHaveBeenCalledOnce()
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('previews character slots with roving focus and confirms only on Enter or double click', () => {
    const select = vi.fn()
    render(<SaveCharacterPicker busy={false} onClose={vi.fn()} onSelect={select} characters={[
      { slot: 0, used: true, name: 'Alpha', hunterRank: 10, playTimeSeconds: 3600 },
      { slot: 1, used: true, name: 'Beta', hunterRank: 20, playTimeSeconds: 7200 },
      { slot: 2, used: false, name: '', hunterRank: 0, playTimeSeconds: 0 },
    ]} />)
    const first = screen.getByRole('option', { name: /Alpha/ })
    const second = screen.getByRole('option', { name: /Beta/ })
    expect(first.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(second.getAttribute('aria-selected')).toBe('true')
    expect(select).not.toHaveBeenCalled()
    fireEvent.keyDown(second, { key: 'Enter' })
    expect(select).toHaveBeenCalledWith(1)
  })

  it('shows the selected environment and GU character slot without internal revision metadata', () => {
    render(<SaveSessionHeader session={session({ contentGameId: 'mhgu', formatId: 'mhgu-switch-yuzu', platform: 'switch', emulator: 'yuzu', characterSlot: 1, characterName: 'Beta', capabilities: { ...session().capabilities, hasCharacters: true } })} busy={false} onSelectCharacter={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} onSave={vi.fn()} onSaveAs={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('MHGU · Switch · Yuzu')).toBeTruthy()
    expect(screen.getByText('角色槽 2：Beta')).toBeTruthy()
    expect(screen.queryByText(/revision/)).toBeNull()
    expect(screen.getByRole('button', { name: '切换角色' })).toBeTruthy()
  })

  it('requires an explicit emulator environment before opening the native file picker', () => {
    const open = vi.fn()
    render(<SaveEnvironmentPicker gameId="mh3g" busy={false} onOpen={open} />)
    const continueButton = screen.getByRole('button', { name: '选择文件并读取' }) as HTMLButtonElement
    expect(continueButton.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /MH3U · Wii U · Cemu/ }))
    expect(continueButton.disabled).toBe(false)
    fireEvent.click(continueButton)
    expect(open).toHaveBeenCalledWith('mh3u-wiiu-cemu')
  })

  it('keeps a failed save-open explanation beside the selected environment', () => {
    render(<SaveEnvironmentPicker gameId="mh4g" busy={false} error="文件大小不正确" onOpen={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('文件大小不正确')
  })

  it('keeps the user-facing save environment visible and offers GU character switching', () => {
    const switchCharacter = vi.fn()
    render(<SaveSessionHeader session={session({ contentGameId: 'mhgu', formatId: 'mhxx-3ds-citra', platform: '3ds', emulator: 'citra', characterSlot: 1, capabilities: { ...session().capabilities, hasCharacters: true } })} busy={false} onSelectCharacter={switchCharacter} onUndo={vi.fn()} onRedo={vi.fn()} onSave={vi.fn()} onSaveAs={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('MHXX · 3DS · Citra')).toBeTruthy()
    expect(screen.getByText(/角色槽 2/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '切换角色' }))
    expect(switchCharacter).toHaveBeenCalledOnce()
  })

  it('blocks sidebar-style hash links while a field draft is invalid', async () => {
    installSaveSession(null)
    window.location.hash = '#/game/mh3g/edit/save'
    render(<SaveSessionProvider><NavigationBlockHarness /></SaveSessionProvider>)
    fireEvent.click(screen.getByRole('button', { name: '阻止离开' }))
    await waitFor(() => fireEvent.click(screen.getByRole('link', { name: '离开页面' })))
    expect(window.location.hash).toBe('#/game/mh3g/edit/save')
  })

  it('keeps a clean session inside the same game and confirms before cross-game navigation', async () => {
    const snapshot = session()
    const close = vi.fn().mockResolvedValue(undefined)
    window.location.hash = '#/game/mh3g/edit/save'
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { save: { getSession: vi.fn().mockResolvedValue(snapshot), listCharacters: vi.fn().mockResolvedValue([]), close, subscribe: vi.fn(() => () => undefined) } } })
    render(<SaveSessionProvider><NavigationBlockHarness /></SaveSessionProvider>)
    await screen.findByRole('link', { name: '同版本图鉴' })
    fireEvent.click(screen.getByRole('link', { name: '同版本图鉴' }))
    expect(screen.queryByRole('alertdialog', { name: '离开当前游戏版本？' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '切换到 MH4G' }))
    expect(screen.getByRole('alertdialog', { name: '离开当前游戏版本？' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭并继续' }))
    await waitFor(() => expect(close).toHaveBeenCalledWith(snapshot.sessionId, snapshot.revision, false))
  })

  it('restores direct cross-game hash changes and saves with the returned revision before leaving', async () => {
    const snapshot = session({ revision: 4, dirty: true, state: 'readyDirty', undoCount: 1 })
    const saved = session({ revision: 5, dirty: false, state: 'readyClean', undoCount: 0 })
    const saveCurrent = vi.fn().mockResolvedValue({ cancelled: false, session: saved, message: '已保存' })
    const close = vi.fn().mockResolvedValue(undefined)
    window.location.hash = '#/game/mh3g/edit/save'
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { save: { getSession: vi.fn().mockResolvedValue(snapshot), listCharacters: vi.fn().mockResolvedValue([]), saveCurrent, close, subscribe: vi.fn(() => () => undefined) } } })
    render(<SaveSessionProvider><NavigationBlockHarness /></SaveSessionProvider>)
    await screen.findByRole('link', { name: '切换到 MH4G' })
    window.location.hash = '#/game/mh4g/overview'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(window.location.hash).toBe('#/game/mh3g/edit/save'))
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(close).toHaveBeenCalledWith(saved.sessionId, saved.revision, false))
    expect(saveCurrent).toHaveBeenCalledWith(snapshot.sessionId, snapshot.revision)
  })

  it('shows readable decorations and charm skills in embedded save equipment details', () => {
    render(<SaveEquipmentEmbeddedDetail gameId="mhgu" cell={{ slot: 0, empty: false, kind: 'charm', saveType: 6, saveId: 4, level: 0, slots: 3, appearanceId: null, decorations: [101, 0, 0], skill1Id: 18, skill1Points: 5, skill2Id: 0, skill2Points: 0, nameCn: '天之护石', nameEn: 'Creator Talisman', typeNameCn: '护石', iconPath: null, weaponKey: null, armorDexId: null, palicoEquipmentId: null, decorationLabels: [{ saveId: 101, rawValue: 101, nameCn: '痛击珠', slots: 1, fixed: false }], skill1NameCn: '痛击', skill2NameCn: null, recordHex: '00'.repeat(36), diagnostics: [] }} />)
    expect(screen.getByText('痛击珠')).toBeTruthy()
    expect(screen.getByText('痛击 +5')).toBeTruthy()
  })

  it('previews and applies a native Palico bias rebuild without exposing level or EXP mutations', async () => {
    const selected = palicoDetail()
    const section: SavePalicoSection = { kind: 'palico', entries: [selected], selected, generationRules: palicoRules }
    const commit = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: {
      searchPalicoSupportMoves: vi.fn().mockResolvedValue([]),
      searchPalicoSkills: vi.fn().mockResolvedValue([]),
    } } })
    render(<SavePalicoEditor section={section} busy={false} onSelect={vi.fn()} onCommit={commit} />)

    fireEvent.click(screen.getByRole('button', { name: '支援倾向' }))
    fireEvent.click(screen.getByRole('option', { name: '防御' }))
    expect(screen.getByRole('alertdialog', { name: '切换倾向并重建能力结构？' }).textContent).toContain('等级、EXP、训练和设施字段保持不变')
    fireEvent.click(screen.getByRole('button', { name: '重建并切换' }))
    fireEvent.click(screen.getByRole('button', { name: '应用修改' }))

    await waitFor(() => expect(commit).toHaveBeenCalledOnce())
    const changes = commit.mock.calls[0][1] as Record<string, unknown>
    expect(changes).toMatchObject({
      forte: 2,
      equippedActions: Array(8).fill(0),
      equippedSkills: Array(8).fill(0),
      learnedActions: expect.any(Array),
      learnedSkills: expect.any(Array),
    })
    expect(changes).not.toHaveProperty('level')
    expect(changes).not.toHaveProperty('experience')
    expect(changes).not.toHaveProperty('trainingState')
    expect(changes).not.toHaveProperty('assignment')
    expect(changes).not.toHaveProperty('assignmentReferencesHex')
  })

  it('does not silently discard a Palico page draft when selecting another record', async () => {
    const selected = palicoDetail()
    const next = { ...palicoDetail(), index: 1, name: 'Nori' }
    const select = vi.fn()
    const dirty = vi.fn()
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: {
      searchPalicoSupportMoves: vi.fn().mockResolvedValue([]),
      searchPalicoSkills: vi.fn().mockResolvedValue([]),
    } } })
    render(<SavePalicoEditor section={{ kind: 'palico', entries: [selected, next], selected, generationRules: palicoRules }} busy={false} onSelect={select} onCommit={vi.fn().mockResolvedValue(undefined)} onDraftDirtyChange={dirty} />)

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'Mochi 2' } })
    await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true))
    fireEvent.click(screen.getByRole('option', { name: /Nori/ }))
    expect(screen.getByRole('alertdialog', { name: '放弃当前猎猫草稿？' })).toBeTruthy()
    expect(select).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(select).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('option', { name: /Nori/ }))
    fireEvent.click(screen.getByRole('button', { name: '放弃草稿并切换' }))
    expect(select).toHaveBeenCalledWith(1)
  })

  it('disables Palico mutation controls while the session is read-only or busy', () => {
    const selected = palicoDetail()
    const commit = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: {
      searchPalicoSupportMoves: vi.fn().mockResolvedValue([]),
      searchPalicoSkills: vi.fn().mockResolvedValue([]),
    } } })
    render(<SavePalicoEditor section={{ kind: 'palico', entries: [selected], selected, generationRules: palicoRules }} busy onSelect={vi.fn()} onCommit={commit} />)
    expect((screen.getByLabelText('名称') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '支援倾向' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '应用修改' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '不应写入' } })
    expect(commit).not.toHaveBeenCalled()
  })

  it('filters Palico records, exposes empty records for diagnosis and reports skill memory usage', async () => {
    const selected = palicoDetail()
    const empty = { ...selected, index: 1, empty: true, name: '', diagnostics: [{ code: 'test', path: 'palicoes.1', severity: 'warning' as const, message: '未知结构' }] }
    Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: {
      searchPalicoSupportMoves: vi.fn().mockResolvedValue([]),
      searchPalicoSkills: vi.fn().mockResolvedValue([{ gameId: 'mhgu', palicoSkillId: 62, nameCn: '测试技能', nameEn: '', nameJp: '', generationTier: 1, generationGroup: 'A', role: '普通', teachable: true, memoryCost: 4, learnLevel: 1, evidenceStatus: 'verified' }]),
    } } })
    render(<SavePalicoEditor section={{ kind: 'palico', entries: [selected, empty], selected, generationRules: palicoRules }} busy={false} onSelect={vi.fn()} onCommit={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByPlaceholderText('搜索名称、倾向或目标')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('显示空记录'))
    expect(screen.getByRole('option', { name: /空记录 2/ })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('仅风险记录'))
    expect(screen.getByRole('option', { name: /空记录 2/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '技能' }))
    await waitFor(() => expect(screen.getByText(/已用记忆槽/)).toBeTruthy())
  })
})
