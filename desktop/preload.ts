import { contextBridge, ipcRenderer } from 'electron'
import { catalogChannels } from '../api/catalog/channels'
import type { DecorationCatalogFilters, DecorationIdentity, ItemCatalogFilters, ItemIdentity, WeaponCatalogFilters, WeaponIdentity } from '../api/catalog/types'
import type { GameId } from '../api/core/loadout'

contextBridge.exposeInMainWorld('mhSaveEditor', {
  version: '0.1.0',
  catalog: {
    searchItems: (filters: ItemCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchItems, filters),
    getItem: (identity: ItemIdentity) => ipcRenderer.invoke(catalogChannels.getItem, identity),
    getItemFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getItemFacets, gameId),
    searchDecorations: (filters: DecorationCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchDecorations, filters),
    getDecoration: (identity: DecorationIdentity) => ipcRenderer.invoke(catalogChannels.getDecoration, identity),
    getDecorationFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getDecorationFacets, gameId),
    searchWeapons: (filters: WeaponCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchWeapons, filters),
    getWeapon: (identity: WeaponIdentity) => ipcRenderer.invoke(catalogChannels.getWeapon, identity),
    getWeaponFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getWeaponFacets, gameId),
    getWeaponTree: (gameId: GameId, weaponTypeId: number) => ipcRenderer.invoke(catalogChannels.getWeaponTree, { gameId, weaponTypeId }),
  },
})
