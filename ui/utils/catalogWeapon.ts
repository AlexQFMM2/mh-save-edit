import type { CatalogGameId, PageResult, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponLink, WeaponSharpnessProfile, WeaponSummary, WeaponTreeEdge, WeaponTreeResult, WeaponTypeDefinition } from '../../api/catalog/types'
import type { P2gWeaponDetail, P2gWeaponFilters, P2gWeaponSummary } from '../../api/catalog/p2gWeaponTypes'

// Display contracts deliberately do not require a save identity. Save consumers
// continue using WeaponDetail and must never receive a native catalog adapter.
export type CatalogWeaponSharpness = WeaponSharpnessProfile & { nativeSegments?: { base: number[]; handicraft: number[] } }
export type CatalogWeaponSummary = Omit<WeaponSummary, 'gameId' | 'saveId' | 'saveType' | 'sharpness'> & {
  gameId: CatalogGameId
  saveId?: number
  saveType?: number
  nativeIndex?: number
  nameJp?: string
  matchReason?: string
  isCrossType?: boolean
  sharpness: CatalogWeaponSharpness | null
}
export type CatalogWeaponLink = Omit<WeaponLink, 'gameId'> & { gameId: CatalogGameId }
export type CatalogWeaponDetail = WeaponDetail | (CatalogWeaponSummary & { gameId: 'mhp2g'; nameJp: string; nativeDetail: P2gWeaponDetail; parents: CatalogWeaponLink[]; children: CatalogWeaponLink[] })
export type CatalogWeaponType = Pick<WeaponTypeDefinition, 'typeId' | 'nameCn' | 'nameEn' | 'kind' | 'sortOrder'>
export type CatalogWeaponFacets = Omit<WeaponCatalogFacets, 'weaponTypes'> & { weaponTypes: CatalogWeaponType[] }
export type CatalogWeaponTree = Omit<WeaponTreeResult, 'gameId' | 'nodes' | 'edges'> & { gameId: CatalogGameId; nodes: CatalogWeaponSummary[]; edges: (WeaponTreeEdge & { isCrossType?: boolean })[] }

export function catalogWeaponSummary(w: P2gWeaponSummary): CatalogWeaponSummary {
  const extended = w.sharpness?.handicraft
  const sharpness: CatalogWeaponSharpness | null = extended && w.sharpness ? {
    red: extended[0], orange: extended[1], yellow: extended[2], green: extended[3], blue: extended[4], white: extended[5], purple: extended[6],
    baseCutoff: w.sharpness.base.reduce((a, b) => a + b, 0), handicraft1Cutoff: extended.reduce((a, b) => a + b, 0), handicraft2Cutoff: null, rawValue: '', nativeSegments: w.sharpness,
  } : null
  return { ...w, sharpness, dexId: null, displayLevel: null, saveLevel: null, isPlaceholder: false, specialSummary: w.specialSummary ?? [] }
}

export function catalogWeaponDetail(w: P2gWeaponDetail): CatalogWeaponDetail {
  return { ...catalogWeaponSummary(w), gameId: 'mhp2g', nameJp: w.nameJp, nativeDetail: w, parents: w.parents.map(p => ({ ...p, displayLevel: null })), children: w.children.map(p => ({ ...p, displayLevel: null })) }
}

export function parseCatalogWeaponKey(value: string | null, gameId: CatalogGameId): string | undefined {
  return value && (gameId === 'mhp2g' ? /^weapon_(blademaster|ranged):\d+$/ : /^\d+:\d+(?::\d+)?$/).test(value) ? value : undefined
}

export async function getCatalogWeapon(gameId: CatalogGameId, weaponKey: string): Promise<CatalogWeaponDetail | null> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp2g') { const w = await api.getWeapon({ gameId, weaponKey }); return w ? catalogWeaponDetail(w) : null }
  return api.getWeapon({ gameId, weaponKey })
}
export async function getCatalogWeaponFacets(gameId: CatalogGameId): Promise<CatalogWeaponFacets> {
  return gameId === 'mhp2g' ? window.mhSaveEditor!.catalog.getWeaponFacets(gameId) : window.mhSaveEditor!.catalog.getWeaponFacets(gameId)
}
export async function getCatalogWeaponTree(gameId: CatalogGameId, typeId: number): Promise<CatalogWeaponTree> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp2g') { const tree = await api.getWeaponTree(gameId, typeId); return { ...tree, nodes: tree.nodes.map(w => ({ ...catalogWeaponSummary(w), isCrossType: w.isCrossType })) } }
  return api.getWeaponTree(gameId, typeId)
}
export async function searchCatalogWeapons(gameId: CatalogGameId, filters: Omit<WeaponCatalogFilters, 'gameId' | 'sort'> & { sort: WeaponCatalogFilters['sort'] | 'nativeId' }): Promise<PageResult<CatalogWeaponSummary>> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp2g') {
    const { includeHiddenAttributes: _hidden, includePlaceholders: _debug, sort, sharpnessStage, ...common } = filters
    const native: P2gWeaponFilters = { ...common, gameId, sort: sort === 'saveId' ? 'nativeId' : sort, sharpnessStage: sharpnessStage === 'handicraft2' ? 'handicraft1' : sharpnessStage }
    const result = await api.searchWeapons(native)
    return { ...result, items: result.items.map(catalogWeaponSummary) }
  }
  return api.searchWeapons({ ...filters, gameId, sort: filters.sort === 'nativeId' ? 'saveId' : filters.sort })
}
