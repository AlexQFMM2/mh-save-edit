import { z } from 'zod'

export const gameIdSchema = z.enum(['mh3g', 'mh4g', 'mhgu'])
export const itemIdentitySchema = z.object({ gameId: gameIdSchema, saveId: z.number().int().min(0).max(65535) }).strict()
export const itemCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetSaveId: z.number().int().min(0).max(65535).optional(),
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
export const decorationIdentitySchema = z.object({ gameId: gameIdSchema, saveId: z.number().int().min(0).max(65535) }).strict()
export const decorationCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetSaveId: z.number().int().min(0).max(65535).optional(),
  query: z.string().trim().max(120).optional(),
  skillId: z.number().int().min(0).max(65535).optional(),
  slots: z.number().int().min(0).max(9).optional(),
  includePlaceholders: z.boolean().optional(),
  sort: z.enum(['saveId', 'name', 'slots', 'skillPoints']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict()

export const weaponKeySchema = z.string().trim().min(3).max(40).regex(/^\d+:\d+(?::\d+)?$/)
export const weaponIdentitySchema = z.object({ gameId: gameIdSchema, weaponKey: weaponKeySchema }).strict().superRefine((value, context) => {
  const parts = value.weaponKey.split(':')
  if ((value.gameId === 'mhgu' && parts.length !== 3) || (value.gameId !== 'mhgu' && parts.length !== 2)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['weaponKey'], message: '武器键与游戏版本不匹配' })
  }
})
export const weaponCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetWeaponKey: weaponKeySchema.optional(),
  query: z.string().trim().max(120).optional(),
  weaponTypeId: z.number().int().min(1).max(14).optional(),
  attributeId: z.union([z.number().int().min(0).max(65535), z.literal('none')]).optional(),
  includeHiddenAttributes: z.boolean().optional(),
  rarity: z.number().int().min(0).max(20).optional(),
  slots: z.number().int().min(0).max(9).optional(),
  directlyProducible: z.boolean().optional(),
  includePlaceholders: z.boolean().optional(),
  sort: z.enum(['saveId', 'name', 'rarity', 'attack', 'slots', 'sharpness', 'affinity']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  sharpnessStage: z.enum(['base', 'handicraft1', 'handicraft2']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict().superRefine((value, context) => {
  if (value.targetWeaponKey) {
    const parts = value.targetWeaponKey.split(':')
    if ((value.gameId === 'mhgu' && parts.length !== 3) || (value.gameId !== 'mhgu' && parts.length !== 2)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['targetWeaponKey'], message: '武器键与游戏版本不匹配' })
    }
  }
  if (value.gameId !== 'mhgu' && value.sharpnessStage === 'handicraft2') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sharpnessStage'], message: '当前游戏不支持匠+2' })
  }
})
export const weaponTreeRequestSchema = z.object({ gameId: gameIdSchema, weaponTypeId: z.number().int().min(1).max(14) }).strict()
