// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CommonHeader } from '../ui/components/CommonHeader/CommonHeader'
import { gameVersions } from '../ui/data/gameVersions'

const entry = { id: 'synthetic', name: '示例首选名', nameJp: 'テスト名', source: 'GU 官方简中', aliases: [{ name: '示例旧名', gameId: 'mhp2g', source: '本作原译名' }], members: [{ gameId: 'mhp2g', itemId: 1, originalName: '示例旧名', status: 'matched' }] }
const search = vi.fn()
beforeEach(() => {
  search.mockReset().mockResolvedValue({ available: true, items: [entry], total: 31, page: 1, pageSize: 30, hasNext: true })
  Object.defineProperty(window, 'mhSaveEditor', { configurable: true, value: { catalog: { searchItemTerms: search } } })
})
afterEach(cleanup)
it('opens globally, shows provenance, searches/paginates, and restores focus on Escape', async () => {
  const user = userEvent.setup()
  render(<CommonHeader currentGame={gameVersions.find(game => game.id === 'mhp2g')} />)
  const trigger = screen.getByRole('button', { name: '译名词典' })
  await user.click(trigger)
  expect(screen.getByRole('dialog', { name: '译名词典' })).toBeTruthy()
  const input = screen.getByRole('textbox', { name: '搜索' })
  expect(document.activeElement).toBe(input)
  await screen.findByRole('heading', { name: '示例首选名' })
  expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ gameId: 'mhp2g', page: 1 }))
  await user.click(screen.getByRole('button', { name: '下一页' }))
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  await user.type(input, '旧名')
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: '旧名', page: 1 })))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
it('shows missing/error states and can retry without losing the query', async () => {
  const user = userEvent.setup()
  search.mockRejectedValueOnce(new Error('synthetic failure'))
  render(<CommonHeader />)
  await user.click(screen.getByRole('button', { name: '译名词典' }))
  await screen.findByRole('alert')
  await user.click(screen.getByRole('button', { name: '重试' }))
  await screen.findByRole('heading', { name: '示例首选名' })
  search.mockResolvedValue({ available: false, message: '词典未安装', items: [], total: 0, page: 1, pageSize: 30, hasNext: false })
  await user.type(screen.getByRole('textbox', { name: '搜索' }), 'missing')
  await screen.findByText('词典未安装')
})
