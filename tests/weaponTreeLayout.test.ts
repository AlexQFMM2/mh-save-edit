import { describe, expect, it } from 'vitest'
import type { WeaponTreeEdge, WeaponTreeNode } from '../api/catalog/types'
import { layoutWeaponTree } from '../ui/utils/weaponTreeLayout'

function node(weaponKey: string, dexId: number): WeaponTreeNode { return { gameId: 'mh3g', weaponKey, typeId: 1, typeNameCn: '大剑', typeNameEn: 'Great Sword', kind: 'standardMelee', saveType: 7, saveId: dexId, saveLevel: null, displayLevel: null, dexId, nameCn: weaponKey, nameEn: weaponKey, rarity: 1, displayAttack: 1, trueRawAttack: 1, affinity: 0, defense: 0, slots: 0, isDirectlyProducible: dexId === 1, isFinalForm: false, iconPath: null, isPlaceholder: false, attributes: [], sharpness: null, specialSummary: [], matchesFilter: true } }

describe('weapon tree layout', () => {
  const nodes = [node('7:1', 1), node('7:2', 2), node('7:3', 3), node('7:4', 4)]
  const edges: WeaponTreeEdge[] = [{ parentWeaponKey: '7:1', childWeaponKey: '7:2', branchOrder: 0 }, { parentWeaponKey: '7:1', childWeaponKey: '7:3', branchOrder: 1 }, { parentWeaponKey: '7:3', childWeaponKey: '7:4', branchOrder: 0 }]
  it('is deterministic and places descendants at greater depth', () => {
    const first = layoutWeaponTree(nodes, edges)
    expect(layoutWeaponTree(nodes, edges)).toEqual(first)
    expect(first.find((item) => item.weaponKey === '7:4')!.depth).toBe(2)
    expect(first.find((item) => item.weaponKey === '7:3')!.y).toBe(first.find((item) => item.weaponKey === '7:4')!.y)
  })
  it('rejects cycles', () => {
    expect(() => layoutWeaponTree(nodes.slice(0, 2), [...edges.slice(0, 1), { parentWeaponKey: '7:2', childWeaponKey: '7:1', branchOrder: 0 }])).toThrow()
  })
  it('keeps nodes in the same depth column on separate rows', () => {
    const sharedChildNodes = [node('7:1', 1), node('7:2', 2), node('7:3', 3), node('7:4', 4), node('7:5', 5)]
    const sharedChildEdges: WeaponTreeEdge[] = [
      { parentWeaponKey: '7:1', childWeaponKey: '7:3', branchOrder: 0 },
      { parentWeaponKey: '7:2', childWeaponKey: '7:3', branchOrder: 0 },
      { parentWeaponKey: '7:1', childWeaponKey: '7:4', branchOrder: 1 },
      { parentWeaponKey: '7:2', childWeaponKey: '7:5', branchOrder: 1 },
    ]
    const result = layoutWeaponTree(sharedChildNodes, sharedChildEdges, 285, 148)
    const rowsByDepth = new Map<number, Set<number>>()
    for (const position of result) {
      const rows = rowsByDepth.get(position.depth) ?? new Set<number>()
      expect(rows.has(position.y)).toBe(false)
      rows.add(position.y)
      rowsByDepth.set(position.depth, rows)
    }
  })
})
