import type Database from 'better-sqlite3'
import type { Mh4gCharmNativeInput } from '../../api/loadout/mh4gCharmTypes'
export type RuntimeWitnessTuple = [number, number, number, number, number, number]
export type RuntimeWitnessData = { format: 'mh4g-charm-witnesses-v1'; nativeSha256: string; outcomes: RuntimeWitnessTuple[] }
export const MH4G_RUNTIME_WITNESS_SHA256: string
export function validateMh4gWitnessData(input: unknown, native: Mh4gCharmNativeInput, expectedHash?: string): RuntimeWitnessData
export function readStoredMh4gWitnessData(db: Database.Database, native: Mh4gCharmNativeInput, expectedHash?: string): RuntimeWitnessData | null
export function installMh4gWitnessData(db: Database.Database, native: Mh4gCharmNativeInput, input: RuntimeWitnessData, builderHash: string, expectedHash?: string): { outcomes: number; payloadSha256: string }
