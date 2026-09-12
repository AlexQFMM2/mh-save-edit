import { useCallback, useState } from 'react'
import type { LoadoutDecoration, LoadoutFacets, LoadoutGame, LoadoutRelicLookup, LoadoutSlot } from '../../../api/loadout/types'
import { EquipmentPickerContent, type EquipmentPickerCandidate } from '../EquipmentPickerContent/EquipmentPickerContent'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './EquipmentPickerDrawer.css'

type Props = { gameId: LoadoutGame; slot: Exclude<LoadoutSlot, 'charm'>; facets: LoadoutFacets; relicLookups: LoadoutRelicLookup[]; decorations: LoadoutDecoration[]; current?: EquipmentPickerCandidate | null; onApply(candidate: EquipmentPickerCandidate): void; onClose(): void }
const labels: Record<Exclude<LoadoutSlot, 'charm'>, string> = { weapon: '武器', head: '头部', chest: '胸部', arms: '腕部', waist: '腰部', legs: '腿部' }

export function EquipmentPickerDrawer({ gameId, slot, facets, relicLookups, decorations, current, onApply, onClose }: Props) {
  const [selected, setSelected] = useState<EquipmentPickerCandidate | null>(current ?? null)
  const select = useCallback((candidate: EquipmentPickerCandidate | null) => setSelected(candidate), [])
  return <LoadoutWorkspaceDrawer title={`选择${labels[slot]}`} onClose={onClose} footer={<><button type="button" onClick={onClose}>取消</button><button type="button" className="equipment-picker-drawer__apply" disabled={!selected || selected.instance?.encoding === 'blocked'} onClick={() => selected && onApply(selected)}>应用选择</button></>}>
    <EquipmentPickerContent gameId={gameId} slot={slot} facets={facets} relicLookups={relicLookups} decorations={decorations} current={current} onSelectionChange={select} onConfirm={onApply} />
  </LoadoutWorkspaceDrawer>
}

export type EquipmentPickerSlot = Exclude<LoadoutSlot, 'charm'>
