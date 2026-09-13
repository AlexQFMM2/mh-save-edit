import { useEffect, useMemo, useRef } from 'react'
import { Background, ReactFlow, ReactFlowProvider, type Edge, type NodeTypes, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WeaponCatalogFilters, WeaponTreeResult } from '../../../api/catalog/types'
import { contextualWeaponKeys, weaponMatchesFilters } from '../../utils/weaponCatalog'
import { layoutWeaponTree, WEAPON_TREE_NODE_MIN_HEIGHT, WEAPON_TREE_NODE_ROW_GAP, WEAPON_TREE_NODE_WIDTH } from '../../utils/weaponTreeLayout'
import { WeaponTreeControls } from '../WeaponTreeControls/WeaponTreeControls'
import { WeaponTreeMatchNavigator } from '../WeaponTreeMatchNavigator/WeaponTreeMatchNavigator'
import { WeaponTreeMinimap } from '../WeaponTreeMinimap/WeaponTreeMinimap'
import { WeaponTreeNodeView, type WeaponFlowNode } from '../WeaponTreeNode/WeaponTreeNode'
import './WeaponTreeCanvas.css'

const nodeTypes: NodeTypes = { weapon: WeaponTreeNodeView }
const layoutCache = new Map<string, ReturnType<typeof layoutWeaponTree>>()
type FilterSlice = Pick<WeaponCatalogFilters, 'query' | 'attributeId' | 'includeHiddenAttributes' | 'rarity' | 'slots' | 'directlyProducible'>

export function WeaponTreeCanvas(props: { tree: WeaponTreeResult; filters: FilterSlice; selectedKey?: string; sharpnessStage: NonNullable<WeaponCatalogFilters['sharpnessStage']>; onSelect: (weaponKey: string) => void }) {
  return <ReactFlowProvider><WeaponTreeCanvasInner {...props} /></ReactFlowProvider>
}

