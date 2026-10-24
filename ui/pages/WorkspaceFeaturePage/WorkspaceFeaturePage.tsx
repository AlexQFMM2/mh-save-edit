import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { ShellOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { WorkspacePlaceholder } from '../../components/WorkspacePlaceholder/WorkspacePlaceholder'
import type { WorkspaceNavItemId } from '../../data/workspaceNavigation'
import './WorkspaceFeaturePage.css'

type WorkspaceFeaturePageId = WorkspaceNavItemId

const featureContent: Record<WorkspaceFeaturePageId, { title: string; description: string }> = {
  'save-editor': { title: '存档修改', description: '读取存档并修改个人信息、装备箱与道具箱。' },
  weapons: { title: '武器图鉴', description: '集中查看当前游戏可用武器及其属性、派生和制作资料。' },
  armor: { title: '防具图鉴', description: '集中查看防具部位、套装技能和制作资料。' },
  decorations: { title: '装饰品图鉴', description: '集中查看装饰品技能、槽位和制作资料。' },
  skills: { title: '技能图鉴', description: '集中查看技能发动效果以及防具、装饰品和护石来源。' },
  items: { title: '道具图鉴', description: '集中查看道具、素材和道具箱相关资料。' },
  monsters: { title: '怪物图鉴', description: '集中查看怪物肉质、异常耐性、掉落物和出没任务。' },
  quests: { title: '任务图鉴', description: '集中查看任务目标、报酬和解锁关系。' },
  'hunter-arts': { title: '狩技图鉴', description: '集中查看 MHGU/XX 狩技与解锁条件。' },
  'palico-types': { title: '支援倾向', description: '查看猎猫支援倾向和固有关联。' },
  'palico-support-moves': { title: '支援行动', description: '查看猎猫支援行动及解锁资料。' },
  'palico-skills': { title: '随从技能', description: '查看随从技能、记忆槽和解锁资料。' },
  'palico-equipment': { title: '猫装备', description: '查看猫武器、防具和制作材料。' },
  loadout: { title: '配装器', description: '未来将在这里手动组合装备、护石和装饰品，并提供自动配装功能。' },
}

type WorkspaceFeaturePageProps = { pageId: WorkspaceFeaturePageId }

export function WorkspaceFeaturePage({ pageId }: WorkspaceFeaturePageProps) {
  const { game } = useOutletContext<ShellOutletContext>()
  const [params] = useSearchParams()

  const baseContent = featureContent[pageId]
  const content = game.id === 'mhp3' ? {
    title: baseContent.title,
    description: pageId === 'save-editor'
      ? 'P3 的 PPSSPP 存档读取与修改功能待接入。'
      : pageId === 'loadout'
        ? 'P3 配装器待接入，将支持武器、防具、护石与装饰品组合。'
        : `P3 ${baseContent.title}待接入，资料完善后将在这里开放浏览。`,
  } : game.id === 'mhp2g' ? {
    title: baseContent.title,
    description: pageId === 'loadout'
      ? 'P2G 配装器待接入，将支持武器、防具和装饰品组合；本作没有护石。'
      : pageId === 'skills'
        ? 'P2G 技能图鉴待接入，将展示技能发动效果与防具、装饰品来源。'
        : `P2G ${baseContent.title}待接入。当前可从侧栏浏览道具图鉴。`,
  } : baseContent
  if (game.id === 'mhp2g' && params.get('q')) content.description += ` 关联对象：${params.get('q')}。`

  return (
    <div className="workspace-feature-page">
      <WorkspacePlaceholder game={game} {...content} />
    </div>
  )
}
