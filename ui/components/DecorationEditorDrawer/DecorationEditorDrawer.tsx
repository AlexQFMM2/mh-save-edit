import type { LoadoutDecoration, LoadoutSkillDefinition } from '../../../api/loadout/types'
import { DecorationEditorContent } from '../DecorationEditorContent/DecorationEditorContent'
import { LoadoutWorkspaceDrawer } from '../LoadoutWorkspaceDrawer/LoadoutWorkspaceDrawer'
import './DecorationEditorDrawer.css'

type Props = {
  decorations: LoadoutDecoration[]
  skills: LoadoutSkillDefinition[]
  current: LoadoutDecoration[]
  capacity: number
  canUndo: boolean
  onUndo(): void
  onChange(value: LoadoutDecoration[]): void
  onClose(): void
}

/** Only the logical loadout editor is immediate; save editing uses its own draft. */
export function DecorationEditorDrawer({ decorations, skills, current, capacity, canUndo, onUndo, onChange, onClose }: Props) {
  const update = (ids: number[]) => {
    const retained = [...current]
    onChange(ids.map(saveId => {
      const index = retained.findIndex(item => item.saveId === saveId)
      if (index >= 0) return retained.splice(index, 1)[0]
      return decorations.find(item => item.saveId === saveId) ?? { saveId, nameCn: `未知装饰珠 #${saveId}`, slots: 0, skills: [], fixed: true }
    }))
  }
  return <LoadoutWorkspaceDrawer title="编辑装饰珠" onClose={onClose} footer={<>
    <button type="button" disabled={!canUndo} onClick={onUndo}>撤销上一步</button>
    <button type="button" onClick={onClose}>关闭</button>
  </>}>
    <div className="decoration-editor-drawer">
      <p className="decoration-editor-drawer__notice">添加或移除立即更新当前配装，每一步均可撤销；关闭不会回退修改，也不会写入存档。</p>
      <DecorationEditorContent decorations={decorations} skills={skills} value={current.map(item => item.saveId)} capacity={capacity} onChange={update} />
    </div>
  </LoadoutWorkspaceDrawer>
}
