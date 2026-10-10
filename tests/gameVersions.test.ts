import { describe, expect, it } from 'vitest'
import { gameVersions } from '../ui/data/gameVersions'

describe('game version definitions', () => {
  it('exposes P2G alongside the three existing games in display order', () => {
    expect(gameVersions.map(({ id }) => id)).toEqual(['mhp2g', 'mh3g', 'mh4g', 'mhgu'])
  })

  it('maps each game to its supported emulator platforms', () => {
    expect(Object.fromEntries(gameVersions.map(({ id, platforms }) => [id, platforms]))).toEqual({
      mhp2g: ['ppsspp'],
      mh3g: ['citra', 'cemu'],
      mh4g: ['citra'],
      mhgu: ['citra', 'yuzu'],
    })
  })

  it('provides a hover background for every game', () => {
    expect(gameVersions.every(({ backgroundPath }) => backgroundPath.length > 0)).toBe(true)
  })
})
