import { z } from 'zod'

export const p2gWeaponKeySchema = z.string().max(40).regex(/^weapon_(?:blademaster|ranged):[1-9]\d*$/)
export const p2gWeaponIdentitySchema = z.object({ gameId: z.literal('mhp2g'), weaponKey: p2gWeaponKeySchema }).strict()
export const p2gWeaponTypeIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(12), z.literal(13), z.literal(14)])
export const p2gWeaponFiltersSchema = z.object({
  gameId: z.literal('mhp2g'),
  targetWeaponKey: p2gWeaponKeySchema.optional(),
  query: z.string().trim().max(120).optional(),
  weaponTypeId: p2gWeaponTypeIdSchema.optional(),
  attributeId: z.union([z.number().int().min(1).max(8), z.literal('none')]).optional(),
  rarity: z.number().int().min(1).max(10).optional(),
  slots: z.number().int().min(0).max(3).optional(),
  directlyProducible: z.boolean().optional(),
  finalOnly: z.boolean().optional(),
  sort: z.enum(['nativeId', 'name', 'rarity', 'attack', 'slots', 'sharpness', 'affinity']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  sharpnessStage: z.enum(['base', 'handicraft1']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict()
export const p2gWeaponTreeRequestSchema = z.object({ gameId: z.literal('mhp2g'), weaponTypeId: p2gWeaponTypeIdSchema }).strict()
