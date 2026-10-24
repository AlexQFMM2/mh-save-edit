import { describe, expect, it } from 'vitest'
import { isGameId } from '../ui/pages/GameHomePage/GameHomePage'
import { getSaveEditSections, getWorkspaceNavigation, workspaceNavigation, workspacePath } from '../ui/data/workspaceNavigation'

describe('workspace navigation', () => {
  it('keeps the catalog and edit groups in their intended order', () => {
    expect(workspaceNavigation.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'catalog', label: '资料' },
      { id: 'palico-catalog', label: '猎猫' },
      { id: 'edit', label: '修改' },
    ])
    expect(workspaceNavigation[0].items.map(({ id }) => id)).toEqual([
      'items',
      'decorations',
      'skills',
      'weapons',
      'armor',
      'monsters',
      'quests',
      'hunter-arts',
    ])
    expect(workspaceNavigation[1].items.map(({ id }) => id)).toEqual([
      'palico-types',
      'palico-support-moves',
      'palico-skills',
      'palico-equipment',
    ])
    expect(workspaceNavigation[2].items.map(({ id }) => id)).toEqual([
      'save-editor',
      'loadout',
    ])
  })

  it('gives P2G the same nine entries as MH3G without talisman wording', () => {
    const groups = getWorkspaceNavigation('mhp2g')
    expect(groups.map(group => group.id)).toEqual(['catalog', 'edit'])
    expect(groups.flatMap(group => group.items.map(item => item.id))).toEqual(getWorkspaceNavigation('mh3g').flatMap(group => group.items.map(item => item.id)))
    expect(groups.flatMap(group => group.items).map(item => item.description).join('')).not.toContain('护石')
  })

  it('shows Hunter Arts only for MHGU/XX content',()=>{
    expect(getWorkspaceNavigation('mhgu')[0].items.some(item=>item.id==='hunter-arts')).toBe(true)
    expect(getWorkspaceNavigation('mh3g')[0].items.some(item=>item.id==='hunter-arts')).toBe(false)
    expect(getWorkspaceNavigation('mh4g')[0].items.some(item=>item.id==='hunter-arts')).toBe(false)
  })

  it('shows the independent Palico catalog group only for MHGU/XX content',()=>{
    expect(getWorkspaceNavigation('mhgu').some(group=>group.id==='palico-catalog')).toBe(true)
    expect(getWorkspaceNavigation('mh3g').some(group=>group.id==='palico-catalog')).toBe(false)
    expect(getWorkspaceNavigation('mh4g').some(group=>group.id==='palico-catalog')).toBe(false)
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
    expect(isGameId('mhp2g')).toBe(true)
    expect(isGameId('mhp3')).toBe(true)
    expect(isGameId('mh3g')).toBe(true)
    expect(isGameId('mh4g')).toBe(true)
    expect(isGameId('mhgu')).toBe(true)
    expect(isGameId('mhxx')).toBe(false)
  })
})
