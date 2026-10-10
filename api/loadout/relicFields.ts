// Confirmed MH4G record fields shared by editing and read-only instance details.
export type RelicField = { offset: number; label: string; domain: string; variant: string; mask?: number; shift?: number }

export function readRelicField(recordHex: string, field: Pick<RelicField, 'offset' | 'mask' | 'shift'>): number {
  return (Number.parseInt(recordHex.slice(field.offset * 2, field.offset * 2 + 2), 16) & (field.mask ?? 0xff)) >> (field.shift ?? 0)
}

const commonFields: RelicField[] = [
  { offset: 0x10, label: '孔位', domain: 'slots', variant: 'all', mask: 0x0c, shift: 2 },
  { offset: 0x11, label: '动态稀有度', domain: 'rarity', variant: 'relic' },
  { offset: 0x12, label: '研磨要求', domain: 'polish_requirement', variant: 'all' },
]

export const relicArmorFields: RelicField[] = [
  { offset: 0x0d, label: '防御档', domain: 'relic_defense', variant: 'armor' },
  { offset: 0x0c, label: '五属性耐性档', domain: 'relic_resistance', variant: 'armor' },
  { offset: 0x0e, label: '发掘强化', domain: 'upgrade', variant: 'armor' },
  ...commonFields,
]

export function relicWeaponFields(typeId: number, recordHex: string): RelicField[] {
  const bowgun = typeId === 12 || typeId === 13
  const ranged = bowgun || typeId === 14
  const special = [1, 5].includes(typeId) ? 'attack_boost' : [3, 7].includes(typeId) ? 'defense_boost'
    : [2, 4].includes(typeId) ? 'affinity_boost' : [9, 10].includes(typeId) ? 'relic_phial'
    : typeId === 8 ? 'shelling' : bowgun ? 'available_shots' : typeId === 6 ? 'notes' : 'reserved'
  const fields: RelicField[] = [{ offset: 0x0d, label: '攻击档', domain: 'attack_tier', variant: ranged ? 'ranged' : 'melee' }]
  if (!bowgun) fields.push(
    { offset: 0x05, label: '属性 / 异常类型', domain: 'attribute_type', variant: 'relic' },
    { offset: 0x04, label: '属性 / 异常值', domain: readRelicField(recordHex, { offset: 5 }) >= 6 ? 'status_value' : 'attribute_value', variant: [1, 6].includes(typeId) ? 'high' : [3, 4, 11, 14].includes(typeId) ? 'low' : 'medium' },
  )
  fields.push(
    { offset: 0x0c, label: typeId === 14 ? '弓配置' : bowgun ? '弹匣配置' : '斩味配置', domain: 'sharpness', variant: typeId === 12 ? 'light_bowgun' : typeId === 13 ? 'heavy_bowgun' : typeId === 14 ? 'bow' : 'melee' },
    { offset: 0x0e, label: '发掘强化', domain: 'upgrade', variant: 'weapon' },
  )
  if (typeId === 11) fields.push({ offset: 0x0f, label: '猎虫类型 / 效果', domain: 'kinsect', variant: 'type' })
  else if (typeId !== 14) fields.push({ offset: 0x0f, label: '武器专项', domain: 'weapon_special', variant: special })
  fields.push(...commonFields, { offset: 0x13, label: '极限强化', domain: 'honing', variant: 'weapon' })
  if (typeId === 11) fields.push({ offset: 0x01, label: '猎虫等级', domain: 'kinsect', variant: 'level' })
  return fields
}
