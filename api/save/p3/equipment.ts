import type { P3EquipmentChanges } from '../types'

export const P3_CHARM_TYPE = 101
export const P3_CHARM_GRADES = ['兵士护石', '斗士护石', '骑士护石', '城塞护石', '女王护石', '王之护石', '龙之护石'] as const
export const P3_ARMOR_PARTS = ['chest', 'arms', 'waist', 'legs', 'head'] as const
export const P3_WEAPON_TYPES = [5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17] as const

export function p3EquipmentKey(type: number, id: number): string | null {
  if (!id) return null
  if (type >= 0 && type < P3_ARMOR_PARTS.length) return `mhp3:armor:${type}:${id}`
  if (P3_WEAPON_TYPES.some(value => value === type)) return `mhp3:weapon:${type}:${id}`
  return null
}

export function p3WeaponBoostMask(type: number): number {
  return type === 9 || type === 11 || type === 15 ? 0xf : 0xff
}

export function readP3Charm(record: Buffer): NonNullable<P3EquipmentChanges['charm']> {
  const points = record.readUInt16LE(2)
  const skills = record.readUInt16LE(4)
  return {
    grade: points & 15, skill1Points: ((points >> 4) & 63) - 30, skill2Points: (points >> 10) - 30,
    skill1Id: skills & 127, skill2Id: (skills >> 7) & 127, slots: skills >> 14,
  }
}

export function writeP3Charm(record: Buffer, charm: ReturnType<typeof readP3Charm>) {
  const { grade, skill1Id, skill1Points, skill2Id, skill2Points, slots } = charm
  const fits = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max
  if (!fits(grade, 0, 6) || !fits(slots, 0, 3) || !fits(skill1Id, 0, 127) || !fits(skill2Id, 0, 127)
    || !fits(skill1Points, -30, 33) || !fits(skill2Points, -30, 33)
    || (!skill1Id && skill1Points !== 0) || (!skill2Id && skill2Points !== 0)) {
    throw new Error('护石品级、技能点或孔数超出 P3 编码范围')
  }
  record.writeUInt16LE(grade | ((skill1Points + 30) << 4) | ((skill2Points + 30) << 10), 2)
  record.writeUInt16LE(skill1Id | (skill2Id << 7) | (slots << 14), 4)
}
