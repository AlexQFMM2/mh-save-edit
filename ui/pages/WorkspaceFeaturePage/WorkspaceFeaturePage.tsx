import { useOutletContext } from 'react-router-dom'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { WorkspacePlaceholder } from '../../components/WorkspacePlaceholder/WorkspacePlaceholder'
import type { WorkspaceNavItemId } from '../../data/workspaceNavigation'
import './WorkspaceFeaturePage.css'

type WorkspaceFeaturePageId = Exclude<WorkspaceNavItemId, 'save-editor'>

const featureContent: Record<WorkspaceFeaturePageId, { title: string; description: string }> = {
  weapons: { title: '武器图鉴', description: '集中查看当前游戏可用武器及其属性、派生和制作资料。' },
  armor: { title: '防具图鉴', description: '集中查看防具部位、套装技能和制作资料。' },
  decorations: { title: '装饰品图鉴', description: '集中查看装饰品技能、槽位和制作资料。' },
  items: { title: '道具图鉴', description: '集中查看道具、素材和道具箱相关资料。' },
  loadout: { title: '配装器', description: '未来将在这里手动组合装备、护石和装饰品，并提供自动配装功能。' },
}

type WorkspaceFeaturePageProps = { pageId: WorkspaceFeaturePageId }

export function WorkspaceFeaturePage({ pageId }: WorkspaceFeaturePageProps) {
  const { game } = useOutletContext<WorkspaceOutletContext>()

  const content = featureContent[pageId]

  return (
    <div className="workspace-feature-page">
      <WorkspacePlaceholder game={game} {...content} />
    </div>
  )
}
