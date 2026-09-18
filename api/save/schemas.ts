import { z } from 'zod'
import { logicalLoadoutSchema } from '../loadout/schemas'

const gameId = z.enum(['mh3g', 'mh4g', 'mhgu'])
const formatId = z.enum(['mh3g-3ds-citra', 'mh3u-wiiu-cemu', 'mh4g-3ds-citra', 'mhgu-switch-yuzu', 'mhxx-3ds-citra'])
const sessionIdentity = z.object({ sessionId: z.string().uuid(), revision: z.number().int().positive() }).strict()
const boxDomain = z.enum(['items', 'hunter-equipment', 'palico-equipment'])

export const saveArmorAppearanceSchema = z.object({ gameId: z.literal('mhgu'), saveType: z.number().int().min(1).max(5), query: z.string().trim().max(120).optional(), page: z.number().int().min(1).max(1000).optional(), pageSize: z.number().int().min(1).max(100).optional() }).strict()

export const saveOpenSchema = z.object({ contentGameId: gameId, formatId }).strict()
export const saveSessionIdSchema = sessionIdentity
export const saveIdentitySchema = sessionIdentity
export const saveCharacterSchema = sessionIdentity.extend({ slot: z.number().int().min(0).max(2) }).strict()
export const saveSectionSchema = sessionIdentity.extend({
  section: z.enum(['personal-info', 'item-box', 'equipment-box', 'palico']),
  page: z.number().int().positive().max(100).optional(),
  domain: boxDomain.optional(),
  selectedIndex: z.number().int().min(0).max(83).optional(),
  query: z.string().trim().max(120).optional(),
  locateAfterSlot: z.number().int().min(-1).max(2299).optional(),
}).strict()

const personalCommand = sessionIdentity.extend({ kind: z.literal('set-personal-field'), field: z.string().min(1).max(64), value: z.union([z.string().max(128), z.number().finite(), z.boolean()]) }).strict()
const itemCommand = sessionIdentity.extend({ kind: z.literal('set-item'), slot: z.number().int().min(0).max(2299), itemId: z.number().int().min(0).max(0xffff), count: z.number().int().min(0).max(0xffff) }).strict()
const equipmentCommand = sessionIdentity.extend({ kind: z.literal('set-equipment-record'), domain: z.enum(['hunter-equipment', 'palico-equipment']), slot: z.number().int().min(0).max(1999), recordHex: z.string().regex(/^[0-9a-f]+$/i).max(72) }).strict()
const equipmentFieldsCommand = sessionIdentity.extend({ kind: z.literal('set-equipment-fields'), domain: z.enum(['hunter-equipment', 'palico-equipment']), slot: z.number().int().min(0).max(1999), changes: z.object({ reset: z.boolean().optional(), saveType: z.number().int().min(0).max(255).optional(), saveId: z.number().int().min(0).max(0xffff).optional(), level: z.number().int().min(0).max(255).optional(), appearanceId: z.number().int().min(0).max(0xffff).optional(), decorations: z.array(z.number().int().min(0).max(0xffff)).max(3).optional(), skill1Id: z.number().int().min(0).max(0xffff).optional(), skill1Points: z.number().int().min(-32768).max(32767).optional(), skill2Id: z.number().int().min(0).max(0xffff).optional(), skill2Points: z.number().int().min(-32768).max(32767).optional(), slots: z.number().int().min(0).max(3).optional() }).strict() }).strict()
const copyCommand = sessionIdentity.extend({ kind: z.literal('copy-box-slot'), domain: boxDomain, sourceSlot: z.number().int().min(0).max(2299), targetSlot: z.number().int().min(0).max(2299).optional() }).strict()
const clearCommand = sessionIdentity.extend({ kind: z.literal('clear-box-slot'), domain: boxDomain, slot: z.number().int().min(0).max(2299) }).strict()
const swapCommand = sessionIdentity.extend({ kind: z.literal('swap-box-slots'), domain: boxDomain, sourceSlot: z.number().int().min(0).max(2299), targetSlot: z.number().int().min(0).max(2299) }).strict()
const palicoChanges = z.object({
  name: z.string().max(31).optional(), forte: z.number().int().min(0).max(255).optional(), target: z.number().int().min(0).max(255).optional(), enthusiasm: z.number().int().min(0).max(255).optional(),
  greeting: z.string().max(59).optional(), nameGiver: z.string().max(31).optional(), previousOwner: z.string().max(31).optional(),
  equippedActions: z.array(z.number().int().min(0).max(255)).length(8).optional(), equippedSkills: z.array(z.number().int().min(0).max(255)).length(8).optional(),
  learnedActions: z.array(z.number().int().min(0).max(255)).length(16).optional(), learnedSkills: z.array(z.number().int().min(0).max(255)).length(12).optional(),
  actionPattern: z.number().int().min(0).max(255).optional(), actionValidLength: z.number().int().min(0).max(255).optional(), skillPattern: z.number().int().min(0).max(255).optional(), skillValidLength: z.number().int().min(0).max(255).optional(),
  voice: z.number().int().min(0).max(255).optional(), eyes: z.number().int().min(0).max(255).optional(), clothing: z.number().int().min(0).max(255).optional(), coat: z.number().int().min(0).max(255).optional(), ears: z.number().int().min(0).max(255).optional(), tail: z.number().int().min(0).max(255).optional(),
  coatColor: z.string().regex(/^[0-9a-f]{8}$/i).optional(), rightEyeColor: z.string().regex(/^[0-9a-f]{8}$/i).optional(), leftEyeColor: z.string().regex(/^[0-9a-f]{8}$/i).optional(), vestColor: z.string().regex(/^[0-9a-f]{8}$/i).optional(),
}).strict()
const palicoCommand = sessionIdentity.extend({ kind: z.literal('set-palico'), index: z.number().int().min(0).max(83), changes: palicoChanges }).strict()
export const saveCommandSchema = z.discriminatedUnion('kind', [personalCommand, itemCommand, equipmentCommand, equipmentFieldsCommand, copyCommand, clearCommand, swapCommand, palicoCommand])

export const saveCloseSchema = sessionIdentity.extend({ discard: z.boolean().optional() }).strict()
export const saveTransferSchema = sessionIdentity.extend({ domain: boxDomain, format: z.enum(['csv', 'full']) }).strict()
export const saveBoxWriteTargetSchema = sessionIdentity.extend({ domain: boxDomain }).strict()
export const saveImportApplySchema = sessionIdentity.extend({ token: z.string().uuid(), replaceAll: z.boolean().optional() }).strict()
export const saveCatalogItemSchema = sessionIdentity.extend({ gameId, saveId: z.number().int().min(1).max(0xffff), count: z.number().int().min(1).max(0xffff), targetSlot: z.number().int().min(0).max(2299).optional() }).strict()
export const saveCatalogEquipmentSchema = sessionIdentity.extend({ gameId, domain: z.enum(['hunter-equipment', 'palico-equipment']), saveType: z.number().int().min(1).max(255), saveId: z.number().int().min(0).max(0xffff), level: z.number().int().min(0).max(31).optional(), appearanceId: z.number().int().min(0).max(0xffff).optional(), targetSlot: z.number().int().min(0).max(1999).optional() }).strict()
export const saveLoadoutWriteSchema = sessionIdentity.extend({ loadout: logicalLoadoutSchema }).strict()
export const saveLoadoutPreviewSchema = saveLoadoutWriteSchema
