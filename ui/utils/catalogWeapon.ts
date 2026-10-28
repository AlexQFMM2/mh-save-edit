import type { P3WeaponDetail, P3WeaponSummary, P3WeaponScope } from '../../api/catalog/p3WeaponTypes'
import { p3WeaponKeySchema } from '../../api/catalog/p3WeaponSchemas'
import type { WeaponCatalogGameId, PageResult, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponLink, WeaponSharpnessProfile, WeaponSummary, WeaponTreeEdge, WeaponTreeResult, WeaponTypeDefinition } from '../../api/catalog/types'
import type { P2gWeaponDetail, P2gWeaponFilters, P2gWeaponSummary } from '../../api/catalog/p2gWeaponTypes'

// Display contracts deliberately do not require a save identity. Save consumers
// continue using WeaponDetail and must never receive a native catalog adapter.
export type CatalogWeaponSharpness = WeaponSharpnessProfile & { nativeSegments?: { base: number[]; handicraft: number[] } }
export type CatalogWeaponSummary = Omit<WeaponSummary, 'gameId' | 'saveId' | 'saveType' | 'sharpness'> & {
  gameId: WeaponCatalogGameId
  saveId?: number
  saveType?: number
  acquisitionStatus?: Exclude<P3WeaponScope, 'all'>
  nativeIndex?: number
  nameJp?: string
  matchReason?: string
  isCrossType?: boolean
  sharpness: CatalogWeaponSharpness | null
}
export type CatalogWeaponLink = Omit<WeaponLink, 'gameId'> & { gameId: WeaponCatalogGameId }
export type CatalogWeaponDetail = WeaponDetail | (CatalogWeaponSummary & { gameId: 'mhp2g' | 'mhp3'; nameJp: string; nativeDetail: P2gWeaponDetail | P3WeaponDetail; parents: CatalogWeaponLink[]; children: CatalogWeaponLink[] })
export type CatalogWeaponType = Pick<WeaponTypeDefinition, 'typeId' | 'nameCn' | 'nameEn' | 'kind' | 'sortOrder'>
export type CatalogWeaponFacets = Omit<WeaponCatalogFacets, 'weaponTypes'> & { weaponTypes: CatalogWeaponType[] }
export type CatalogWeaponTree = Omit<WeaponTreeResult, 'gameId' | 'nodes' | 'edges'> & { gameId: WeaponCatalogGameId; nodes: CatalogWeaponSummary[]; edges: (WeaponTreeEdge & { isCrossType?: boolean })[] }

export function catalogWeaponSummary(w: P2gWeaponSummary | P3WeaponSummary): CatalogWeaponSummary {
  const extended = w.sharpness?.handicraft
  const sharpness: CatalogWeaponSharpness | null = extended && w.sharpness ? {
    red: extended[0], orange: extended[1], yellow: extended[2], green: extended[3], blue: extended[4], white: extended[5], purple: extended[6],
    baseCutoff: w.sharpness.base.reduce((a, b) => a + b, 0), handicraft1Cutoff: extended.reduce((a, b) => a + b, 0), handicraft2Cutoff: null, rawValue: '', nativeSegments: w.sharpness,
  } : null
  return { ...w, kind: w.kind === 'switchAxe' ? 'phialWeapon' : w.kind, nativeIndex: w.gameId === 'mhp3' ? w.nativeId : w.nativeIndex, sharpness, dexId: null, displayLevel: null, saveLevel: null, isPlaceholder: false, specialSummary: w.specialSummary ?? [] }
}

export function catalogWeaponDetail(w: P2gWeaponDetail | P3WeaponDetail): CatalogWeaponDetail {
  return { ...catalogWeaponSummary(w), gameId: w.gameId, nameJp: w.nameJp, nativeDetail: w, parents: w.parents.map(p => ({ ...p, displayLevel: null })), children: w.children.map(p => ({ ...p, displayLevel: null })) }
}

export function parseCatalogWeaponKey(value: string | null, gameId: WeaponCatalogGameId): string | undefined {
  if (gameId === 'mhp3') return value && p3WeaponKeySchema.safeParse(value).success ? value : undefined
  return value && (gameId === 'mhp2g' ? /^weapon_(blademaster|ranged):\d+$/ : /^\d+:\d+(?::\d+)?$/).test(value) ? value : undefined
}

export async function getCatalogWeapon(gameId: WeaponCatalogGameId, weaponKey: string): Promise<CatalogWeaponDetail | null> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp3') { const w = await api.getWeapon({ gameId, weaponKey }); return w ? catalogWeaponDetail(w) : null }
  if (gameId === 'mhp2g') { const w = await api.getWeapon({ gameId, weaponKey }); return w ? catalogWeaponDetail(w) : null }
  return api.getWeapon({ gameId, weaponKey })
}
export async function getCatalogWeaponFacets(gameId: WeaponCatalogGameId): Promise<CatalogWeaponFacets> {
  if (gameId === 'mhp3') { const facets = await window.mhSaveEditor!.catalog.getWeaponFacets(gameId); return { ...facets, weaponTypes: facets.weaponTypes.map(t => ({ ...t, kind: t.kind === 'switchAxe' ? 'phialWeapon' : t.kind })) } }
  return gameId === 'mhp2g' ? window.mhSaveEditor!.catalog.getWeaponFacets(gameId) : window.mhSaveEditor!.catalog.getWeaponFacets(gameId)
}
export async function getCatalogWeaponTree(gameId: WeaponCatalogGameId, typeId: number): Promise<CatalogWeaponTree> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp3') { const tree = await api.getWeaponTree(gameId, typeId); return { ...tree, nodes: tree.nodes.map(w => ({ ...catalogWeaponSummary(w), isCrossType: w.isCrossType })) } }
  if (gameId === 'mhp2g') { const tree = await api.getWeaponTree(gameId, typeId); return { ...tree, nodes: tree.nodes.map(w => ({ ...catalogWeaponSummary(w), isCrossType: w.isCrossType })) } }
  return api.getWeaponTree(gameId, typeId)
}
export async function searchCatalogWeapons(gameId: WeaponCatalogGameId, filters: Omit<WeaponCatalogFilters, 'gameId' | 'sort'> & { sort: WeaponCatalogFilters['sort'] | 'nativeId'; scope?: P3WeaponScope }): Promise<PageResult<CatalogWeaponSummary>> {
  const api = window.mhSaveEditor!.catalog
  if (gameId === 'mhp3') {
    const { includeHiddenAttributes: _hidden, includePlaceholders: _debug, sort, sharpnessStage, ...common } = filters
    const result = await api.searchWeapons({ ...common, gameId, sort: sort === 'saveId' ? 'nativeId' : sort, sharpnessStage: sharpnessStage === 'handicraft2' ? 'handicraft1' : sharpnessStage })
    return { ...result, items: result.items.map(catalogWeaponSummary) }
  }
  const { scope: _scope, ...legacy } = filters
  if (gameId === 'mhp2g') {
    const { includeHiddenAttributes: _hidden, includePlaceholders: _debug, sort, sharpnessStage, ...common } = legacy
    const native: P2gWeaponFilters = { ...common, gameId, sort: sort === 'saveId' ? 'nativeId' : sort, sharpnessStage: sharpnessStage === 'handicraft2' ? 'handicraft1' : sharpnessStage }
    const result = await api.searchWeapons(native)
    return { ...result, items: result.items.map(catalogWeaponSummary) }
  }
  return api.searchWeapons({ ...legacy, gameId, sort: filters.sort === 'nativeId' ? 'saveId' : filters.sort })
}
