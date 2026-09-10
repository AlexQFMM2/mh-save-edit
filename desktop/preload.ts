import { contextBridge, ipcRenderer } from 'electron'
import { catalogChannels } from '../api/catalog/channels'
import type { ArmorCatalogFilters, ArmorIdentity, ArmorSetFilters, DecorationCatalogFilters, DecorationIdentity, HunterArtCatalogFilters, HunterArtIdentity, ItemCatalogFilters, ItemIdentity, MonsterCatalogFilters, MonsterIdentity, QuestCatalogFilters, QuestIdentity, SkillCatalogFilters, SkillIdentity, WeaponCatalogFilters, WeaponIdentity, WeaponMotionFilters } from '../api/catalog/types'
import type { GameId } from '../api/core/loadout'
import { loadoutChannels } from '../api/loadout/channels'
import type { AutoLoadoutJobFilters, AutoLoadoutJobSummary, AutoLoadoutRequest, LoadoutArmorFilters, LoadoutCharm, LoadoutDecorationFilters, LoadoutWeaponFilters, LogicalLoadout } from '../api/loadout/types'

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
    searchSkills: (filters: SkillCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchSkills, filters),
    getSkillFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getSkillFacets, gameId),
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
  loadout: {
    searchWeapons: (filters: LoadoutWeaponFilters) => ipcRenderer.invoke(loadoutChannels.searchWeapons, filters),
    searchArmors: (filters: LoadoutArmorFilters) => ipcRenderer.invoke(loadoutChannels.searchArmors, filters),
    searchDecorations: (filters: LoadoutDecorationFilters) => ipcRenderer.invoke(loadoutChannels.searchDecorations, filters),
    getFacets: (gameId: GameId) => ipcRenderer.invoke(loadoutChannels.getFacets, gameId),
    getBootstrap: (gameId: GameId) => ipcRenderer.invoke(loadoutChannels.getBootstrap, gameId),
    getSnapshot: (gameId: GameId) => ipcRenderer.invoke(loadoutChannels.getSnapshot, gameId),
    getRelicLookups: (gameId: GameId) => ipcRenderer.invoke(loadoutChannels.getRelicLookups, gameId),
    reconcileLoadout: (loadout: LogicalLoadout) => ipcRenderer.invoke(loadoutChannels.reconcileLoadout, loadout),
    validateCharm: (charm: LoadoutCharm) => ipcRenderer.invoke(loadoutChannels.validateCharm, charm),
    startAuto: (request: AutoLoadoutRequest) => ipcRenderer.invoke(loadoutChannels.startAuto, request),
    startAutoLoadout: (request: AutoLoadoutRequest) => ipcRenderer.invoke(loadoutChannels.startAuto, request),
    listAutoLoadoutJobs: (filters: AutoLoadoutJobFilters) => ipcRenderer.invoke(loadoutChannels.listAutoJobs, filters),
    getAutoLoadoutJob: (jobId: string) => ipcRenderer.invoke(loadoutChannels.getAutoJob, { jobId }),
    controlAuto: (jobId: string, action: 'pause' | 'resume' | 'cancel') => ipcRenderer.invoke(loadoutChannels.controlAuto, { jobId, action }),
    controlAutoLoadoutJob: (jobId: string, action: 'pause' | 'resume' | 'cancel') => ipcRenderer.invoke(loadoutChannels.controlAuto, { jobId, action }),
    getAutoState: (jobId: string) => ipcRenderer.invoke(loadoutChannels.getAutoState, { jobId }),
    retryAutoLoadoutJob: (jobId: string) => ipcRenderer.invoke(loadoutChannels.retryAutoJob, { jobId }),
    deleteAutoLoadoutJobs: (jobIds: string[]) => ipcRenderer.invoke(loadoutChannels.deleteAutoJobs, { jobIds }),
    markAutoLoadoutJobViewed: (jobId: string) => ipcRenderer.invoke(loadoutChannels.markAutoJobViewed, { jobId }),
    selectAutoLoadoutJobResult: (jobId: string, fingerprint: string | null) => ipcRenderer.invoke(loadoutChannels.selectAutoJobResult, { jobId, fingerprint }),
    subscribeAutoLoadoutJobs: (listener: (summary: AutoLoadoutJobSummary) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, summary: AutoLoadoutJobSummary) => listener(summary)
      ipcRenderer.on(loadoutChannels.autoJobsChanged, handler)
      return () => ipcRenderer.removeListener(loadoutChannels.autoJobsChanged, handler)
    },
  },
})
