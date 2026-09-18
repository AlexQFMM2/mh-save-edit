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
  finalOnly: z.boolean().optional(),
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
const weaponStyleSchema = z.enum(['guild','striker','aerial','adept','alchemy','valor'])
export const weaponMotionFiltersSchema = z.object({
  gameId: z.literal('mhgu'),
  weaponTypeId: z.number().int().min(1).max(14),
  query: z.string().trim().max(120).optional(),
  styleIds: z.array(weaponStyleSchema).max(6).optional(),
  category: z.enum(['standard','style','hunterArt']).optional(),
  sort: z.enum(['source','motionValue','stun','exhaust']).optional(),
  direction: z.enum(['asc','desc']).optional(),
}).strict()

export const armorIdentitySchema = z.object({ gameId: gameIdSchema, dexId: z.number().int().min(1).max(65535) }).strict()
export const skillIdentitySchema = z.object({ gameId: gameIdSchema, skillId: z.number().int().min(0).max(65535) }).strict()
export const skillCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetSkillId: z.number().int().min(0).max(65535).optional(),
  query: z.string().trim().max(120).optional(),
  direction: z.enum(['positive','negative','special']).optional(),
  source: z.enum(['armor','decoration','talisman','all']).optional(),
  includePlaceholders: z.boolean().optional(),
  sort: z.enum(['skillId','name','activationCount']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict()
export const monsterIdentitySchema = z.object({ gameId: gameIdSchema, monsterId: z.number().int().min(1).max(65535) }).strict()
export const monsterCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetMonsterId: z.number().int().min(1).max(65535).optional(),
  query: z.string().trim().max(120).optional(),
  includePlaceholders: z.boolean().optional(),
}).strict()
export const questKeySchema = z.string().trim().min(5).max(32).regex(/^(?:dex:\d+|mhgu:q\d{7})$/)
export const questIdentitySchema = z.object({ gameId: gameIdSchema, questKey: questKeySchema }).strict()
export const questCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetQuestKey: questKeySchema.optional(),
  query: z.string().trim().max(120).optional(),
  system: z.string().trim().min(1).max(32).regex(/^[a-z-]+$/).optional(),
  levelId: z.number().int().min(-1).max(65535).optional(),
  rank: z.enum(['low','high','g','other']).optional(),
  questTypeId: z.number().int().min(-1).max(65535).optional(),
  locationId: z.number().int().min(-1).max(65535).optional(),
  keyStatus: z.enum(['normal','key','urgent']).optional(),
  availability: z.enum(['common','mhgu','mhxx']).optional(),
  includePlaceholders: z.boolean().optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict()
export const hunterArtIdentitySchema = z.object({ gameId: z.literal('mhgu'), hunterArtId: z.number().int().min(0).max(190) }).strict()
export const hunterArtCatalogFiltersSchema = z.object({
  gameId: gameIdSchema,
  targetHunterArtId: z.number().int().min(0).max(190).optional(),
  query: z.string().trim().max(120).optional(),
  weaponTypeId: z.number().int().min(0).max(14).optional(),
  level: z.union([z.number().int().min(1).max(3),z.literal('none')]).optional(),
  unlockKind: z.enum(['initial','quest','hunterRank','contribution','palicoLevel','monster','npc','compound','other']).optional(),
  includePlaceholders: z.boolean().optional(),
}).strict().superRefine((value,context)=>{if(value.gameId!=='mhgu')context.addIssue({code:z.ZodIssueCode.custom,path:['gameId'],message:'当前游戏没有狩技图鉴'})})
const armorCommonFilters = {
  gameId: gameIdSchema,
  targetDexId: z.number().int().min(1).max(65535).optional(),
  query: z.string().trim().max(120).optional(),
  combat: z.enum(['both', 'blademaster', 'gunner']).optional(),
  gender: z.enum(['both', 'male', 'female']).optional(),
  rarity: z.number().int().min(0).max(20).optional(),
  slots: z.number().int().min(0).max(9).optional(),
  skillId: z.number().int().min(0).max(65535).optional(),
  includePlaceholders: z.boolean().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}
export const armorCatalogFiltersSchema = z.object({
  ...armorCommonFilters,
  part: z.enum(['head', 'chest', 'arms', 'waist', 'legs']).optional(),
  sort: z.enum(['dexId', 'name', 'rarity', 'slots', 'baseDefense', 'maxDefense', 'fireRes', 'waterRes', 'thunderRes', 'iceRes', 'dragonRes', 'skillPoints']).optional(),
}).strict()
export const armorSetFiltersSchema = z.object({
  ...armorCommonFilters,
  sort: z.enum(['source', 'name', 'rarity', 'slots', 'baseDefense', 'maxDefense', 'skillPoints']).optional(),
}).strict()

const mhguSchema = z.literal('mhgu')
const palicoId = z.number().int().min(0).max(65535)
const palicoQuery = z.string().trim().max(120).optional()
const palicoPage = { page:z.number().int().min(1).max(100000).optional(),pageSize:z.number().int().min(1).max(100).optional() }
export const palicoTypeIdentitySchema=z.object({gameId:mhguSchema,typeId:z.number().int().min(0).max(7)}).strict()
export const palicoSupportMoveIdentitySchema=z.object({gameId:mhguSchema,supportMoveId:z.number().int().min(1).max(56)}).strict()
export const palicoSkillIdentitySchema=z.object({gameId:mhguSchema,palicoSkillId:z.number().int().min(1).max(95)}).strict()
export const palicoEquipmentIdentitySchema=z.object({gameId:mhguSchema,kind:z.enum(['weapon','armor']),equipmentId:palicoId}).strict()
export const palicoSupportMoveFiltersSchema=z.object({gameId:mhguSchema,targetSupportMoveId:z.number().int().min(1).max(56).optional(),query:palicoQuery,typeId:z.number().int().min(0).max(7).optional(),gaugeCost:z.number().int().min(0).max(20).optional(),generationGroup:z.enum(['A','B','C','fixed']).optional(),monsterId:palicoId.optional()}).strict()
export const palicoSkillFiltersSchema=z.object({gameId:mhguSchema,targetPalicoSkillId:z.number().int().min(1).max(95).optional(),query:palicoQuery,memoryCost:z.number().int().min(0).max(20).optional(),generationGroup:z.enum(['A','B','C','fixed']).optional(),learnLevel:z.number().int().min(0).max(99).optional(),unlockKind:z.enum(['initial','innate','monster','level','distribution']).optional()}).strict()
export const palicoWeaponFiltersSchema=z.object({gameId:mhguSchema,targetEquipmentId:palicoId.optional(),query:palicoQuery,attackType:z.enum(['cut','blunt']).optional(),specializationId:palicoId.optional(),rarity:z.number().int().min(1).max(20).optional(),specialAttackId:z.union([palicoId,z.literal('none')]).optional(),sharpnessId:z.number().int().min(2).max(7).optional(),sort:z.enum(['source','meleeAttack','rangedAttack','affinity','sharpness','defense']).optional(),direction:z.enum(['asc','desc']).optional(),...palicoPage}).strict()
export const palicoArmorFiltersSchema=z.object({gameId:mhguSchema,targetEquipmentId:palicoId.optional(),query:palicoQuery,part:z.enum(['head','body']).optional(),rarity:z.number().int().min(1).max(20).optional(),sort:z.enum(['source','defense','fireRes','waterRes','thunderRes','iceRes','dragonRes']).optional(),direction:z.enum(['asc','desc']).optional(),...palicoPage}).strict()
