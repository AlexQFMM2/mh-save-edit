import { FolderOpen } from 'lucide-react'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { getSaveEditSections, type SaveEditSectionId } from '../../data/workspaceNavigation'
import './SaveEditorPanel.css'

type SaveEditorPanelProps = {
  game: GameVersionDefinition
  saveLoaded: boolean
  activeSection: SaveEditSectionId
  onActiveSectionChange: (section: SaveEditSectionId) => void
  onOpenSave?: () => void
}

export function SaveEditorPanel({
  game,
  saveLoaded,
  activeSection,
  onActiveSectionChange,
  onOpenSave,
}: SaveEditorPanelProps) {
  const sections = getSaveEditSections(game.id)
  const currentSection = sections.find((section) => section.id === activeSection) ?? sections[0]

  if (!saveLoaded) {
    return (
      <article className="save-editor-panel save-editor-panel--empty" aria-label={`${game.title} 存档修改`}>
        <button
          className="save-editor-panel__open-button"
          type="button"
          onClick={onOpenSave}
          disabled={!onOpenSave}
          title={onOpenSave ? undefined : '存档读取功能开发中'}
        >
          <FolderOpen size={20} aria-hidden="true" />
          读取存档
        </button>
      </article>
    )
  }

  return (
    <article className="save-editor-panel" aria-label={`${game.title} 存档修改`}>
      <div className="save-editor-panel__tabs" role="tablist" aria-label="修改项目">
        {sections.map((section) => (
          <button
            className={`save-editor-panel__tab${section.id === currentSection.id ? ' save-editor-panel__tab--active' : ''}`}
            key={section.id}
            id={`save-editor-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={section.id === currentSection.id}
            aria-controls={`save-editor-section-${section.id}`}
            onClick={() => onActiveSectionChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <section
        className="save-editor-panel__content"
        id={`save-editor-section-${currentSection.id}`}
        role="tabpanel"
        aria-labelledby={`save-editor-tab-${currentSection.id}`}
        tabIndex={0}
      >
        <p className="save-editor-panel__eyebrow">存档修改</p>
        <h1>{currentSection.label}</h1>
        <p>{currentSection.description}</p>
      </section>
    </article>
  )
}
