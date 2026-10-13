import type { LoadoutGame } from '../api/loadout/types'
import type { P2gSkillEquipmentIdentity, P2gSkillEquipmentDetail } from '../api/catalog/p2gSkillTypes'
import type { CatalogGameId, CatalogItemSummary, CatalogItemDetail } from '../api/catalog/types'
import type { ItemTermFilters, ItemTermPage } from '../api/terminology/types'
import type { GameId } from '../api/core/loadout'
import type { ArmorCatalogFacets, ArmorCatalogFilters, ArmorDetail, ArmorIdentity, ArmorSetFilters, ArmorSetSummary, ArmorSummary, DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationIdentity, DecorationSummary, HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtDetail, HunterArtIdentity, HunterArtSummary, ItemCatalogFilters, ItemDetail, ItemIdentity, ItemSummary, MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterIdentity, MonsterSummary, PageResult, PalicoArmorDetail, PalicoArmorFilters, PalicoArmorSummary, PalicoCatalogFacets, PalicoEquipmentIdentity, PalicoSkillDetail, PalicoSkillFilters, PalicoSkillIdentity, PalicoSkillSummary, PalicoSupportMoveDetail, PalicoSupportMoveFilters, PalicoSupportMoveIdentity, PalicoSupportMoveSummary, PalicoTypeDetail, PalicoTypeIdentity, PalicoTypeSummary, PalicoWeaponDetail, PalicoWeaponFilters, PalicoWeaponSummary, QuestCatalogFacets, QuestCatalogFilters, QuestDetail, QuestIdentity, QuestSummary, SkillCatalogFacets, SkillCatalogFilters, SkillDetail, SkillIdentity, SkillSummary, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponIdentity, WeaponMotionCatalogResult, WeaponMotionFacets, WeaponMotionFilters, WeaponSummary, WeaponTreeResult } from '../api/catalog/types'
import type { AutoLoadoutJob, AutoLoadoutJobDetail, AutoLoadoutJobFilters, AutoLoadoutJobState, AutoLoadoutJobSummary, AutoLoadoutRequest, CharmValidationResult, LoadoutArmorCandidate, LoadoutArmorFilters, LoadoutCalculationSnapshot, LoadoutCatalogSnapshot, LoadoutCharm, LoadoutDecoration, LoadoutDecorationFilters, LoadoutFacets, LoadoutPage, LoadoutRelicLookup, LoadoutWeaponCandidate, LoadoutWeaponFilters, LogicalLoadout } from '../api/loadout/types'
import type { SaveArmorAppearanceFilters, SaveArmorAppearancePage, SaveBoxWriteTarget, SaveBoxWriteTargetRequest, SaveCatalogEquipmentRequest, SaveCatalogItemRequest, SaveCatalogItemWritePreview, SaveCharacterSummary, SaveCommand, SaveExportRequest, SaveImportApplyRequest, SaveImportPreview, SaveImportRequest, SaveLoadoutWritePreview, SaveLoadoutWriteRequest, SaveMutationResult, SaveOpenRequest, SaveOpenResult, SaveResult, SaveSectionRequest, SaveSectionSnapshot, SaveSessionSnapshot, SaveValidationResult } from '../api/save/types'

