import { Focus, Maximize, Minus, Plus } from 'lucide-react'
import { Panel, useReactFlow, useViewport } from '@xyflow/react'
import type { WeaponFlowNode } from '../WeaponTreeNode/WeaponTreeNode'
import './WeaponTreeControls.css'

export function WeaponTreeControls({ selectedKey }: { selectedKey?: string }) {
  const flow = useReactFlow<WeaponFlowNode>()
  const { zoom } = useViewport()
  const center = () => {
    if (!selectedKey) return
    const node = flow.getNode(selectedKey)
    if (node) void flow.setCenter(node.position.x + (node.measured?.width ?? 230) / 2, node.position.y + (node.measured?.height ?? 108) / 2, { zoom: Math.max(flow.getZoom(), .8), duration: reduceMotion() ? 0 : 220 })
  }
  return <Panel position="bottom-right" className="weapon-tree-controls"><button type="button" aria-label="放大派生图" onClick={() => void flow.zoomIn({ duration: 160 })}><Plus aria-hidden="true" /></button><button type="button" aria-label="缩小派生图" onClick={() => void flow.zoomOut({ duration: 160 })}><Minus aria-hidden="true" /></button><button type="button" aria-label="适应窗口" onClick={() => void flow.fitView({ padding: .15, duration: reduceMotion() ? 0 : 220 })}><Maximize aria-hidden="true" /></button><button type="button" aria-label="回到选中武器" disabled={!selectedKey} onClick={center}><Focus aria-hidden="true" /></button><span>{Math.round(zoom * 100)}%</span></Panel>
}
function reduceMotion(): boolean { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
