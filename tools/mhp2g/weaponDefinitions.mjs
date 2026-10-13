// Explicit native class → shared catalog type mapping. These are not save types.
export const weaponTypes = [
  [0, 1, '大剑', 'Great Sword', 'standardMelee'],
  [7, 2, '太刀', 'Long Sword', 'standardMelee'],
  [4, 3, '片手剑', 'Sword and Shield', 'standardMelee'],
  [6, 4, '双剑', 'Dual Blades', 'standardMelee'],
  [2, 5, '大锤', 'Hammer', 'standardMelee'],
  [8, 6, '狩猎笛', 'Hunting Horn', 'huntingHorn'],
  [3, 7, '长枪', 'Lance', 'standardMelee'],
  [9, 8, '铳枪', 'Gunlance', 'gunlance'],
  [5, 12, '轻弩', 'Light Bowgun', 'bowgun'],
  [1, 13, '重弩', 'Heavy Bowgun', 'bowgun'],
  [10, 14, '弓', 'Bow', 'bow'],
].map(([nativeClassId, typeId, nameCn, nameEn, kind], sortOrder) => ({ nativeClassId, typeId, nameCn, nameEn, kind, sortOrder }))

export const attributes = [
  ['fire', '火', 'Fire'], ['water', '水', 'Water'], ['thunder', '雷', 'Thunder'],
  ['ice', '冰', 'Ice'], ['dragon', '龙', 'Dragon'], ['poison', '毒', 'Poison'],
  ['paralysis', '麻痹', 'Paralysis'], ['sleep', '睡眠', 'Sleep'],
].map(([kind, nameCn, nameEn], index) => ({ attributeId: index + 1, kind, nameCn, nameEn, isHidden: false }))

export function weaponAttributes(row, dual) {
  const pairs = dual.length ? dual.map(d => [d.type_code, d.value_raw]) : [
    [['', 'fire', 'water', 'thunder', 'dragon', 'ice'][row.element_type_raw], row.element_value_raw],
    [['', 'poison', 'paralysis', 'sleep'][row.status_type_raw ?? 0], row.status_value_raw],
  ].filter(([kind]) => kind !== '')
  return pairs.map(([kind, value]) => {
    const definition = attributes.find(a => a.kind === kind)
    if (!definition || !Number.isInteger(value) || value < 0) throw new Error('Invalid native weapon attribute')
    return { ...definition, value: value * 10 }
  })
}
