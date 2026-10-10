import type Database from 'better-sqlite3'
export type IdentityRow = { id: number; dex_id: number | null; name_cn: string; name_en: string; name_jp: string; is_placeholder: number; original_name?: string; name_source?: string; name_status?: string }
export function normalizeTerm(value: unknown): string
export function catalogIdentityRows(db: Database.Database, gameId: string): IdentityRow[]
export function identityFingerprint(rows: IdentityRow[]): string
