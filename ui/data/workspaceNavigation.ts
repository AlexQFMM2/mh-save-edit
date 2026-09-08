import {
  BookOpen,
  Hammer,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  PawPrint,
  type LucideIcon,
} from 'lucide-react'
import type { GameId } from '../../api/core/loadout'

export type WorkspaceNavItemId =
  | 'weapons'
  | 'armor'
  | 'decorations'
  | 'items'
  | 'monsters'
  | 'save-editor'
  | 'loadout'

export type SaveEditSectionId = 'personal-info' | 'equipment-box' | 'item-box' | 'palico'

export type SaveEditSection = {
  id: SaveEditSectionId
  label: string
  description: string
}

export type WorkspaceNavItem = {
  id: WorkspaceNavItemId
  label: string
  description: string
  path: string
  icon: LucideIcon
}

export type WorkspaceNavGroup = {
  id: 'catalog' | 'edit'
  label: string
  icon: LucideIcon
  items: WorkspaceNavItem[]
}

export const workspaceNavigation: WorkspaceNavGroup[] = [
  {
    id: 'catalog',
    label: '资料',
    icon: BookOpen,
    items: [
      { id: 'items', label: '道具', description: '查看道具、素材与持有信息', path: 'catalog/items', icon: PackageOpen },
      { id: 'decorations', label: '装饰品', description: '查看装饰品技能与制作资料', path: 'catalog/decorations', icon: Sparkles },
      { id: 'weapons', label: '武器', description: '查看武器图鉴与属性资料', path: 'catalog/weapons', icon: Swords },
      { id: 'armor', label: '防具', description: '查看防具套装与技能资料', path: 'catalog/armor', icon: Shield },
      { id: 'monsters', label: '怪物', description: '查看怪物肉质、异常、掉落与任务', path: 'catalog/monsters', icon: PawPrint },
    ],
  },
  {
    id: 'edit',
    label: '修改',
    icon: Hammer,
    items: [
      { id: 'save-editor', label: '修改', description: '读取存档并修改玩家、装备箱与道具箱', path: 'edit', icon: Hammer },
      { id: 'loadout', label: '配装器', description: '手动配装，并提供自动配装功能', path: 'edit/loadout', icon: Swords },
    ],
  },
]

const saveEditSections: SaveEditSection[] = [
  { id: 'personal-info', label: '个人信息', description: '修改玩家名称、性别与猎人资料。' },
  { id: 'equipment-box', label: '装备箱', description: '修改装备箱中的武器与防具。' },
  { id: 'item-box', label: '道具箱', description: '修改道具箱中的道具与素材。' },
  { id: 'palico', label: '猎猫', description: '修改猎猫资料、装备与技能。' },
]

export function getSaveEditSections(gameId: GameId): SaveEditSection[] {
  return saveEditSections.filter((section) => section.id !== 'palico' || gameId === 'mhgu')
}

export function workspacePath(gameId: GameId, path: string): string {
  return `/game/${gameId}/${path}`
}
