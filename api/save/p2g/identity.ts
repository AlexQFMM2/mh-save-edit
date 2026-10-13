/** Native dispatch verified against JP BOOT 0x0885c960 / 0x0885ca48. */
export const P2G_SAVE_TABLES = ['armor_legs', 'armor_head', 'armor_chest', 'armor_arms', 'armor_waist', 'weapon_blademaster', 'weapon_ranged'] as const
export function p2gSaveIdentity(key: string): { saveType: number; saveId: number } {
  const [table, index, extra] = key.split(':')
  const saveType = P2G_SAVE_TABLES.findIndex(value => value === table), saveId = Number(index)
  if (extra != null || saveType < 0 || !/^\d+$/.test(index ?? '') || !Number.isInteger(saveId) || saveId < 1 || saveId > 65535) throw new Error('P2G 装备原生身份无效')
  return { saveType, saveId }
}
export function p2gEquipmentKey(saveType: number, saveId: number): string | null {
  return P2G_SAVE_TABLES[saveType] ? `${P2G_SAVE_TABLES[saveType]}:${saveId}` : null
}
