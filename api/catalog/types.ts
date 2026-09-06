import type { GameId } from '../core/loadout'

export type ItemIdentity = { gameId: GameId; saveId: number }
export type ItemSourceKind = 'combination' | 'monster' | 'location' | 'quest' | 'exchange'
export type ItemUsageKind = 'weapon' | 'armor' | 'decoration' | 'palico-weapon' | 'palico-armor' | 'kinsect'
export type ItemRelationTarget = Pick<ItemIdentity, 'gameId' | 'saveId'> & { nameCn: string; nameEn: string }

export type ItemSummary = ItemIdentity & {
  dexId: number | null
  nameCn: string
  nameEn: string
  rarity: number | null
  maxStack: number | null
  iconPath: string | null
  isPlaceholder: boolean
}

export type ItemRelation = {
  id: number
  sourceKind: ItemSourceKind | ItemUsageKind
  usageKind: ItemUsageKind | null
  targetId: number | null
  targetName: string
  quantity: number | null
  probability: number | null
  rank: number | null
  metadata: Record<string, string>
  relatedItems: ItemRelationTarget[]
}

export type ItemDetail = ItemSummary & {
  nameJp: string
  sellPrice: number | null
  buyPrice: number | null
  hexId: string | null
  mappingStatus: string
  relations: ItemRelation[]
}

export type ItemCatalogFilters = {
  gameId: GameId
  query?: string
  rarity?: number
  maxStack?: number
  sourceKinds?: ItemSourceKind[]
  usageKinds?: ItemUsageKind[]
  includePlaceholders?: boolean
  sort?: 'saveId' | 'name' | 'rarity'
  page?: number
  pageSize?: number
}

export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number; hasNext: boolean }

export const sourceKindLabels: Record<string, string> = {
  combination: '调合', monster: '怪物获取', location: '地图采集', quest: '任务奖励', exchange: '山菜爷',
  weapon: '武器', armor: '防具', decoration: '装饰珠', 'palico-weapon': '猫武器',
  'palico-armor': '猫防具', kinsect: '猎虫',
}
