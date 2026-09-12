import { ArrowLeft, ChevronLeft, ChevronRight, Gamepad2 } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { GameVersionDefinition } from '../../data/gameVersions'
import { getWorkspaceNavigation, workspacePath } from '../../data/workspaceNavigation'
import { useSaveSession } from '../SaveSessionProvider/SaveSessionProvider'
import './WorkspaceSidebar.css'

type WorkspaceSidebarProps = {
  game: GameVersionDefinition
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function WorkspaceSidebar({ game, collapsed, onCollapsedChange }: WorkspaceSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { navigationBlockReason, notify } = useSaveSession()

  return (
    <aside className={`workspace-sidebar${collapsed ? ' workspace-sidebar--collapsed' : ''}`} aria-label="游戏工具导航">
      <div className="workspace-sidebar__top">
        <button
          className="workspace-sidebar__back"
          type="button"
          onClick={() => navigationBlockReason ? notify(navigationBlockReason, 'warning') : navigate('/')}
          aria-label="返回选择游戏版本"
          title="返回选择游戏版本"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          <span>选择其他版本</span>
        </button>
        <button
          className="workspace-sidebar__toggle"
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRight size={17} aria-hidden="true" /> : <ChevronLeft size={17} aria-hidden="true" />}
        </button>
      </div>

      <div className="workspace-sidebar__game" title={collapsed ? game.title : undefined}>
        <span className="workspace-sidebar__game-icon" aria-hidden="true"><Gamepad2 size={19} /></span>
        <span className="workspace-sidebar__game-copy">
          <strong>{game.title}</strong>
          <small>{game.subtitle}</small>
        </span>
      </div>

      <nav className="workspace-sidebar__nav">
        <NavLink
          className={({ isActive }) => `workspace-sidebar__overview${isActive ? ' workspace-sidebar__overview--active' : ''}`}
          to={workspacePath(game.id, 'overview')}
          end
          title={collapsed ? '游戏总览' : undefined}
        >
          <Gamepad2 size={17} aria-hidden="true" />
          <span>游戏总览</span>
        </NavLink>

        {getWorkspaceNavigation(game.id).map((group) => {
          const GroupIcon = group.icon
          const groupIsActive = group.items.some((item) => location.pathname === workspacePath(game.id, item.path))

          return (
            <div className="workspace-sidebar__group" key={group.id}>
              <div className={`workspace-sidebar__group-label${groupIsActive ? ' workspace-sidebar__group-label--active' : ''}`} title={collapsed ? group.label : undefined}>
                <GroupIcon size={14} aria-hidden="true" />
                <span>{group.label}</span>
              </div>
              <div className="workspace-sidebar__items">
                {group.items.map((item) => {
                  const ItemIcon = item.icon
                  return (
                    <NavLink
                      className={({ isActive }) => `workspace-sidebar__item${isActive ? ' workspace-sidebar__item--active' : ''}`}
                      key={item.id}
                      to={workspacePath(game.id, item.path)}
                      end
                      title={collapsed ? item.label : undefined}
                    >
                      <ItemIcon size={16} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
