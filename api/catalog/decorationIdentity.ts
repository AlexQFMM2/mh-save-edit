import type { DecorationCatalogGameId, DecorationIdentity } from './types'
export function decorationIdentity(gameId: DecorationCatalogGameId, id: number): DecorationIdentity {
  return gameId === 'mhp2g' || gameId === 'mhp3' ? { gameId, itemId: id } : { gameId, saveId: id }
}
export function decorationNumber(identity: DecorationIdentity): number {
  return identity.gameId === 'mhp2g' || identity.gameId === 'mhp3' ? identity.itemId : identity.saveId
}
