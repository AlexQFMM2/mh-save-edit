import type { LoadoutDecoration, LoadoutGame } from './types'

/** P2G and P3 decorations use the item catalog as their identity; other games use save IDs. */
const itemIdentity = (gameId: LoadoutGame) => gameId === 'mhp2g' || gameId === 'mhp3'

/** Numeric catalog identity for a picker already scoped to one game. Never a save-ID conversion. */
export function decorationId(value: LoadoutDecoration): number {
  return value.gameId === 'mhp2g' || value.gameId === 'mhp3' ? (value as { itemId: number }).itemId : (value as { saveId: number }).saveId
}

export function decorationKey(value: LoadoutDecoration): string {
  if (value.gameId === 'mhp2g' || value.gameId === 'mhp3') return `${value.gameId}:item:${value.itemId}`
  return `save:${value.saveId}`
}

export function isDecorationForGame(value: LoadoutDecoration, gameId: LoadoutGame): boolean {
  if (itemIdentity(gameId)) return value.gameId === gameId
  return !itemIdentity(value.gameId as LoadoutGame) && (!value.gameId || value.gameId === gameId)
}
