import { z } from 'zod'
import { p2gArmorFiltersSchema } from './p2gArmorSchemas'

const limits = [232, 212, 213, 219, 255]
export const p3ArmorKeySchema = z.string().max(24).regex(/^mhp3:armor:[0-4]:[1-9]\d{0,2}$/).refine(value => {
  const parts = value.split(':')
  return Number(parts[3]) <= limits[Number(parts[2])]
}, 'P3 防具编号越界')
export const p3ArmorIdentitySchema = z.object({ gameId: z.literal('mhp3'), armorKey: p3ArmorKeySchema }).strict()
export const p3ArmorFiltersSchema = p2gArmorFiltersSchema.extend({
  gameId: z.literal('mhp3'), targetArmorKey: p3ArmorKeySchema.optional(),
  rarity: z.number().int().min(1).max(7).optional(), skillId: z.number().int().min(1).max(100).optional(),
  scope: z.enum(['obtainable', 'unknown', 'special', 'all']).optional(),
}).strict()
export const p3ArmorSetFiltersSchema = p3ArmorFiltersSchema.omit({ part: true, sort: true }).extend({
  sort: z.enum(['source', 'name', 'rarity', 'slots', 'baseDefense', 'maxDefense', 'skillPoints']).optional(),
}).strict()
