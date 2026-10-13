import { getGameLoadoutRules } from '../../api/loadout/rules'
import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout, type AutoLoadoutRequest, type LoadoutArmor, type LoadoutCatalogSnapshot, type LoadoutDecoration, type LoadoutGame } from '../../api/loadout/types'

/** Fully synthetic arithmetic/search fixture, with a structurally complete loadout. */
export function createPatternFixture(gameId: Exclude<LoadoutGame, 'mhp2g'> = 'mhgu') {
  const torsoId = getGameLoadoutRules(gameId).torsoSkillId
  const jewel = (saveId: number, slots: number, a: number, b: number): LoadoutDecoration => ({ saveId, nameCn: `J${saveId}`, slots, skills: [{ skillId: 10, nameCn: 'A', points: a }, { skillId: 11, nameCn: 'B', points: b }] })
  const snapshot: LoadoutCatalogSnapshot = { gameId, dataVersion: 'synthetic', weapons: [], armors: [], charmClasses: [], charmRanges: [], relicLookups: [], decorations: [jewel(1, 1, 2, -1), jewel(2, 1, -1, 2), jewel(3, 2, 2, 2), jewel(4, 3, 4, -3)], skills: [10, 11, torsoId, 204, 205].map(skillId => ({ skillId, nameCn: String(skillId), nameEn: '', nameJp: '', activations: [{ skillId, activationKey: String(skillId), threshold: skillId >= 204 ? 10 : 1, direction: skillId >= 204 ? 'special' : 'positive', nameCn: String(skillId) }] })) }
  const loadout = createEmptyLogicalLoadout(gameId, snapshot.dataVersion)
  loadout.weapon = { kind: 'weapon', gameId, candidateKey: 'w', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '合成武器', nameEn: 'Synthetic', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0, attack: 1, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'equipment' }
  const armor = (part: LoadoutArmor['part']): LoadoutArmor => ({ kind: 'armor', gameId, candidateKey: part, sourceKind: 'catalog', dexId: 1, templateKey: null, saveType: 1, saveId: 1, nameCn: part, nameEn: part, part, combat: 'both', gender: 'both', rarity: 1, slots: 0, baseDefense: 1, maxDefense: 1, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, iconPath: null, skills: [], decorations: [], lock: 'unlocked' })
  for (const part of ARMOR_LOADOUT_SLOTS) loadout.armor[part] = armor(part)
  loadout.armor.head!.slots = 1
  loadout.armor.chest!.slots = 2
  const request: AutoLoadoutRequest = { requestId: 'patterns', gameId, dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets: [10, 11].map(skillId => ({ activationKey: String(skillId), skillId, threshold: 3, nameCn: String(skillId) })), resultLimit: 1, timeoutMs: 10000 }
  return { snapshot, loadout, request, torsoId }
}
