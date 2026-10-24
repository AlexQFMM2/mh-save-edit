import { ArrowRight, BookOpen, FolderOpen, Hammer, Swords } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { hasRuntimeWorkspace, type GameVersionDefinition } from '../../data/gameVersions'
import { PlatformBadgeList } from '../PlatformBadgeList/PlatformBadgeList'
import './GameOverviewPanel.css'

const overviewLinks = [
  { title: '资料图鉴', description: '浏览道具、武器、防具与装饰品资料。', path: 'catalog/items', icon: BookOpen },
  { title: '修改', description: '读取存档后修改个人信息、装备箱与道具箱。', path: 'edit', icon: Hammer },
  { title: '配装器', description: '手动配装，并在其中使用自动配装功能。', path: 'edit/loadout', icon: Swords },
]

type GameOverviewPanelProps = {
  game: GameVersionDefinition
}

export function GameOverviewPanel({ game }: GameOverviewPanelProps) {
  const navigate = useNavigate()
  const available = hasRuntimeWorkspace(game)

  return (
    <article className="game-overview-panel">
      <header className="game-overview-panel__heading">
        <div>
          <p className="game-overview-panel__eyebrow">当前游戏工作区</p>
          <h1 className="game-overview-panel__title">{game.title}</h1>
          <p className="game-overview-panel__description">{available ? '从这里进入资料、存档修改与配装工具。' : 'P3 道具与装饰品图鉴已开放，支持中文资料、技能点、制作材料、调合及商店查询。'}</p>
        </div>
        <button className="game-overview-panel__open-save" type="button" disabled={!available} onClick={() => navigate(`/game/${game.id}/edit`)}>
          <FolderOpen size={17} aria-hidden="true" />
          打开存档
          <span className="game-overview-panel__save-hint">{available ? '选择环境' : '待接入'}</span>
        </button>
      </header>

      <div className="game-overview-panel__meta">
        <span className="game-overview-panel__meta-label">适用平台</span>
        <PlatformBadgeList platforms={game.platforms} showLabel={false} />
      </div>

      <section className="game-overview-panel__feature-grid" aria-label="功能入口">
        {overviewLinks.map((item) => {
          const Icon = item.icon
          return (
            <Link className="game-overview-panel__feature" key={item.path} to={`/game/${game.id}/${item.path}`}>
              <span className="game-overview-panel__feature-icon" aria-hidden="true"><Icon size={20} /></span>
              <span className="game-overview-panel__feature-copy">
                <strong className="game-overview-panel__feature-title">{item.title}</strong>
                <small className="game-overview-panel__feature-description">{available ? item.description : item.path === 'catalog/items' ? '浏览道具与装饰品资料、调合和已确认商店信息。' : '待接入 · 查看功能说明'}</small>
              </span>
              <ArrowRight className="game-overview-panel__feature-arrow" size={17} aria-hidden="true" />
            </Link>
          )
        })}
      </section>
    </article>
  )
}
