import type { GameId } from '../core/loadout'

export const ARMOR_APPEARANCE_SPRITE_PATH = '/assets/catalog/appearance/hunter.png'

export type HunterArmorPart = 'head' | 'chest' | 'arms' | 'waist' | 'legs'
const guParts: Record<number, HunterArmorPart> = { 1: 'head', 2: 'chest', 3: 'arms', 4: 'waist', 5: 'legs' }
const olderParts: Record<number, HunterArmorPart> = { 1: 'chest', 2: 'arms', 3: 'waist', 4: 'legs', 5: 'head' }

/** GU and XX share the verified content domain; older save type numbers differ. */
export function armorPartForSaveType(gameId: GameId, saveType: number): HunterArmorPart | undefined {
  return (gameId === 'mhgu' ? guParts : olderParts)[saveType]
}
