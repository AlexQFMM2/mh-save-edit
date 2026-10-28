import type { WeaponCatalogGameId } from '../api/catalog/types'
import type { P3WeaponIdentity, P3WeaponFilters } from '../api/catalog/p3WeaponTypes'
import type { ArmorCatalogGameId } from '../api/catalog/types'
import type { P3ArmorFilters, P3ArmorSetFilters, P3ArmorIdentity } from '../api/catalog/p3ArmorTypes'
import type { P3SkillArmorIdentity, P3SkillArmorDetail } from '../api/catalog/p3SkillTypes'
import type { SkillCatalogGameId } from '../api/catalog/types'
import type { DecorationCatalogGameId } from '../api/catalog/types'
import type { LoadoutGame } from '../api/loadout/types'
import type { P2gArmorFilters, P2gArmorSetFilters, P2gArmorIdentity } from '../api/catalog/p2gArmorTypes'
import type { P2gSkillEquipmentIdentity, P2gSkillEquipmentDetail } from '../api/catalog/p2gSkillTypes'
import type { P2gWeaponIdentity, P2gWeaponFilters } from '../api/catalog/p2gWeaponTypes'
import type { CatalogGameId, ItemCatalogGameId } from '../api/catalog/types'
import type { ItemTermFilters } from '../api/terminology/types'
import { contextBridge, ipcRenderer } from 'electron'
import { catalogChannels } from '../api/catalog/channels'
import type { ArmorCatalogFilters, ArmorIdentity, ArmorSetFilters, DecorationCatalogFilters, DecorationIdentity, HunterArtCatalogFilters, HunterArtIdentity, ItemCatalogFilters, ItemIdentity, MonsterCatalogFilters, MonsterIdentity, PalicoArmorFilters, PalicoEquipmentIdentity, PalicoSkillFilters, PalicoSkillIdentity, PalicoSupportMoveFilters, PalicoSupportMoveIdentity, PalicoTypeIdentity, PalicoWeaponFilters, QuestCatalogFilters, QuestIdentity, SkillCatalogFilters, SkillIdentity, WeaponCatalogFilters, WeaponIdentity, WeaponMotionFilters } from '../api/catalog/types'
import type { GameId } from '../api/core/loadout'
import { loadoutChannels } from '../api/loadout/channels'
import type { AutoLoadoutJobFilters, AutoLoadoutJobSummary, AutoLoadoutRequest, LoadoutArmorFilters, LoadoutCharm, LoadoutDecorationFilters, LoadoutWeaponFilters, LogicalLoadout } from '../api/loadout/types'
import { saveChannels } from '../api/save/channels'
import type { SaveArmorAppearanceFilters, SaveBoxWriteTargetRequest, SaveCatalogEquipmentRequest, SaveCatalogItemRequest, SaveCommand, SaveExportRequest, SaveImportApplyRequest, SaveImportRequest, SaveLoadoutWriteRequest, SaveOpenRequest, SaveSectionRequest, SaveSessionSnapshot } from '../api/save/types'

