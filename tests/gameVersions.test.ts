import { describe, expect, it } from 'vitest'
import { gameVersions } from '../ui/data/gameVersions'

describe('game version definitions', () => {
  it('exposes P3 after P2G in display order', () => {
    expect(gameVersions.map(({ id }) => id)).toEqual(['mhp2g', 'mhp3', 'mh3g', 'mh4g', 'mhgu'])
  })

  it('maps each game to its supported emulator platforms', () => {
    expect(Object.fromEntries(gameVersions.map(({ id, platforms }) => [id, platforms]))).toEqual({
      mhp2g: ['ppsspp'],
      mhp3: ['ppsspp'],
      mh3g: ['citra', 'cemu'],
      mh4g: ['citra'],
      mhgu: ['citra', 'yuzu'],
    })
  })

  it('provides a hover background for every game', () => {
    expect(gameVersions.every(({ backgroundPath }) => backgroundPath.length > 0)).toBe(true)
  })
})
