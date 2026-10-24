import type { ItemCatalogGameId, ItemIdentity } from './types'
export const itemNumber = (item: ItemIdentity): number => (item.gameId === 'mhp2g' || item.gameId === 'mhp3') ? item.itemId : item.saveId
export const itemIdentity = (gameId: ItemCatalogGameId, id: number): ItemIdentity => (gameId === 'mhp2g' || gameId === 'mhp3') ? { gameId, itemId: id } : { gameId, saveId: id }
