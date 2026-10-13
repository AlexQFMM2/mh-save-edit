import {
  BookOpen,
  Hammer,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  PawPrint,
  ScrollText,
  Zap,
  ListTree,
  type LucideIcon,
} from 'lucide-react'
import type { GameId } from '../../api/core/loadout'
import type { WorkspaceGameId } from './gameVersions'

export type WorkspaceNavItemId =
  | 'weapons'
  | 'armor'
  | 'decorations'
  | 'skills'
  | 'items'
  | 'monsters'
  | 'quests'
  | 'hunter-arts'
  | 'palico-types'
  | 'palico-support-moves'
  | 'palico-skills'
  | 'palico-equipment'
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
  supportedGames?: WorkspaceGameId[]
}

export type WorkspaceNavGroup = {
  id: 'catalog' | 'palico-catalog' | 'edit'
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
      { id: 'skills', label: '技能', description: '查看发动效果与装备、装饰品和护石来源', path: 'catalog/skills', icon: ListTree },
      { id: 'weapons', label: '武器', description: '查看武器图鉴与属性资料', path: 'catalog/weapons', icon: Swords },
      { id: 'armor', label: '防具', description: '查看防具套装与技能资料', path: 'catalog/armor', icon: Shield },
      { id: 'monsters', label: '怪物', description: '查看怪物肉质、异常、掉落与任务', path: 'catalog/monsters', icon: PawPrint },
      { id: 'quests', label: '任务', description: '查看任务目标、报酬与解锁关系', path: 'catalog/quests', icon: ScrollText },
      { id: 'hunter-arts', label: '狩技', description: '查看狩技说明与解锁条件', path: 'catalog/hunter-arts', icon: Zap, supportedGames: ['mhgu'] },
    ],
  },
  {
    id: 'palico-catalog',
    label: '猎猫',
    icon: PawPrint,
    items: [
      { id: 'palico-types', label: '支援倾向', description: '查看八种猎猫支援倾向', path: 'catalog/palico/types', icon: PawPrint, supportedGames: ['mhgu'] },
      { id: 'palico-support-moves', label: '支援行动', description: '查看支援行动、分组与解锁条件', path: 'catalog/palico/support-moves', icon: Sparkles, supportedGames: ['mhgu'] },
      { id: 'palico-skills', label: '随从技能', description: '查看随从技能、记忆槽与解锁条件', path: 'catalog/palico/skills', icon: ListTree, supportedGames: ['mhgu'] },
      { id: 'palico-equipment', label: '猫装备', description: '查看猫武器与头部、身体防具', path: 'catalog/palico/equipment', icon: Shield, supportedGames: ['mhgu'] },
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

export function getSaveEditSections(gameId: WorkspaceGameId): SaveEditSection[] {
  return saveEditSections.filter((section) => section.id !== 'palico' || gameId === 'mhgu')
}

export function workspacePath(gameId: WorkspaceGameId, path: string): string {
  return `/game/${gameId}/${path}`
}

export function getWorkspaceNavigation(gameId: WorkspaceGameId): WorkspaceNavGroup[] {
  return workspaceNavigation.map(group => ({
    ...group,
    items: group.items
      .filter(item => !item.supportedGames || item.supportedGames.includes(gameId))
      .map(item => gameId === 'mhp2g' && item.id === 'skills'
        ? { ...item, description: '查看发动效果与装备、装饰品来源' }
        : item),
  })).filter(group => group.items.length > 0)
}
