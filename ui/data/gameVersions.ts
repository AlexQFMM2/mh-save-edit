import type { GameId } from '../../api/core/loadout'

export type PlatformId = 'citra' | 'cemu' | 'yuzu'

export type GameVersionDefinition = {
  id: GameId
  title: string
  subtitle: string
  posterPath: string
  posterAlt: string
  backgroundPath: string
  platforms: PlatformId[]
}

export const gameVersions: GameVersionDefinition[] = [
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