function WeaponTreeCanvasInner({ tree, filters, selectedKey, sharpnessStage, onSelect }: { tree: WeaponTreeResult; filters: FilterSlice; selectedKey?: string; sharpnessStage: NonNullable<WeaponCatalogFilters['sharpnessStage']>; onSelect: (weaponKey: string) => void }) {
  const instanceRef = useRef<ReactFlowInstance<WeaponFlowNode, Edge> | null>(null)
  const layoutKey = `${tree.gameId}:${tree.weaponTypeId}:${tree.dataVersion}`
  const positions = useMemo(() => {
    const cached = layoutCache.get(layoutKey)
    if (cached) return cached
    const value = layoutWeaponTree(tree.nodes, tree.edges, WEAPON_TREE_NODE_WIDTH, WEAPON_TREE_NODE_MIN_HEIGHT + WEAPON_TREE_NODE_ROW_GAP)
    layoutCache.set(layoutKey, value)
    return value
  }, [layoutKey, tree.nodes, tree.edges])
  const matchedKeys = useMemo(() => tree.nodes.filter((node) => weaponMatchesFilters(node, filters)).map((node) => node.weaponKey), [tree.nodes, filters])
  const matched = useMemo(() => new Set(matchedKeys), [matchedKeys])
  const contextual = useMemo(() => contextualWeaponKeys(tree.nodes, tree.edges, matched), [tree.nodes, tree.edges, matched])
  const parents = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of tree.edges) map.set(edge.childWeaponKey, [...(map.get(edge.childWeaponKey) ?? []), edge.parentWeaponKey])
    return map
  }, [tree.edges])
  const children = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of tree.edges) map.set(edge.parentWeaponKey, [...(map.get(edge.parentWeaponKey) ?? []), edge.childWeaponKey])
    return map
  }, [tree.edges])
  const orderedKeys = useMemo(() => positions.map((position) => position.weaponKey), [positions])
  const selectAndCenter = (weaponKey: string, focus = false) => {
    onSelect(weaponKey)
    const node = instanceRef.current?.getNode(weaponKey)
    if (node) void instanceRef.current?.setCenter(node.position.x + (node.measured?.width ?? WEAPON_TREE_NODE_WIDTH) / 2, node.position.y + (node.measured?.height ?? WEAPON_TREE_NODE_MIN_HEIGHT) / 2, { zoom: Math.max(instanceRef.current.getZoom(), .8), duration: reduceMotion() ? 0 : 220 })
    if (focus) window.setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-weapon-key="${CSS.escape(weaponKey)}"]`)?.focus(), 0)
  }
  const navigate = (weaponKey: string, direction: 'left' | 'right' | 'up' | 'down') => {
    const index = orderedKeys.indexOf(weaponKey)
    const target = direction === 'left' ? parents.get(weaponKey)?.[0] : direction === 'right' ? children.get(weaponKey)?.[0] : direction === 'up' ? orderedKeys[index - 1] : orderedKeys[index + 1]
    if (target) selectAndCenter(target, true)
  }
  const nodes = useMemo<WeaponFlowNode[]>(() => {
    const positionMap = new Map(positions.map((position) => [position.weaponKey, position]))
    return tree.nodes.map((weapon) => ({ id: weapon.weaponKey, type: 'weapon', position: positionMap.get(weapon.weaponKey) ?? { x: 0, y: 0 }, draggable: false, selectable: false, focusable: false, data: { gameId: tree.gameId, weapon, sharpnessStage, matched: matched.has(weapon.weaponKey), contextual: contextual.has(weapon.weaponKey), selectedKey, onSelect: selectAndCenter, onNavigate: navigate } }))
  }, [tree.nodes, tree.gameId, positions, sharpnessStage, matched, contextual, selectedKey, parents, children, orderedKeys])
  const edges = useMemo<Edge[]>(() => tree.edges.map((edge) => ({ id: `${edge.parentWeaponKey}>${edge.childWeaponKey}`, source: edge.parentWeaponKey, target: edge.childWeaponKey, type: 'step', animated: false, style: { stroke: matched.has(edge.childWeaponKey) && contextual.has(edge.parentWeaponKey) ? '#dcb85f' : contextual.has(edge.parentWeaponKey) && contextual.has(edge.childWeaponKey) ? '#977446' : '#554131', strokeWidth: matched.has(edge.childWeaponKey) ? 2.2 : 1.2, opacity: contextual.has(edge.parentWeaponKey) || contextual.has(edge.childWeaponKey) ? 1 : .28 } })), [tree.edges, matched, contextual])
  useEffect(() => {
    if (!selectedKey || !instanceRef.current) return
    const node = instanceRef.current.getNode(selectedKey)
    if (node) void instanceRef.current.setCenter(node.position.x + (node.measured?.width ?? WEAPON_TREE_NODE_WIDTH) / 2, node.position.y + (node.measured?.height ?? WEAPON_TREE_NODE_MIN_HEIGHT) / 2, { zoom: 1, duration: reduceMotion() ? 0 : 220 })
  }, [selectedKey, tree.dataVersion, tree.weaponTypeId])
  const initialize = (instance: ReactFlowInstance<WeaponFlowNode, Edge>) => {
    instanceRef.current = instance
    const initialKey = selectedKey ?? matchedKeys[0] ?? tree.nodes[0]?.weaponKey
    if (!initialKey) return
    window.setTimeout(() => {
      const node = instance.getNode(initialKey)
      if (node) void instance.setCenter(node.position.x + (node.measured?.width ?? WEAPON_TREE_NODE_WIDTH) / 2, node.position.y + (node.measured?.height ?? WEAPON_TREE_NODE_MIN_HEIGHT) / 2, { zoom: 1, duration: 0 })
    }, 0)
  }
  return <div className="weapon-tree-canvas" aria-label="武器派生画布">
    <WeaponTreeMatchNavigator matchedKeys={matchedKeys} contextualCount={Math.max(0, contextual.size - matched.size)} selectedKey={selectedKey} onSelect={selectAndCenter} />
    <ReactFlow<WeaponFlowNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={initialize} onNodeClick={(_, node) => selectAndCenter(node.id)} defaultViewport={{ x: 0, y: 0, zoom: 1 }} minZoom={.2} maxZoom={2} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onlyRenderVisibleElements panOnScroll={false} zoomOnScroll zoomOnPinch zoomOnDoubleClick preventScrolling>
      <Background color="rgba(223,182,93,.12)" gap={22} size={1} />
      <WeaponTreeMinimap nodeCount={nodes.length} />
      <WeaponTreeControls selectedKey={selectedKey} />
    </ReactFlow>
  </div>
}

function reduceMotion(): boolean { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
