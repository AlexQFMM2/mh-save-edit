import { ARMOR_LOADOUT_SLOTS, createEmptyLogicalLoadout, type AutoLoadoutRequest, type LoadoutArmor, type LoadoutCatalogSnapshot, type LoadoutDecoration, type LoadoutWeapon } from '../../api/loadout/types'

// Fully synthetic records. Native-shaped keys express the contract, not game data.
export function nativeArmor(part: LoadoutArmor['part'], index = 1, points = 2): LoadoutArmor {
  return { kind: 'armor', gameId: 'mhp2g', candidateKey: `mhp2g:armor_${part}:${index}`, sourceKind: 'catalog', armorKey: `armor_${part}:${index}`, dexId: null, templateKey: null, saveType: null, saveId: null, nameCn: `合成${part}${index}`, nameJp: `テスト${part}${index}`, nameEn: '', part, combat: 'both', gender: 'both', rarity: 1, slots: part === 'chest' ? 2 : part === 'legs' ? 1 : 0, baseDefense: 5, maxDefense: 25, fireRes: -2, waterRes: 1, thunderRes: 0, iceRes: 3, dragonRes: -1, iconPath: null, skills: [{ skillId: 10, nameCn: '合成甲', points }, { skillId: 11, nameCn: '合成乙', points: 1 }], decorations: [], lock: 'unlocked' }
}
export function nativeJewel(itemId: number, a: number, b: number, slots = 1): LoadoutDecoration {
  return { gameId: 'mhp2g', itemId, nameCn: `合成珠${itemId}`, nameJp: `テスト珠${itemId}`, slots, skills: [{ skillId: 10, nameCn: '合成甲', points: a }, { skillId: 11, nameCn: '合成乙', points: b }] }
}
export function p2gLoadoutFixture() {
  const weapon: LoadoutWeapon = { kind: 'weapon', gameId: 'mhp2g', candidateKey: 'mhp2g:weapon_blademaster:1', sourceKind: 'catalog', weaponKey: 'weapon_blademaster:1', templateKey: null, saveType: null, saveId: null, nameCn: '合成大剑', nameJp: 'テスト大剣', nameEn: '', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 1, attack: 100, affinity: 0, defense: 2, iconPath: null, decorations: [], lock: 'equipment' }
  const snapshot: LoadoutCatalogSnapshot = { gameId: 'mhp2g', dataVersion: 'synthetic-p2g-v1', weapons: [weapon], armors: ARMOR_LOADOUT_SLOTS.map(part => nativeArmor(part)), charmClasses: [], charmRanges: [], relicLookups: [], decorations: [nativeJewel(1, 2, -1), nativeJewel(2, -1, 2), nativeJewel(3, 2, 2, 2)], skills: [
    { skillId: 1, nameCn: '合成倍加规则', nameEn: '', nameJp: 'テスト倍加', activations: [], specialRule: '合成胸部复制说明' },
    ...[10, 11].map(skillId => ({ skillId, nameCn: skillId === 10 ? '合成甲' : '合成乙', nameEn: '', nameJp: `テスト${skillId}`, activations: [10, 15, 20, -10, -15, -20].map(threshold => ({ activationKey: `p2g-test:${skillId}:${threshold}`, skillId, nameCn: `合成发动${skillId}:${threshold}`, nameJp: `テスト発動${skillId}:${threshold}`, threshold, direction: threshold > 0 ? 'positive' as const : 'negative' as const })) })),
  ] }
  const loadout = createEmptyLogicalLoadout('mhp2g', snapshot.dataVersion)
  loadout.weapon = structuredClone(weapon)
  for (const part of ARMOR_LOADOUT_SLOTS) loadout.armor[part] = nativeArmor(part)
  const request: AutoLoadoutRequest = { requestId: 'p2g-synthetic', gameId: 'mhp2g', dataVersion: snapshot.dataVersion, baseLoadout: loadout, targets: [{ activationKey: 'p2g-test:10:10', skillId: 10, threshold: 10, nameCn: '合成发动' }], resultLimit: 50, timeoutMs: 10000 }
  return { snapshot, loadout, request }
}
