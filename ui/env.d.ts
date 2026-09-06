import type { GameId } from '../api/core/loadout'
import type { ItemCatalogFilters, ItemDetail, ItemIdentity, ItemSummary, PageResult } from '../api/catalog/types'

declare global {
  interface Window {
    mhSaveEditor: {
      version: string
      catalog: {
        searchItems(filters: ItemCatalogFilters): Promise<PageResult<ItemSummary>>
        getItem(identity: ItemIdentity): Promise<ItemDetail | null>
        getItemFacets(gameId: GameId): Promise<{ rarities: number[]; maxStacks: number[]; relations: { sourceKind: string; usageKind: string | null }[] }>
      }
    }
  }
}

export {}
