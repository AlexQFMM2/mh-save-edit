import { useCallback, useState } from 'react'
import type { CharmValidationResult, LoadoutCalculationSnapshot } from '../../../api/loadout/types'
import { CharmEditorForm, type EditableCharm } from '../CharmEditorForm/CharmEditorForm'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './CharmPickerDrawer.css'

type Props = {
  snapshot: LoadoutCalculationSnapshot
  current: EditableCharm | null
  onApply(value: EditableCharm): void
  onClose(): void
}

export function CharmPickerDrawer({ snapshot, current, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<EditableCharm | null>(current)
  const [encoding, setEncoding] = useState<CharmValidationResult['encoding']>('encodable')
  const update = useCallback((value: EditableCharm, validation: CharmValidationResult) => { setDraft(value); setEncoding(validation.encoding) }, [])
  return <LoadoutWorkspaceDrawer title="编辑护石" onClose={onClose} footer={<>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" className="charm-picker-drawer__apply" disabled={!draft || encoding === 'blocked'} onClick={() => draft && onApply(draft)}>应用护石</button>
  </>}>
    <div className="charm-picker-drawer"><CharmEditorForm snapshot={snapshot} current={current} onChange={update} /></div>
  </LoadoutWorkspaceDrawer>
}
