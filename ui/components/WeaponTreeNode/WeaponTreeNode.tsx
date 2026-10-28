import { Flag } from 'lucide-react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { WeaponCatalogGameId } from '../../../api/catalog/types'
import type { CatalogWeaponSummary } from '../../utils/catalogWeapon'
import type { SharpnessStage } from '../../../api/catalog/types'
import { CatalogIcon } from '../CatalogIcon/CatalogIcon'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { WeaponAttributeList } from '../WeaponAttributeList/WeaponAttributeList'
import { WeaponProductionBadge } from '../WeaponProductionBadge/WeaponProductionBadge'
import { WeaponSharpnessComparison } from '../WeaponSharpnessComparison/WeaponSharpnessComparison'
import './WeaponTreeNode.css'

export type WeaponTreeNodeData = Record<string, unknown> & { gameId: WeaponCatalogGameId; weapon: CatalogWeaponSummary; sharpnessStage: SharpnessStage; matched: boolean; contextual: boolean; selectedKey?: string; onSelect: (weaponKey: string) => void; onNavigate: (weaponKey: string, direction: 'left' | 'right' | 'up' | 'down') => void }
export type WeaponFlowNode = Node<WeaponTreeNodeData, 'weapon'>

export function WeaponTreeNodeView({ data }: NodeProps<WeaponFlowNode>) {
  const weapon = data.weapon
  const selected = weapon.weaponKey === data.selectedKey
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : null
    if (!direction) return
    event.preventDefault(); data.onNavigate(weapon.weaponKey, direction)
  }
  return <article className={`weapon-tree-node${data.matched ? ' weapon-tree-node--matched' : data.contextual ? ' weapon-tree-node--context' : ' weapon-tree-node--dimmed'}${selected ? ' weapon-tree-node--selected' : ''}`}>
    <Handle type="target" position={Position.Left} className="weapon-tree-node__handle" />
    <Handle id="return-target" type="target" position={Position.Bottom} className="weapon-tree-node__handle weapon-tree-node__return-target" />
    <button className="weapon-tree-node__select nodrag nopan" type="button" data-weapon-key={weapon.weaponKey} tabIndex={selected ? 0 : -1} aria-pressed={selected} aria-label={`${weapon.nameCn}${weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}`} onClick={(event) => { event.stopPropagation(); data.onSelect(weapon.weaponKey) }} onKeyDown={onKeyDown}>
      <span className="weapon-tree-node__head"><CatalogIcon path={weapon.iconPath} name={weapon.nameCn} /><span className="weapon-tree-node__identity"><strong className="weapon-tree-node__name">{weapon.nameCn}{weapon.displayLevel != null ? ` Lv.${weapon.displayLevel}` : ''}</strong><small className="weapon-tree-node__summary" title={weapon.matchReason}>{weapon.matchReason || `RARE ${weapon.rarity ?? '—'} · 攻击 ${weapon.displayAttack ?? '—'}`}</small></span></span>
      <span className="weapon-tree-node__meta"><WeaponAttributeList attributes={weapon.attributes} compact /><EquipmentSlotIndicator slots={weapon.slots} compact /></span>
      {weapon.sharpness ? <WeaponSharpnessComparison gameId={data.gameId} profile={weapon.sharpness} selectedStage={data.sharpnessStage} compact /> : <small className="weapon-tree-node__special">{weapon.specialSummary.slice(0, 2).join(' · ')}</small>}
      <span className="weapon-tree-node__badges">{weapon.isCrossType && <span className="weapon-tree-node__cross-type">转至{weapon.typeNameCn}</span>}{weapon.isDirectlyProducible && <WeaponProductionBadge />}{weapon.isFinalForm && <span className="weapon-tree-node__final-badge"><Flag aria-hidden="true" />最终</span>}</span>
    </button>
    <Handle type="source" position={Position.Right} className="weapon-tree-node__handle" />
    <Handle id="return-source" type="source" position={Position.Bottom} className="weapon-tree-node__handle weapon-tree-node__return-source" />
  </article>
}
