import { MiniMap } from '@xyflow/react'
import './WeaponTreeMinimap.css'
export function WeaponTreeMinimap({ nodeCount }: { nodeCount: number }) { if (nodeCount < 30) return null; return <div className="weapon-tree-minimap"><MiniMap pannable zoomable maskColor="rgba(12,7,4,.72)" nodeColor="#8d6434" nodeStrokeColor="#d9b65c" /></div> }
