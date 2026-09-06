import type { GameId, Loadout } from './loadout'
import type { ValidationResult } from './validation'
export interface SaveInfo { game: GameId; platform: '3ds' | 'wiiu' | 'switch' | 'unknown'; displayName: string; version?: string }
export interface SaveModel { info: SaveInfo; loadouts: Loadout[]; raw: Uint8Array }
export interface GameAdapter { readonly game: GameId; detectSave(raw: Uint8Array): SaveInfo | undefined; readSave(raw: Uint8Array): SaveModel; writeSave(model: SaveModel): Uint8Array; validateLoadout(loadout: Loadout): ValidationResult }
