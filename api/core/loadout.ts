export type GameId = 'mh3g' | 'mh4g' | 'mhgu'
export type EquipmentSlot = 'weapon' | 'head' | 'chest' | 'arms' | 'waist' | 'legs' | 'charm'
export interface DecorationChoice { id: number; count: number }
export interface LoadoutEquipment { equipmentId: number; level: number; decorations: DecorationChoice[]; attributes?: Record<string, number | string | boolean> }
export interface Loadout { game: GameId; name: string; gender: 'male' | 'female' | 'any'; equipment: Partial<Record<EquipmentSlot, LoadoutEquipment>>; metadata?: Record<string, string | number | boolean> }
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = ['weapon','head','chest','arms','waist','legs','charm']
export function emptyLoadout(game: GameId): Loadout { return { game, name: '未命名配装', gender: 'any', equipment: {} } }
