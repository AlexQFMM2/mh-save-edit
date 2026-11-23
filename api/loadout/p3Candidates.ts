import type { P3ArmorSummary } from '../catalog/p3ArmorTypes'
import type { P3WeaponSummary } from '../catalog/p3WeaponTypes'
import type { LoadoutArmorCandidate, LoadoutWeaponCandidate } from './types'

/** P3 content identity is the native key; the same native type/id pair is what
 * the 12-byte save record encodes, so no key-to-save-ID conversion is needed. */
export function p3WeaponCandidate(weapon: P3WeaponSummary): LoadoutWeaponCandidate {
  return {
    kind: 'weapon', gameId: 'mhp3', candidateKey: `mhp3:${weapon.weaponKey}`, sourceKind: 'catalog',
    weaponKey: weapon.weaponKey, templateKey: null, saveType: weapon.nativeType, saveId: weapon.nativeId,
    nameCn: weapon.nameCn, nameEn: weapon.nameEn, nameJp: weapon.nameJp,
    typeId: weapon.typeId, typeNameCn: weapon.typeNameCn,
    rarity: weapon.rarity, slots: weapon.slots, attack: weapon.displayAttack, affinity: weapon.affinity,
    defense: weapon.defense, directlyProducible: weapon.isDirectlyProducible, iconPath: weapon.iconPath,
    decorations: [],
  }
}

export function p3ArmorCandidate(armor: P3ArmorSummary): LoadoutArmorCandidate {
  return {
    kind: 'armor', gameId: 'mhp3', candidateKey: `mhp3:${armor.armorKey}`, sourceKind: 'catalog',
    armorKey: armor.armorKey, dexId: null, templateKey: null, saveType: armor.nativeType, saveId: armor.nativeId,
    nameCn: armor.nameCn, nameEn: armor.nameEn, nameJp: armor.nameJp, part: armor.part,
    combat: armor.combat, gender: armor.gender, rarity: armor.rarity, slots: armor.slots,
    baseDefense: armor.baseDefense, maxDefense: armor.maxDefense,
    fireRes: armor.fireRes, waterRes: armor.waterRes, thunderRes: armor.thunderRes,
    iceRes: armor.iceRes, dragonRes: armor.dragonRes, iconPath: armor.iconPath,
    skills: armor.skills.map(skill => ({ skillId: skill.skillId, nameCn: skill.nameCn, points: skill.points })),
    decorations: [],
  }
}
