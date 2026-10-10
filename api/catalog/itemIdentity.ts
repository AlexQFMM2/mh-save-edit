import type { CatalogGameId, ItemIdentity } from './types'
export const itemNumber = (item: ItemIdentity): number => item.gameId === 'mhp2g' ? item.itemId : item.saveId
export const itemIdentity = (gameId: CatalogGameId, id: number): ItemIdentity => gameId === 'mhp2g' ? { gameId, itemId: id } : { gameId, saveId: id }
