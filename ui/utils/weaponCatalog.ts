import type { CatalogGameId } from '../../api/catalog/types'
import type { CatalogWeaponSharpness, CatalogWeaponSummary } from './catalogWeapon'
import type { SharpnessStage, WeaponCatalogFilters, WeaponSharpnessProfile, WeaponSummary, WeaponTreeEdge, WeaponTreeNode } from '../../api/catalog/types'

export const sharpnessColors = ['red', 'orange', 'yellow', 'green', 'blue', 'white', 'purple'] as const
export type SharpnessColor = typeof sharpnessColors[number]

export type SharpnessStageView = {
  id: SharpnessStage
  label: string
  shortLabel: string
  cutoff: number
  total: number
  segments: Record<SharpnessColor, number>
  summary: string
}

const sharpnessLabels: Record<SharpnessColor, string> = { red: '红', orange: '橙', yellow: '黄', green: '绿', blue: '蓝', white: '白', purple: '紫' }

export function weaponSharpnessStages(profile: CatalogWeaponSharpness, gameId: CatalogGameId): SharpnessStageView[] {
  const total = sharpnessColors.reduce((sum, color) => sum + profile[color], 0)
  const definitions: { id: SharpnessStage; label: string; shortLabel: string; cutoff: number }[] = [
    { id: 'base', label: '基础', shortLabel: '基', cutoff: profile.baseCutoff },
    { id: 'handicraft1', label: gameId === 'mhp2g' ? '匠' : '匠+1', shortLabel: gameId === 'mhgu' ? '匠1' : '匠', cutoff: profile.handicraft1Cutoff ?? profile.baseCutoff },
  ]
  if (gameId === 'mhgu') definitions.push({ id: 'handicraft2', label: '匠+2', shortLabel: '匠2', cutoff: profile.handicraft2Cutoff ?? profile.handicraft1Cutoff ?? profile.baseCutoff })
  return definitions.map((definition) => {
    let remaining = Math.max(0, Math.min(total, definition.cutoff))
    const segments = Object.fromEntries(sharpnessColors.map((color) => {
      const native = profile.nativeSegments?.[definition.id === 'base' ? 'base' : 'handicraft']
      const value = native ? native[sharpnessColors.indexOf(color)] : Math.min(profile[color], remaining)
      remaining -= value
      return [color, value]
    })) as Record<SharpnessColor, number>
    const highest = [...sharpnessColors].reverse().find((color) => segments[color] > 0)
    const summary = highest ? `${sharpnessLabels[highest]}斩 ${segments[highest]}` : '无可用斩味'
    return { ...definition, total, segments, summary }
  })
}

export function weaponMatchesFilters(weapon: CatalogWeaponSummary, filters: Pick<WeaponCatalogFilters, 'query' | 'attributeId' | 'includeHiddenAttributes' | 'rarity' | 'slots' | 'directlyProducible' | 'finalOnly'> & { queryWeaponKeys?: ReadonlySet<string> }): boolean {
  const query = filters.query?.trim().toLocaleLowerCase()
  if (query) {
    const numeric = /^0x[0-9a-f]+$/i.test(query) ? Number.parseInt(query.slice(2), 16) : /^\d+$/.test(query) ? Number(query) : null
    const matchesText = weapon.nameCn.toLocaleLowerCase().includes(query) || weapon.nameEn.toLocaleLowerCase().includes(query) || (weapon.nameJp ?? '').toLocaleLowerCase().includes(query) || weapon.weaponKey.toLocaleLowerCase().includes(query) || (weapon.matchReason ?? '').toLocaleLowerCase().includes(query)
    if (!filters.queryWeaponKeys?.has(weapon.weaponKey) && !matchesText && (numeric == null || (weapon.saveId !== numeric && weapon.dexId !== numeric && weapon.nativeIndex !== numeric))) return false
  }
  if (filters.rarity != null && weapon.rarity !== filters.rarity) return false
  if (filters.slots != null && weapon.slots !== filters.slots) return false
  if (filters.directlyProducible && !weapon.isDirectlyProducible) return false
  if (filters.finalOnly && !weapon.isFinalForm) return false
  const attributes = filters.includeHiddenAttributes === false ? weapon.attributes.filter((attribute) => !attribute.isHidden) : weapon.attributes
  if (filters.attributeId === 'none' && attributes.length > 0) return false
  if (typeof filters.attributeId === 'number' && !attributes.some((attribute) => attribute.attributeId === filters.attributeId)) return false
  return true
}

export function contextualWeaponKeys(nodes: CatalogWeaponSummary[], edges: WeaponTreeEdge[], matches: Set<string>): Set<string> {
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  for (const edge of edges) {
    parents.set(edge.childWeaponKey, [...(parents.get(edge.childWeaponKey) ?? []), edge.parentWeaponKey])
    children.set(edge.parentWeaponKey, [...(children.get(edge.parentWeaponKey) ?? []), edge.childWeaponKey])
  }
  const result = new Set(matches)
  const stack = [...matches]
  while (stack.length) {
    const key = stack.pop()!
    for (const parent of parents.get(key) ?? []) if (!result.has(parent)) { result.add(parent); stack.push(parent) }
  }
  for (const key of matches) for (const child of children.get(key) ?? []) result.add(child)
  for (const node of nodes) if (node.isDirectlyProducible && matches.has(node.weaponKey)) result.add(node.weaponKey)
  return result
}
