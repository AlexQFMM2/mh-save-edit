import type { CatalogGameId, DecorationIdentity } from './types'
export function decorationIdentity(gameId: CatalogGameId, id: number): DecorationIdentity {
  return gameId === 'mhp2g' ? { gameId, itemId: id } : { gameId, saveId: id }
}
export function decorationNumber(identity: DecorationIdentity): number {
  return identity.gameId === 'mhp2g' ? identity.itemId : identity.saveId
}
