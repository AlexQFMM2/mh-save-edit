import { z } from 'zod'

export const gameIdSchema = z.enum(['mh3g', 'mh4g', 'mhgu'])
export const itemIdentitySchema = z.object({ gameId: gameIdSchema, saveId: z.number().int().min(0).max(65535) }).strict()
export const itemCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  query: z.string().trim().max(120).optional(),
  rarity: z.number().int().min(0).max(20).optional(),
  maxStack: z.number().int().min(0).max(9999).optional(),
  sourceKinds: z.array(z.enum(['combination', 'monster', 'location', 'quest', 'exchange'])).max(5).optional(),
  usageKinds: z.array(z.enum(['weapon', 'armor', 'decoration', 'palico-weapon', 'palico-armor', 'kinsect'])).max(6).optional(),
  includePlaceholders: z.boolean().optional(),
  sort: z.enum(['saveId', 'name', 'rarity']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict()