contextBridge.exposeInMainWorld('mhSaveEditor', {
  version: '0.1.0',
  catalog: {
    searchItemTerms: (filters: ItemTermFilters) => ipcRenderer.invoke(catalogChannels.searchItemTerms, filters),
    searchItems: (filters: ItemCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchItems, filters),
    getItem: (identity: ItemIdentity) => ipcRenderer.invoke(catalogChannels.getItem, identity),
    getItemFacets: (gameId: ItemCatalogGameId) => ipcRenderer.invoke(catalogChannels.getItemFacets, gameId),
    searchDecorations: (filters: DecorationCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchDecorations, filters),
    getDecoration: (identity: DecorationIdentity) => ipcRenderer.invoke(catalogChannels.getDecoration, identity),
    getDecorationFacets: (gameId: DecorationCatalogGameId) => ipcRenderer.invoke(catalogChannels.getDecorationFacets, gameId),
    searchWeapons: (filters: WeaponCatalogFilters | P2gWeaponFilters | P3WeaponFilters) => ipcRenderer.invoke(catalogChannels.searchWeapons, filters),
    getWeapon: (identity: WeaponIdentity | P2gWeaponIdentity | P3WeaponIdentity) => ipcRenderer.invoke(catalogChannels.getWeapon, identity),
    getWeaponFacets: (gameId: WeaponCatalogGameId) => ipcRenderer.invoke(catalogChannels.getWeaponFacets, gameId),
    getWeaponTree: (gameId: WeaponCatalogGameId, weaponTypeId: number) => ipcRenderer.invoke(catalogChannels.getWeaponTree, { gameId, weaponTypeId }),
    searchWeaponMotions: (filters: WeaponMotionFilters) => ipcRenderer.invoke(catalogChannels.searchWeaponMotions, filters),
    getWeaponMotionFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getWeaponMotionFacets, gameId),
    searchArmors: (filters: ArmorCatalogFilters | P2gArmorFilters | P3ArmorFilters) => ipcRenderer.invoke(catalogChannels.searchArmors, filters),
    searchArmorSets: (filters: ArmorSetFilters | P2gArmorSetFilters | P3ArmorSetFilters) => ipcRenderer.invoke(catalogChannels.searchArmorSets, filters),
    getArmor: (identity: ArmorIdentity | P2gArmorIdentity | P3ArmorIdentity) => ipcRenderer.invoke(catalogChannels.getArmor, identity),
    getArmorFacets: (gameId: ArmorCatalogGameId) => ipcRenderer.invoke(catalogChannels.getArmorFacets, gameId),
    getP3SkillArmor: (identity: P3SkillArmorIdentity): Promise<P3SkillArmorDetail | null> => ipcRenderer.invoke(catalogChannels.getP3SkillArmor, identity),
    getP2gSkillEquipment: (identity: P2gSkillEquipmentIdentity): Promise<P2gSkillEquipmentDetail | null> => ipcRenderer.invoke(catalogChannels.getP2gSkillEquipment, identity),
    getSkill: (identity: SkillIdentity) => ipcRenderer.invoke(catalogChannels.getSkill, identity),
    searchSkills: (filters: SkillCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchSkills, filters),
    getSkillFacets: (gameId: SkillCatalogGameId) => ipcRenderer.invoke(catalogChannels.getSkillFacets, gameId),
    searchMonsters: (filters: MonsterCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchMonsters, filters),
    getMonster: (identity: MonsterIdentity) => ipcRenderer.invoke(catalogChannels.getMonster, identity),
    getMonsterFacets: (gameId: CatalogGameId) => ipcRenderer.invoke(catalogChannels.getMonsterFacets, gameId),
    getQuest: (identity: QuestIdentity) => ipcRenderer.invoke(catalogChannels.getQuest, identity),
    searchQuests: (filters: QuestCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchQuests, filters),
    getQuestFacets: (gameId: import('../api/catalog/types').CatalogGameId) => ipcRenderer.invoke(catalogChannels.getQuestFacets, gameId),
    searchHunterArts: (filters: HunterArtCatalogFilters) => ipcRenderer.invoke(catalogChannels.searchHunterArts, filters),
    getHunterArt: (identity: HunterArtIdentity) => ipcRenderer.invoke(catalogChannels.getHunterArt, identity),
    getHunterArtFacets: (gameId: GameId) => ipcRenderer.invoke(catalogChannels.getHunterArtFacets, gameId),
    searchPalicoTypes: () => ipcRenderer.invoke(catalogChannels.searchPalicoTypes, 'mhgu'),
    getPalicoType: (identity: PalicoTypeIdentity) => ipcRenderer.invoke(catalogChannels.getPalicoType, identity),
    searchPalicoSupportMoves: (filters: PalicoSupportMoveFilters) => ipcRenderer.invoke(catalogChannels.searchPalicoSupportMoves, filters),
    getPalicoSupportMove: (identity: PalicoSupportMoveIdentity) => ipcRenderer.invoke(catalogChannels.getPalicoSupportMove, identity),
    searchPalicoSkills: (filters: PalicoSkillFilters) => ipcRenderer.invoke(catalogChannels.searchPalicoSkills, filters),
    getPalicoSkill: (identity: PalicoSkillIdentity) => ipcRenderer.invoke(catalogChannels.getPalicoSkill, identity),
    searchPalicoWeapons: (filters: PalicoWeaponFilters) => ipcRenderer.invoke(catalogChannels.searchPalicoWeapons, filters),
    getPalicoWeapon: (identity: PalicoEquipmentIdentity) => ipcRenderer.invoke(catalogChannels.getPalicoWeapon, identity),
    searchPalicoArmors: (filters: PalicoArmorFilters) => ipcRenderer.invoke(catalogChannels.searchPalicoArmors, filters),
    getPalicoArmor: (identity: PalicoEquipmentIdentity) => ipcRenderer.invoke(catalogChannels.getPalicoArmor, identity),
    getPalicoCatalogFacets: () => ipcRenderer.invoke(catalogChannels.getPalicoCatalogFacets, 'mhgu'),
  },
  loadout: {
    searchWeapons: (filters: LoadoutWeaponFilters) => ipcRenderer.invoke(loadoutChannels.searchWeapons, filters),
    searchArmors: (filters: LoadoutArmorFilters) => ipcRenderer.invoke(loadoutChannels.searchArmors, filters),
    searchDecorations: (filters: LoadoutDecorationFilters) => ipcRenderer.invoke(loadoutChannels.searchDecorations, filters),
    getFacets: (gameId: LoadoutGame) => ipcRenderer.invoke(loadoutChannels.getFacets, gameId),
    getBootstrap: (gameId: LoadoutGame) => ipcRenderer.invoke(loadoutChannels.getBootstrap, gameId),
    getSnapshot: (gameId: LoadoutGame) => ipcRenderer.invoke(loadoutChannels.getSnapshot, gameId),
    getRelicLookups: (gameId: LoadoutGame) => ipcRenderer.invoke(loadoutChannels.getRelicLookups, gameId),
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
  save: {
    searchArmorAppearances: (request: SaveArmorAppearanceFilters) => ipcRenderer.invoke(saveChannels.searchArmorAppearances, request),
    getSession: () => ipcRenderer.invoke(saveChannels.getSession),
    open: (request: SaveOpenRequest) => ipcRenderer.invoke(saveChannels.open, request),
    listCharacters: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.listCharacters, { sessionId, revision }),
    selectCharacter: (sessionId: string, revision: number, slot: number) => ipcRenderer.invoke(saveChannels.selectCharacter, { sessionId, revision, slot }),
    getSection: (request: SaveSectionRequest) => ipcRenderer.invoke(saveChannels.getSection, request),
    applyCommand: (command: SaveCommand) => ipcRenderer.invoke(saveChannels.applyCommand, command),
    undo: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.undo, { sessionId, revision }),
    redo: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.redo, { sessionId, revision }),
    validate: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.validate, { sessionId, revision }),
    saveCurrent: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.saveCurrent, { sessionId, revision }),
    saveAs: (sessionId: string, revision: number) => ipcRenderer.invoke(saveChannels.saveAs, { sessionId, revision }),
    close: (sessionId: string, revision: number, discard = false) => ipcRenderer.invoke(saveChannels.close, { sessionId, revision, discard }),
    previewImport: (request: SaveImportRequest) => ipcRenderer.invoke(saveChannels.previewImport, request),
    applyImport: (request: SaveImportApplyRequest) => ipcRenderer.invoke(saveChannels.applyImport, request),
    exportBox: (request: SaveExportRequest) => ipcRenderer.invoke(saveChannels.exportBox, request),
    previewBoxWriteTarget: (request: SaveBoxWriteTargetRequest) => ipcRenderer.invoke(saveChannels.previewBoxWriteTarget, request),
    previewCatalogItemWrite: (request: SaveCatalogItemRequest) => ipcRenderer.invoke(saveChannels.previewCatalogItemWrite, request),
    addCatalogItem: (request: SaveCatalogItemRequest) => ipcRenderer.invoke(saveChannels.addCatalogItem, request),
    addCatalogEquipment: (request: SaveCatalogEquipmentRequest) => ipcRenderer.invoke(saveChannels.addCatalogEquipment, request),
    previewLoadoutWrite: (request: SaveLoadoutWriteRequest) => ipcRenderer.invoke(saveChannels.previewLoadoutWrite, request),
    addLoadout: (request: SaveLoadoutWriteRequest) => ipcRenderer.invoke(saveChannels.addLoadout, request),
    subscribe: (listener: (snapshot: SaveSessionSnapshot | null) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: SaveSessionSnapshot | null) => listener(snapshot)
      ipcRenderer.on(saveChannels.sessionChanged, handler)
      return () => ipcRenderer.removeListener(saveChannels.sessionChanged, handler)
    },
  },
})
