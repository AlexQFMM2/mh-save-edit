import { describe, expect, it } from 'vitest'
// @ts-expect-error Preparation module is JavaScript and intentionally not shipped.
import { extractTables, sources } from '../tools/snapshot_skill_wiki.mjs'

describe('skill Wiki snapshot table extraction', () => {
  it('expands rowspan without shifting level, threshold or effect', () => {
    const tables = extractTables(`<table><tr><th>系統</th><th>発動スキル</th><th>ポイント</th><th>効果</th></tr><tr><td rowspan="2">Synthetic tree</td><td>High</td><td>15</td><td>value +7<br>condition</td></tr><tr><td>Low</td><td>10</td><td>value +3</td></tr></table>`)
    expect(tables).toHaveLength(1)
    expect(tables[0].rows).toEqual([
      ['Synthetic tree', 'High', '15', 'value +7\ncondition'],
      ['Synthetic tree', 'Low', '10', 'value +3'],
    ])
  })
  it('ignores layout and navigation without skill effect headers', () => {
    expect(extractTables('<table><tr><td>menu</td></tr></table>')).toEqual([])
  })
  it('supports Chinese source headers', () => {
    expect(extractTables('<table><tr><th>技能</th><th>点数</th><th>效果</th></tr><tr><td>测试</td><td>-10</td><td>减益</td></tr></table>')[0].rows[0]).toEqual(['测试','-10','减益'])
  })
  it('does not label the XX source as independently verified GU', () => {
    expect(sources.filter((s: {game: string}) => s.game === 'mhgu').every((s: {version: string; caveat: string}) => s.version === 'MHXX' && s.caveat.includes('not independently verified'))).toBe(true)
  })
})
