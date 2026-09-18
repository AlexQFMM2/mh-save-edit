import type Database from 'better-sqlite3'
import type { Mh4gCharmNativeInput } from '../../api/loadout/mh4gCharmTypes'

export function validateMh4gNativeInput(input: unknown): Mh4gCharmNativeInput
export function readStoredMh4gNative(db: Database.Database): Mh4gCharmNativeInput | null
