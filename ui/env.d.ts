import type { GameId } from '../api/core/loadout'
import type { ArmorCatalogFacets, ArmorCatalogFilters, ArmorDetail, ArmorIdentity, ArmorSetFilters, ArmorSetSummary, ArmorSummary, DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationIdentity, DecorationSummary, HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtDetail, HunterArtIdentity, HunterArtSummary, ItemCatalogFilters, ItemDetail, ItemIdentity, ItemSummary, MonsterCatalogFacets, MonsterCatalogFilters, MonsterDetail, MonsterIdentity, MonsterSummary, PageResult, QuestCatalogFacets, QuestCatalogFilters, QuestDetail, QuestIdentity, QuestSummary, SkillCatalogFacets, SkillCatalogFilters, SkillDetail, SkillIdentity, SkillSummary, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponIdentity, WeaponMotionCatalogResult, WeaponMotionFacets, WeaponMotionFilters, WeaponSummary, WeaponTreeResult } from '../api/catalog/types'

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
      }
    }
  }
}

export {}
