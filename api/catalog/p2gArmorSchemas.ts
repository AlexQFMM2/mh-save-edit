import { z } from 'zod'

export const p2gArmorKeySchema = z.string().max(40).regex(/^armor_(?:head|chest|arms|waist|legs):[1-9]\d*$/)
export const p2gArmorIdentitySchema = z.object({ gameId: z.literal('mhp2g'), armorKey: p2gArmorKeySchema }).strict()
export const p2gArmorFiltersSchema = z.object({
  gameId: z.literal('mhp2g'), targetArmorKey: p2gArmorKeySchema.optional(),
  query: z.string().trim().max(120).optional(),
  part: z.enum(['head','chest','arms','waist','legs']).optional(),
  combat: z.enum(['both','blademaster','gunner']).optional(), gender: z.enum(['both','male','female']).optional(),
  rarity: z.number().int().min(1).max(10).optional(), slots: z.number().int().min(0).max(3).optional(),
  skillId: z.number().int().min(1).max(255).optional(),
  sort: z.enum(['nativeId','name','rarity','slots','baseDefense','maxDefense','fireRes','waterRes','thunderRes','iceRes','dragonRes','skillPoints']).optional(),
  direction: z.enum(['asc','desc']).optional(), page: z.number().int().min(1).max(100000).optional(), pageSize: z.number().int().min(1).max(100).optional(),
}).strict()
export const p2gArmorSetFiltersSchema = p2gArmorFiltersSchema.omit({ part: true, sort: true }).extend({ sort: z.enum(['source','name','rarity','slots','baseDefense','maxDefense','skillPoints']).optional() }).strict()
