import { decorationKey, isDecorationForGame } from './identity'
import { applyCharmValidation } from './charm'
import type {
  ArmorLoadoutSlot,
  LoadoutArmor,
  LoadoutCatalogSnapshot,
  LoadoutDecoration,
  LoadoutWeapon,
  LogicalLoadout,
} from './types'

const clone = <T>(value: T): T => structuredClone(value)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Removes the one transient field written by older loadout builds. Other
 * unknown fields remain in place and are still rejected by the strict schema.
 */
export function normalizeLegacyTransientLoadoutFields(input: unknown): unknown {
  if (!isRecord(input) || !isRecord(input.charm) || !Object.hasOwn(input.charm, 'ranges')) return input
  const { ranges: _legacyRanges, ...charm } = input.charm
  return { ...input, charm }
}

function decorationsFromSnapshot(snapshot: LoadoutCatalogSnapshot, values: LoadoutDecoration[]): LoadoutDecoration[] {
  return values.map((value) => {
    if (!isDecorationForGame(value, snapshot.gameId)) throw new Error('装饰品游戏版本与配装不一致')
    const catalog = snapshot.decorations.find((candidate) => decorationKey(candidate) === decorationKey(value))
    if (!catalog && snapshot.gameId === 'mhp2g') throw new Error(`装饰品已不在当前资料中：${value.nameCn}`)
    if (!catalog) return { ...clone(value), skills: [] }
    return { ...clone(catalog), fixed: value.fixed }
  })
}

function weaponFromSnapshot(snapshot: LoadoutCatalogSnapshot, imported: LoadoutWeapon): LoadoutWeapon {
  const catalog = snapshot.weapons.find((candidate) => candidate.candidateKey === imported.candidateKey)
  if (!catalog) throw new Error(`导入武器已不在当前资料中：${imported.nameCn}`)
  if (imported.gameId !== snapshot.gameId) throw new Error('装备游戏版本与配装不一致')
  if (catalog.gameId === 'mhp2g') {
    if (imported.gameId !== 'mhp2g' || catalog.weaponKey !== imported.weaponKey) throw new Error('P2G 装备身份与候选键不一致')
    return { ...clone(catalog), decorations: decorationsFromSnapshot(snapshot, imported.decorations), lock: imported.lock }
  }
  const editable = catalog.sourceKind === 'relicTemplate'
    ? {
        slots: imported.slots,
        rarity: imported.rarity,
        attack: imported.attack,
        affinity: imported.affinity,
        defense: imported.defense,
        instance: imported.instance ? { ...clone(imported.instance), source: 'importedLoadout' as const } : catalog.instance,
      }
    : {}
  return {
    ...clone(catalog),
    ...editable,
    decorations: decorationsFromSnapshot(snapshot, imported.decorations),
    lock: imported.lock,
  }
}

function armorFromSnapshot(snapshot: LoadoutCatalogSnapshot, slot: ArmorLoadoutSlot, imported: LoadoutArmor, gender: LogicalLoadout['gender']): LoadoutArmor {
  let catalog = snapshot.armors.find((candidate) => candidate.candidateKey === imported.candidateKey && candidate.part === slot)
  // Older MH4G catalogs collapsed the male/female native records into one Dex entry.
  if (!catalog && snapshot.gameId === 'mh4g' && imported.sourceKind === 'catalog' && imported.candidateKey === `catalog:${imported.dexId}`) {
    const variants = snapshot.armors.filter(candidate => candidate.sourceKind === 'catalog' && candidate.dexId === imported.dexId && candidate.part === slot)
    const matches = imported.saveType != null && imported.saveId != null
      ? variants.filter(candidate => candidate.saveType === imported.saveType && candidate.saveId === imported.saveId)
      : variants.filter(candidate => candidate.gender === gender || candidate.gender === 'both')
    if (matches.length === 1) catalog = matches[0]
  }
  if (!catalog) throw new Error(`导入${slot}防具已不在当前资料中：${imported.nameCn}`)
  if (imported.gameId !== snapshot.gameId) throw new Error('装备游戏版本与配装不一致')
  if (catalog.gameId === 'mhp2g') {
    if (imported.gameId !== 'mhp2g' || catalog.armorKey !== imported.armorKey) throw new Error('P2G 装备身份与候选键不一致')
    return { ...clone(catalog), decorations: decorationsFromSnapshot(snapshot, imported.decorations), lock: imported.lock }
  }
  const editable = catalog.sourceKind === 'relicTemplate'
    ? {
        slots: imported.slots,
        rarity: imported.rarity,
        baseDefense: imported.baseDefense,
        maxDefense: imported.maxDefense,
        fireRes: imported.fireRes,
        waterRes: imported.waterRes,
        thunderRes: imported.thunderRes,
        iceRes: imported.iceRes,
        dragonRes: imported.dragonRes,
        instance: imported.instance ? { ...clone(imported.instance), source: 'importedLoadout' as const } : catalog.instance,
      }
    : {}
  return {
    ...clone(catalog),
    ...editable,
    decorations: decorationsFromSnapshot(snapshot, imported.decorations),
    lock: imported.lock,
  }
}

export function reconcileImportedLoadout(snapshot: LoadoutCatalogSnapshot, imported: LogicalLoadout): LogicalLoadout {
  if (snapshot.gameId === 'mhp2g' && imported.charm) throw new Error('P2G 没有护石')
  if (snapshot.gameId !== imported.gameId) throw new Error('文件游戏版本与当前页面不匹配')
  const next: LogicalLoadout = {
    schemaVersion: 1,
    dataVersion: snapshot.dataVersion,
    gameId: snapshot.gameId,
    name: imported.name,
    gender: imported.gender,
    weapon: imported.weapon ? weaponFromSnapshot(snapshot, imported.weapon) : null,
    armor: {},
    charm: null,
  }
  for (const slot of ['head', 'chest', 'arms', 'waist', 'legs'] as const) {
    const armor = imported.armor[slot]
    if (armor) next.armor[slot] = armorFromSnapshot(snapshot, slot, armor, imported.gender)
  }
  if (imported.charm) {
    const decorations = decorationsFromSnapshot(snapshot, imported.charm.decorations)
    const skill = (value: typeof imported.charm.skill1) => {
      if (!value) return null
      const definition = snapshot.skills.find((candidate) => candidate.skillId === value.skillId)
      return { ...value, nameCn: definition?.nameCn ?? value.nameCn }
    }
    const draft = { ...clone(imported.charm), gameId: imported.charm.gameId, skill1: skill(imported.charm.skill1), skill2: skill(imported.charm.skill2), decorations }
    next.charm = applyCharmValidation(snapshot, draft)
  }
  return next
}
