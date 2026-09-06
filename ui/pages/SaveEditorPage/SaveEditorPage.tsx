import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { SaveEditorPanel } from '../../components/SaveEditorPanel/SaveEditorPanel'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import type { SaveEditSectionId } from '../../data/workspaceNavigation'
import './SaveEditorPage.css'

export function SaveEditorPage() {
  const { game, loadedSaveName, onOpenSave } = useOutletContext<WorkspaceOutletContext>()
  const [activeSection, setActiveSection] = useState<SaveEditSectionId>('personal-info')

  return (
    <div className="save-editor-page">
      <SaveEditorPanel
        game={game}
        saveLoaded={Boolean(loadedSaveName)}
        activeSection={activeSection}
        onActiveSectionChange={setActiveSection}
        onOpenSave={onOpenSave}
      />
    </div>
  )
}
