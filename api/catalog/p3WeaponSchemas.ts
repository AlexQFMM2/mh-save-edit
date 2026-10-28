import { z } from 'zod'
import { p2gWeaponFiltersSchema } from './p2gWeaponSchemas'

export const p3WeaponLimits: Readonly<Record<number, number>> = { 5: 91, 6: 94, 7: 93, 8: 96, 9: 66, 11: 67, 12: 85, 13: 71, 14: 77, 15: 80, 16: 82, 17: 85 }
export const p3WeaponKeySchema = z.string().max(24).regex(/^mhp3:weapon:(?:[5-9]|1[1-7]):[1-9]\d?$/).refine(value => {
  const parts = value.split(':')
  return Number(parts[3]) <= p3WeaponLimits[Number(parts[2])]
}, 'P3 武器编号越界')
export const p3WeaponTypeIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(12), z.literal(13), z.literal(14)])
export const p3WeaponIdentitySchema = z.object({ gameId: z.literal('mhp3'), weaponKey: p3WeaponKeySchema }).strict()
export const p3WeaponFiltersSchema = p2gWeaponFiltersSchema.extend({
  gameId: z.literal('mhp3'), targetWeaponKey: p3WeaponKeySchema.optional(), weaponTypeId: p3WeaponTypeIdSchema.optional(),
  rarity: z.number().int().min(1).max(7).optional(), scope: z.enum(['obtainable', 'special', 'unknown', 'all']).optional(),
}).strict()
export const p3WeaponTreeRequestSchema = z.object({ gameId: z.literal('mhp3'), weaponTypeId: p3WeaponTypeIdSchema }).strict()
