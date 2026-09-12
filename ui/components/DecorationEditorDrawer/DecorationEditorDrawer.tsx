import { useState } from 'react'
import type { LoadoutDecoration, LoadoutSkillDefinition } from '../../../api/loadout/types'
import { DecorationEditorContent } from '../DecorationEditorContent/DecorationEditorContent'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './DecorationEditorDrawer.css'

type Props = {
  decorations: LoadoutDecoration[]
  skills: LoadoutSkillDefinition[]
  current: LoadoutDecoration[]
  capacity: number
  onApply: (value: LoadoutDecoration[]) => void
  onClose: () => void
}

export function DecorationEditorDrawer({ decorations, skills, current, capacity, onApply, onClose }: Props) {
  const [values, setValues] = useState(() => structuredClone(current))
  const valueIds = values.map(item => item.saveId)
  const update = (ids: number[]) => setValues(current => {
    const retained = [...current]
    return ids.map(saveId => {
      const index = retained.findIndex(item => item.saveId === saveId)
      if (index >= 0) return retained.splice(index, 1)[0]
      return decorations.find(item => item.saveId === saveId) ?? { saveId, nameCn: `未知装饰珠 #${saveId}`, slots: 0, skills: [], fixed: true }
    })
  })

  return <LoadoutWorkspaceDrawer title="编辑装饰珠" onClose={onClose} footer={<>
    <button type="button" onClick={onClose}>取消</button>
    <button type="button" className="decoration-editor-drawer__apply" onClick={() => onApply(values)}>应用装饰珠</button>
  </>}>
    <div className="decoration-editor-drawer"><DecorationEditorContent decorations={decorations} skills={skills} value={valueIds} capacity={capacity} onChange={update} /></div>
  </LoadoutWorkspaceDrawer>
}
