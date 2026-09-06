import { describe, expect, it } from 'vitest'
import { isGameId } from '../ui/pages/GameHomePage/GameHomePage'
import { getSaveEditSections, workspaceNavigation, workspacePath } from '../ui/data/workspaceNavigation'

describe('workspace navigation', () => {
  it('keeps the catalog and edit groups in their intended order', () => {
    expect(workspaceNavigation.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'catalog', label: '资料' },
      { id: 'edit', label: '修改' },
    ])
    expect(workspaceNavigation[0].items.map(({ id }) => id)).toEqual([
      'items',
      'weapons',
      'armor',
      'charms',
      'decorations',
    ])
    expect(workspaceNavigation[1].items.map(({ id }) => id)).toEqual([
      'save-editor',
      'loadout',
    ])
  })

  it('uses game-aware horizontal edit sections after a save is loaded', () => {
    expect(getSaveEditSections('mh3g').map(({ id }) => id)).toEqual([
      'personal-info',
      'equipment-box',
      'item-box',
    ])
    expect(getSaveEditSections('mh4g').some(({ id }) => id === 'palico')).toBe(false)
    expect(getSaveEditSections('mhgu').map(({ id }) => id)).toEqual([
      'personal-info',
      'equipment-box',
      'item-box',
      'palico',
    ])
  })

  it('builds game-scoped hash-router paths without duplicate menu routes', () => {
    const paths = workspaceNavigation.flatMap((group) => group.items.map((item) => item.path))
    expect(new Set(paths).size).toBe(paths.length)
    expect(workspacePath('mh3g', 'catalog/weapons')).toBe('/game/mh3g/catalog/weapons')
    expect(paths).not.toContain('edit/auto-loadout')
  })

  it('accepts only configured game ids', () => {
    expect(isGameId('mh3g')).toBe(true)
    expect(isGameId('mh4g')).toBe(true)
    expect(isGameId('mhgu')).toBe(true)
    expect(isGameId('mhxx')).toBe(false)
  })
})
