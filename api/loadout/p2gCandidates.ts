import type { P2gArmorSummary } from '../catalog/p2gArmorTypes'
import type { P2gWeaponSummary } from '../catalog/p2gWeaponTypes'
import type { LoadoutArmorCandidate, LoadoutWeaponCandidate } from './types'

export function p2gWeaponCandidate(w: P2gWeaponSummary): LoadoutWeaponCandidate {
  return {
    kind: 'weapon', gameId: 'mhp2g', candidateKey: `mhp2g:${w.weaponKey}`, sourceKind: 'catalog',
    weaponKey: w.weaponKey, templateKey: null, saveType: null, saveId: null,
    nameCn: w.nameCn, nameEn: w.nameEn, nameJp: w.nameJp, typeId: w.typeId, typeNameCn: w.typeNameCn,
    rarity: w.rarity, slots: w.slots, attack: w.displayAttack, affinity: w.affinity, defense: w.defense,
    directlyProducible: w.isDirectlyProducible, iconPath: w.iconPath,
  }
}

export function p2gArmorCandidate(a: P2gArmorSummary): LoadoutArmorCandidate {
  return {
    kind: 'armor', gameId: 'mhp2g', candidateKey: `mhp2g:${a.armorKey}`, sourceKind: 'catalog',
    armorKey: a.armorKey, dexId: null, templateKey: null, saveType: null, saveId: null,
    nameCn: a.nameCn, nameEn: a.nameEn, nameJp: a.nameJp, part: a.part, combat: a.combat, gender: a.gender,
    rarity: a.rarity, slots: a.slots, baseDefense: a.baseDefense, maxDefense: a.maxDefense,
    fireRes: a.fireRes, waterRes: a.waterRes, thunderRes: a.thunderRes, iceRes: a.iceRes, dragonRes: a.dragonRes,
    iconPath: a.iconPath, skills: a.skills.map(({ skillId, nameCn, points }) => ({ skillId, nameCn, points })),
  }
}
