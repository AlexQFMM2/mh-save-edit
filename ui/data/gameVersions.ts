import type { GameId } from '../../api/core/loadout'

export type WorkspaceGameId = GameId | 'mhp2g'
export type PlatformId = 'citra' | 'cemu' | 'yuzu' | 'ppsspp'

export type GameVersionDefinition = {
  id: WorkspaceGameId
  title: string
  subtitle: string
  posterPath: string
  posterAlt: string
  backgroundPath: string
  platforms: PlatformId[]
}

export type RuntimeGameVersionDefinition = GameVersionDefinition & { id: GameId }

// P2G has dedicated item/monster catalogs; it must not use legacy save/loadout adapters.
export function hasRuntimeWorkspace(game: GameVersionDefinition): game is RuntimeGameVersionDefinition {
  return game.id !== 'mhp2g'
}

export const gameVersions: GameVersionDefinition[] = [
  {
    id: 'mhp2g',
    title: 'Monster Hunter Portable 2nd G',
    subtitle: 'MHP2G · PSP',
    posterPath: 'home/p2g-post.png',
    posterAlt: 'Monster Hunter Portable 2nd G 标题海报',
    backgroundPath: 'home/p2g-bg.webp',
    platforms: ['ppsspp'],
  },
  {
    id: 'mh3g',
    title: 'Monster Hunter 3G',
    subtitle: 'MH3G / MH3U',
    posterPath: 'home/3g-post.png',
    posterAlt: 'Monster Hunter 3G HD Ver. 标题海报',
    backgroundPath: 'home/3g-bg.webp',
    platforms: ['citra', 'cemu'],
  },
  {
    id: 'mh4g',
    title: 'Monster Hunter 4G',
    subtitle: 'MH4G / MH4U',
    posterPath: 'home/4g-post.png',
    posterAlt: 'Monster Hunter 4G 标题海报',
    backgroundPath: 'home/4g-bg.webp',
    platforms: ['citra'],
  },
  {
    id: 'mhgu',
    title: 'Monster Hunter GU / XX',
    subtitle: 'Generations Ultimate / Double Cross',
    posterPath: 'home/gu-post.png',
    posterAlt: 'Monster Hunter Generations Ultimate / XX 标题海报',
    backgroundPath: 'home/gu-bg.jpg',
    platforms: ['citra', 'yuzu'],
  },
]
