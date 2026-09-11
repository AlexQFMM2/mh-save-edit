import type { GameId } from '../api/core/loadout'
import type { ArmorCatalogFacets, ArmorCatalogFilters, ArmorDetail, ArmorIdentity, ArmorSetFilters, ArmorSetSummary, ArmorSummary, DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationIdentity, DecorationSummary, HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtDetail, HunterArtIdentity, HunterArtSummary, ItemCatalogFilters, ItemDetail, ItemIdentity, ItemSummary, MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterIdentity, MonsterSummary, PageResult, PalicoArmorDetail, PalicoArmorFilters, PalicoArmorSummary, PalicoCatalogFacets, PalicoEquipmentIdentity, PalicoSkillDetail, PalicoSkillFilters, PalicoSkillIdentity, PalicoSkillSummary, PalicoSupportMoveDetail, PalicoSupportMoveFilters, PalicoSupportMoveIdentity, PalicoSupportMoveSummary, PalicoTypeDetail, PalicoTypeIdentity, PalicoTypeSummary, PalicoWeaponDetail, PalicoWeaponFilters, PalicoWeaponSummary, QuestCatalogFacets, QuestCatalogFilters, QuestDetail, QuestIdentity, QuestSummary, SkillCatalogFacets, SkillCatalogFilters, SkillDetail, SkillIdentity, SkillSummary, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponIdentity, WeaponMotionCatalogResult, WeaponMotionFacets, WeaponMotionFilters, WeaponSummary, WeaponTreeResult } from '../api/catalog/types'
import type { AutoLoadoutJob, AutoLoadoutJobDetail, AutoLoadoutJobFilters, AutoLoadoutJobState, AutoLoadoutJobSummary, AutoLoadoutRequest, CharmValidationResult, LoadoutArmorCandidate, LoadoutArmorFilters, LoadoutCalculationSnapshot, LoadoutCatalogSnapshot, LoadoutCharm, LoadoutDecoration, LoadoutDecorationFilters, LoadoutFacets, LoadoutPage, LoadoutRelicLookup, LoadoutWeaponCandidate, LoadoutWeaponFilters, LogicalLoadout } from '../api/loadout/types'

declare global {
  interface Window {
    mhSaveEditor: {
      version: string
      catalog: {
        searchItems(filters: ItemCatalogFilters): Promise<PageResult<ItemSummary>>
        getItem(identity: ItemIdentity): Promise<ItemDetail | null>
        getItemFacets(gameId: GameId): Promise<{ rarities: number[]; maxStacks: number[]; relations: { sourceKind: string; usageKind: string | null }[] }>
        searchDecorations(filters: DecorationCatalogFilters): Promise<PageResult<DecorationSummary>>
        getDecoration(identity: DecorationIdentity): Promise<DecorationDetail | null>
        getDecorationFacets(gameId: GameId): Promise<DecorationCatalogFacets>
        searchWeapons(filters: WeaponCatalogFilters): Promise<PageResult<WeaponSummary>>
        getWeapon(identity: WeaponIdentity): Promise<WeaponDetail | null>
        getWeaponFacets(gameId: GameId): Promise<WeaponCatalogFacets>
        getWeaponTree(gameId: GameId, weaponTypeId: number): Promise<WeaponTreeResult>
        searchWeaponMotions(filters: WeaponMotionFilters): Promise<WeaponMotionCatalogResult>
        getWeaponMotionFacets(gameId: GameId): Promise<WeaponMotionFacets>
        searchArmors(filters: ArmorCatalogFilters): Promise<PageResult<ArmorSummary>>
        searchArmorSets(filters: ArmorSetFilters): Promise<PageResult<ArmorSetSummary>>
        getArmor(identity: ArmorIdentity): Promise<ArmorDetail | null>
        getArmorFacets(gameId: GameId): Promise<ArmorCatalogFacets>
        getSkill(identity: SkillIdentity): Promise<SkillDetail | null>
        searchSkills(filters: SkillCatalogFilters): Promise<PageResult<SkillSummary>>
        getSkillFacets(gameId: GameId): Promise<SkillCatalogFacets>
        searchMonsters(filters: MonsterCatalogFilters): Promise<MonsterSummary[]>
        getMonster(identity: MonsterIdentity): Promise<MonsterDetail | null>
        getMonsterFacets(gameId: GameId): Promise<MonsterCatalogFacets>
        getQuest(identity: QuestIdentity): Promise<QuestDetail | null>
        searchQuests(filters: QuestCatalogFilters): Promise<PageResult<QuestSummary>>
        getQuestFacets(gameId: GameId): Promise<QuestCatalogFacets>
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
        getFacets(gameId: GameId): Promise<LoadoutFacets>
        getBootstrap(gameId: GameId): Promise<LoadoutCalculationSnapshot>
        getSnapshot(gameId: GameId): Promise<LoadoutCatalogSnapshot>
        getRelicLookups(gameId: GameId): Promise<LoadoutRelicLookup[]>
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
    }
  }
}

export {}