declare global {
  interface Window {
    mhSaveEditor: {
      version: string
      catalog: {
        searchItemTerms(filters: ItemTermFilters): Promise<ItemTermPage>
        searchItems(filters: ItemCatalogFilters & { gameId: GameId }): Promise<PageResult<ItemSummary>>
        searchItems(filters: ItemCatalogFilters): Promise<PageResult<CatalogItemSummary>>
        getItem(identity: {gameId: GameId; saveId: number}): Promise<ItemDetail | null>
        getItem(identity: ItemIdentity): Promise<CatalogItemDetail | null>
        getItemFacets(gameId: CatalogGameId): Promise<{ rarities: number[]; maxStacks: number[]; relations: { sourceKind: string; usageKind: string | null }[] }>
        searchDecorations(filters: DecorationCatalogFilters): Promise<PageResult<DecorationSummary>>
        getDecoration(identity: DecorationIdentity): Promise<DecorationDetail | null>
        getDecorationFacets(gameId: CatalogGameId): Promise<DecorationCatalogFacets>
        searchWeapons(filters: import('../api/catalog/p2gWeaponTypes').P2gWeaponFilters): Promise<import('../api/catalog/p2gWeaponTypes').P2gWeaponPage>
        searchWeapons(filters: WeaponCatalogFilters): Promise<PageResult<WeaponSummary>>
        getWeapon(identity: import('../api/catalog/p2gWeaponTypes').P2gWeaponIdentity): Promise<import('../api/catalog/p2gWeaponTypes').P2gWeaponDetail | null>
        getWeapon(identity: WeaponIdentity): Promise<WeaponDetail | null>
        getWeaponFacets(gameId: 'mhp2g'): Promise<import('../api/catalog/p2gWeaponTypes').P2gWeaponFacets>
        getWeaponFacets(gameId: GameId): Promise<WeaponCatalogFacets>
        getWeaponTree(gameId: 'mhp2g', weaponTypeId: number): Promise<import('../api/catalog/p2gWeaponTypes').P2gWeaponTree>
        getWeaponTree(gameId: GameId, weaponTypeId: number): Promise<WeaponTreeResult>
        searchWeaponMotions(filters: WeaponMotionFilters): Promise<WeaponMotionCatalogResult>
        getWeaponMotionFacets(gameId: GameId): Promise<WeaponMotionFacets>
        searchArmors(filters: import('../api/catalog/p2gArmorTypes').P2gArmorFilters): Promise<PageResult<import('../api/catalog/p2gArmorTypes').P2gArmorSummary>>
        searchArmors(filters: ArmorCatalogFilters): Promise<PageResult<ArmorSummary>>
        searchArmorSets(filters: import('../api/catalog/p2gArmorTypes').P2gArmorSetFilters): Promise<PageResult<import('../api/catalog/p2gArmorTypes').P2gArmorSetSummary>>
        searchArmorSets(filters: ArmorSetFilters): Promise<PageResult<ArmorSetSummary>>
        getArmor(identity: import('../api/catalog/p2gArmorTypes').P2gArmorIdentity): Promise<import('../api/catalog/p2gArmorTypes').P2gArmorDetail | null>
        getArmor(identity: ArmorIdentity): Promise<ArmorDetail | null>
        getArmorFacets(gameId: CatalogGameId): Promise<ArmorCatalogFacets>
        getP2gSkillEquipment(identity: P2gSkillEquipmentIdentity): Promise<P2gSkillEquipmentDetail | null>
        getSkill(identity: SkillIdentity): Promise<SkillDetail | null>
        searchSkills(filters: SkillCatalogFilters): Promise<PageResult<SkillSummary>>
        getSkillFacets(gameId: CatalogGameId): Promise<SkillCatalogFacets>
        searchMonsters(filters: MonsterCatalogFilters): Promise<MonsterSummary[]>
        getMonster(identity: MonsterIdentity): Promise<MonsterDetail | null>
        getMonsterFacets(gameId: CatalogGameId): Promise<MonsterCatalogFacets>
        getQuest(identity: QuestIdentity): Promise<QuestDetail | null>
        searchQuests(filters: QuestCatalogFilters): Promise<PageResult<QuestSummary>>
        getQuestFacets(gameId: import('../api/catalog/types').CatalogGameId): Promise<QuestCatalogFacets>
        searchHunterArts(filters: HunterArtCatalogFilters): Promise<HunterArtSummary[]>
        getHunterArt(identity: HunterArtIdentity): Promise<HunterArtDetail | null>
        getHunterArtFacets(gameId: GameId): Promise<HunterArtCatalogFacets>
        searchPalicoTypes(): Promise<PalicoTypeSummary[]>
        getPalicoType(identity: PalicoTypeIdentity): Promise<PalicoTypeDetail | null>
        searchPalicoSupportMoves(filters: PalicoSupportMoveFilters): Promise<PalicoSupportMoveSummary[]>
        getPalicoSupportMove(identity: PalicoSupportMoveIdentity): Promise<PalicoSupportMoveDetail | null>
        searchPalicoSkills(filters: PalicoSkillFilters): Promise<PalicoSkillSummary[]>
        getPalicoSkill(identity: PalicoSkillIdentity): Promise<PalicoSkillDetail | null>
        searchPalicoWeapons(filters: PalicoWeaponFilters): Promise<PageResult<PalicoWeaponSummary>>
        getPalicoWeapon(identity: PalicoEquipmentIdentity): Promise<PalicoWeaponDetail | null>
        searchPalicoArmors(filters: PalicoArmorFilters): Promise<PageResult<PalicoArmorSummary>>
        getPalicoArmor(identity: PalicoEquipmentIdentity): Promise<PalicoArmorDetail | null>
        getPalicoCatalogFacets(): Promise<PalicoCatalogFacets>
      }
      loadout: {
        searchWeapons(filters: LoadoutWeaponFilters): Promise<LoadoutPage<LoadoutWeaponCandidate>>
        searchArmors(filters: LoadoutArmorFilters): Promise<LoadoutPage<LoadoutArmorCandidate>>
        searchDecorations(filters: LoadoutDecorationFilters): Promise<LoadoutPage<LoadoutDecoration>>
        getFacets(gameId: LoadoutGame): Promise<LoadoutFacets>
        getBootstrap(gameId: LoadoutGame): Promise<LoadoutCalculationSnapshot>
        getSnapshot(gameId: LoadoutGame): Promise<LoadoutCatalogSnapshot>
        getRelicLookups(gameId: LoadoutGame): Promise<LoadoutRelicLookup[]>
        reconcileLoadout(loadout: LogicalLoadout): Promise<LogicalLoadout>
        validateCharm(charm: LoadoutCharm): Promise<CharmValidationResult>
        startAuto(request: AutoLoadoutRequest): Promise<AutoLoadoutJob>
        startAutoLoadout(request: AutoLoadoutRequest): Promise<AutoLoadoutJobSummary>
        listAutoLoadoutJobs(filters: AutoLoadoutJobFilters): Promise<AutoLoadoutJobSummary[]>
        getAutoLoadoutJob(jobId: string): Promise<AutoLoadoutJobDetail>
        controlAuto(jobId: string, action: 'pause' | 'resume' | 'cancel'): Promise<void>
        controlAutoLoadoutJob(jobId: string, action: 'pause' | 'resume' | 'cancel'): Promise<void>
        getAutoState(jobId: string): Promise<AutoLoadoutJobState>
        retryAutoLoadoutJob(jobId: string): Promise<AutoLoadoutJobSummary>
        deleteAutoLoadoutJobs(jobIds: string[]): Promise<void>
        markAutoLoadoutJobViewed(jobId: string): Promise<void>
        selectAutoLoadoutJobResult(jobId: string, fingerprint: string | null): Promise<void>
        subscribeAutoLoadoutJobs(listener: (summary: AutoLoadoutJobSummary) => void): () => void
      }
      save: {
        searchArmorAppearances(request: SaveArmorAppearanceFilters): Promise<SaveArmorAppearancePage>
        getSession(): Promise<SaveSessionSnapshot | null>
        open(request: SaveOpenRequest): Promise<SaveOpenResult>
        listCharacters(sessionId: string, revision: number): Promise<SaveCharacterSummary[]>
        selectCharacter(sessionId: string, revision: number, slot: number): Promise<SaveSessionSnapshot>
        getSection(request: SaveSectionRequest): Promise<SaveSectionSnapshot>
        applyCommand(command: SaveCommand): Promise<SaveMutationResult>
        undo(sessionId: string, revision: number): Promise<SaveMutationResult>
        redo(sessionId: string, revision: number): Promise<SaveMutationResult>
        validate(sessionId: string, revision: number): Promise<SaveValidationResult>
        saveCurrent(sessionId: string, revision: number): Promise<SaveResult>
        saveAs(sessionId: string, revision: number): Promise<SaveResult>
        close(sessionId: string, revision: number, discard?: boolean): Promise<void>
        previewImport(request: SaveImportRequest): Promise<SaveImportPreview | null>
        applyImport(request: SaveImportApplyRequest): Promise<SaveMutationResult>
        exportBox(request: SaveExportRequest): Promise<{ cancelled: boolean; message: string }>
        previewBoxWriteTarget(request: SaveBoxWriteTargetRequest): Promise<SaveBoxWriteTarget>
        previewCatalogItemWrite(request: SaveCatalogItemRequest): Promise<SaveCatalogItemWritePreview>
        addCatalogItem(request: SaveCatalogItemRequest): Promise<SaveMutationResult>
        addCatalogEquipment(request: SaveCatalogEquipmentRequest): Promise<SaveMutationResult>
        previewLoadoutWrite(request: SaveLoadoutWriteRequest): Promise<SaveLoadoutWritePreview>
        addLoadout(request: SaveLoadoutWriteRequest): Promise<SaveMutationResult>
        subscribe(listener: (snapshot: SaveSessionSnapshot | null) => void): () => void
      }
    }
  }
}

export {}
