import { contextBridge, ipcRenderer } from 'electron'
import { catalogChannels } from '../api/catalog/channels'
import type { ArmorCatalogFilters, ArmorIdentity, ArmorSetFilters, DecorationCatalogFilters, DecorationIdentity, HunterArtCatalogFilters, HunterArtIdentity, ItemCatalogFilters, ItemIdentity, MonsterCatalogFilters, MonsterIdentity, QuestCatalogFilters, QuestIdentity, SkillIdentity, WeaponCatalogFilters, WeaponIdentity, WeaponMotionFilters } from '../api/catalog/types'
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
    searchWeaponMotions: (filters: WeaponMotionFilters) => ipcRenderer.invoke(catalogChannels.searchWeaponMotions, filters),
    getWeaponMotionFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getWeaponMotionFacets, gameId),
    searchArmors: (filters: ArmorCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchArmors, filters),
    searchArmorSets: (filters: ArmorSetFilters) => ipcRenderer.invoke(catalogChannels.searchArmorSets, filters),
    getArmor: (identity: ArmorIdentity) => ipcRenderer.invoke(catalogChannels.getArmor, identity),
    getArmorFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getArmorFacets, gameId),
    getSkill: (identity: SkillIdentity) => ipcRenderer.invoke(catalogChannels.getSkill, identity),
    searchMonsters: (filters: MonsterCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchMonsters, filters),
    getMonster: (identity: MonsterIdentity) => ipcRenderer.invoke(catalogChannels.getMonster, identity),
    getMonsterFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getMonsterFacets, gameId),
    getQuest: (identity: QuestIdentity) => ipcRenderer.invoke(catalogChannels.getQuest, identity),
    searchQuests: (filters: QuestCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchQuests, filters),
    getQuestFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getQuestFacets, gameId),
    searchHunterArts: (filters: HunterArtCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchHunterArts, filters),
    getHunterArt: (identity: HunterArtIdentity) => ipcRenderer.invoke(catalogChannels.getHunterArt, identity),
    getHunterArtFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getHunterArtFacets, gameId),
  },
})
