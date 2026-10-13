// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { P2gHornSong } from '../api/catalog/p2gWeaponTypes'
import { P2gHuntingHornDetail } from '../ui/components/P2gHuntingHornDetail/P2gHuntingHornDetail'

// Synthetic semantics and values; these tests exercise presentation, not game data.
const song: P2gHornSong = { patternIndex: 0, effectIndex: 0, notes: [1, 1], nativePatternNewestFirst: [1, 1, 129, 0], effectNameJp: '合成效果', duration: null, repeatEffect: null, skillDuration: null,
  performance: { kind: 'timed', effectCn: '合成初次效果', repeatEffectCn: '合成重复效果', maestroEffectCn: '合成技能说明', conditions: ['已有更强效果时的合成条件'], precedingNoteNot: 1,
    normal: { initialSeconds: 17, repeatSeconds: 5, repeatCapSeconds: 5, repeatMode: 'replace' }, maestro: { initialSeconds: 23, repeatSeconds: 9, repeatCapSeconds: 9, repeatMode: 'replace' } } }
afterEach(cleanup)
async function mount(value: P2gHornSong) {
  const user = userEvent.setup()
  render(<P2gHuntingHornDetail special={{ kind: 'huntingHorn', notes: [1, 2, 3], songs: [value] }} />)
  const toggle = screen.getByRole('button', { name: '展开旋律（1）' })
  toggle.focus(); await user.keyboard('{Enter}')
  return user
}
describe('P2G reviewed horn presentation', () => {
  it('distinguishes timer replacement, skill times and note constraints with focusable disclosure', async () => {
    const user = await mount(song), table = screen.getByRole('table', { name: '效果时间（秒）' })
    expect(within(table).getByRole('cell', { name: '重设 5' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: '重设 9' })).toBeTruthy()
    expect(screen.getByText(/之前不能紧接白音符/)).toBeTruthy()
    expect(screen.queryByText(/未知/)).toBeNull()
    const summary = screen.getByText('技能与生效条件')
    expect(summary.parentElement?.hasAttribute('open')).toBe(false)
    await user.tab(); expect(document.activeElement).toBe(summary)
    // jsdom does not implement summary's native keyboard activation; Chromium covers it.
    await user.click(summary)
    expect(summary.parentElement?.hasAttribute('open')).toBe(true)
    expect(screen.getByText('已有更强效果时的合成条件')).toBeTruthy()
  })
  it('labels additive replay explicitly and does not invent a preceding-note constraint', async () => {
    const p = song.performance!; if (p.kind !== 'timed') throw Error('fixture')
    await mount({ ...song, performance: { ...p, precedingNoteNot: null, normal: { ...p.normal, repeatMode: 'extend' }, maestro: { ...p.maestro, repeatMode: 'extend' } } })
    expect(screen.getByRole('cell', { name: '+5' })).toBeTruthy()
    expect(screen.queryByText(/音符条件/)).toBeNull()
  })
  it('shows immediate effects without misleading zero-second timers', async () => {
    await mount({ ...song, performance: { ...song.performance!, kind: 'instant', normal: null, maestro: null, precedingNoteNot: null } })
    expect(screen.getByText('即时效果')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('吹笛名人：合成技能说明')).toBeTruthy()
  })
  it('keeps an honest fallback for older unsupplemented catalogs', async () => {
    await mount({ ...song, performance: undefined })
    expect(screen.getByText(/持续时间：未知.*重复演奏效果：未知/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
