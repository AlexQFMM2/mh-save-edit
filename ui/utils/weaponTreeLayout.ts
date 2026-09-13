import type { WeaponTreeEdge, WeaponTreeNode } from '../../api/catalog/types'

export type WeaponNodePosition = { weaponKey: string; x: number; y: number; depth: number; order: number }

/** Shared with the node card so the layout always leaves room for its content. */
export const WEAPON_TREE_NODE_WIDTH = 285
export const WEAPON_TREE_NODE_MIN_HEIGHT = 168
export const WEAPON_TREE_NODE_ROW_GAP = 28

export function layoutWeaponTree(nodes: WeaponTreeNode[], edges: WeaponTreeEdge[], gapX = 250, gapY = 92): WeaponNodePosition[] {
  const rowSpacing = Math.max(gapY, WEAPON_TREE_NODE_MIN_HEIGHT + WEAPON_TREE_NODE_ROW_GAP)
  const byKey = new Map(nodes.map((node) => [node.weaponKey, node]))
  const children = new Map<string, WeaponTreeEdge[]>()
  const indegree = new Map(nodes.map((node) => [node.weaponKey, 0]))
  for (const edge of edges) {
    if (!byKey.has(edge.parentWeaponKey) || !byKey.has(edge.childWeaponKey)) continue
    children.set(edge.parentWeaponKey, [...(children.get(edge.parentWeaponKey) ?? []), edge])
    indegree.set(edge.childWeaponKey, (indegree.get(edge.childWeaponKey) ?? 0) + 1)
  }
  for (const list of children.values()) list.sort((left, right) => left.branchOrder - right.branchOrder || left.childWeaponKey.localeCompare(right.childWeaponKey))
  const stableNodes = [...nodes].sort((left, right) => (left.dexId ?? Number.MAX_SAFE_INTEGER) - (right.dexId ?? Number.MAX_SAFE_INTEGER) || left.weaponKey.localeCompare(right.weaponKey))
  const queue = stableNodes.filter((node) => indegree.get(node.weaponKey) === 0).map((node) => node.weaponKey)
  const depth = new Map(queue.map((key) => [key, 0]))
  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index]
    for (const edge of children.get(key) ?? []) {
      depth.set(edge.childWeaponKey, Math.max(depth.get(edge.childWeaponKey) ?? 0, (depth.get(key) ?? 0) + 1))
      const next = (indegree.get(edge.childWeaponKey) ?? 1) - 1
      indegree.set(edge.childWeaponKey, next)
      if (next === 0) queue.push(edge.childWeaponKey)
    }
  }
  if (queue.length !== nodes.length) throw new Error('武器派生图包含环或无法解析的边')

  const row = new Map<string, number>()
  let nextLeafRow = 0
  const assignRow = (key: string): number => {
    const cached = row.get(key)
    if (cached != null) return cached
    const childRows = (children.get(key) ?? []).map((edge) => assignRow(edge.childWeaponKey))
    const value = childRows.length ? (Math.min(...childRows) + Math.max(...childRows)) / 2 : nextLeafRow++
    row.set(key, value)
    return value
  }
  const roots = stableNodes.filter((node) => (depth.get(node.weaponKey) ?? 0) === 0)
  for (const root of roots) assignRow(root.weaponKey)
  for (const node of stableNodes) assignRow(node.weaponKey)
  const resolvedRow = new Map<string, number>()
  const nodesByDepth = new Map<number, typeof stableNodes>()
  for (const node of stableNodes) {
    const nodeDepth = depth.get(node.weaponKey) ?? 0
    nodesByDepth.set(nodeDepth, [...(nodesByDepth.get(nodeDepth) ?? []), node])
  }
  for (const column of nodesByDepth.values()) {
    column.sort((left, right) => (row.get(left.weaponKey) ?? 0) - (row.get(right.weaponKey) ?? 0) || left.weaponKey.localeCompare(right.weaponKey))
    let previous = Number.NEGATIVE_INFINITY
    for (const node of column) {
      const desired = row.get(node.weaponKey) ?? 0
      const value = Math.max(desired, previous + 1)
      resolvedRow.set(node.weaponKey, value)
      previous = value
    }
  }
  return stableNodes
    .map((node) => ({ weaponKey: node.weaponKey, x: (depth.get(node.weaponKey) ?? 0) * gapX, y: (resolvedRow.get(node.weaponKey) ?? 0) * rowSpacing, depth: depth.get(node.weaponKey) ?? 0, order: 0 }))
    .sort((left, right) => left.y - right.y || left.depth - right.depth || left.weaponKey.localeCompare(right.weaponKey))
    .map((position, index) => ({ ...position, order: index }))
}
