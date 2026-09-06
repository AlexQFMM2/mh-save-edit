import type { EquipmentSlot, GameId, LoadoutEquipment } from './loadout'
export interface EquipmentSummary { id: number; slot: EquipmentSlot; name: string; rarity?: number; slots: number; skills: Record<string, number>; source?: 'catalog' | 'save' }
export interface EquipmentCatalog { game: GameId; list(slot: EquipmentSlot, query?: string): Promise<EquipmentSummary[]>; get(slot: EquipmentSlot, id: number): Promise<EquipmentSummary | undefined>; toLoadoutEquipment(summary: EquipmentSummary): LoadoutEquipment }
