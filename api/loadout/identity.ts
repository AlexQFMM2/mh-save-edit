import type { LoadoutDecoration, LoadoutGame } from './types'

/** Numeric catalog identity for a picker already scoped to one game. Never a save-ID conversion. */
export function decorationId(value: LoadoutDecoration): number {
  return value.gameId === 'mhp2g' ? value.itemId : value.saveId
}

export function decorationKey(value: LoadoutDecoration): string {
  return value.gameId === 'mhp2g' ? `mhp2g:item:${value.itemId}` : `save:${value.saveId}`
}

export function isDecorationForGame(value: LoadoutDecoration, gameId: LoadoutGame): boolean {
  return gameId === 'mhp2g' ? value.gameId === 'mhp2g' : value.gameId !== 'mhp2g' && (!value.gameId || value.gameId === gameId)
}
