import type { GameId } from '../api/core/loadout'
import type { ArmorCatalogFacets, ArmorCatalogFilters, ArmorDetail, ArmorIdentity, ArmorSetFilters, ArmorSetSummary, ArmorSummary, DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationIdentity, DecorationSummary, ItemCatalogFilters, ItemDetail, ItemIdentity, ItemSummary, PageResult, SkillDetail, SkillIdentity, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponIdentity, WeaponSummary, WeaponTreeResult } from '../api/catalog/types'

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
        searchArmors(filters: ArmorCatalogFilters): Promise<PageResult<ArmorSummary>>
        searchArmorSets(filters: ArmorSetFilters): Promise<PageResult<ArmorSetSummary>>
        getArmor(identity: ArmorIdentity): Promise<ArmorDetail | null>
        getArmorFacets(gameId: GameId): Promise<ArmorCatalogFacets>
        getSkill(identity: SkillIdentity): Promise<SkillDetail | null>
      }
    }
  }
}

export {}
