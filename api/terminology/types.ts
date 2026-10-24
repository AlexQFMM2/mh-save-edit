import type { ItemCatalogGameId, PageResult } from '../catalog/types'

export type ItemTermLabel = { termId: string; originalName: string; source: string; status: string; matchedAlias?: string }
export type ItemTerm = {
  id: string
  name: string
  nameJp: string
  source: string
  aliases: { name: string; gameId: ItemCatalogGameId; source: string }[]
  members: { gameId: ItemCatalogGameId; itemId: number; originalName: string; status: string }[]
}
export type ItemTermFilters = { query?: string; gameId?: ItemCatalogGameId; page?: number; pageSize?: number }
export type ItemTermPage = PageResult<ItemTerm> & { available: boolean; message?: string }
