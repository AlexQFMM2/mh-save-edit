import type Database from 'better-sqlite3'
import type { Mh4gCharmNativeInput, Mh4gExecutionInput } from '../../api/loadout/mh4gCharmTypes'
export function validateMh4gExecution(input: unknown): Mh4gExecutionInput
export function readStoredMh4gExecution(db: Database.Database, native: Mh4gCharmNativeInput): Mh4gExecutionInput | null
