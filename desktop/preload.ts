import { contextBridge, ipcRenderer } from 'electron'
import { catalogChannels } from '../api/catalog/channels'
import type { ItemCatalogFilters, ItemIdentity } from '../api/catalog/types'
import type { GameId } from '../api/core/loadout'

contextBridge.exposeInMainWorld('mhSaveEditor', {
  version: '0.1.0',
  catalog: {
    searchItems: (filters: ItemCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchItems, filters),
    getItem: (identity: ItemIdentity) => ipcRenderer.invoke(catalogChannels.getItem, identity),
    getItemFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getItemFacets, gameId),
  },
})
