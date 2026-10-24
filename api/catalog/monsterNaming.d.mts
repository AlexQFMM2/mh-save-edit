export const khezuName: string
export function isKhezu(row: { name_jp: string; name_en: string }): boolean
export function modernMonsterText(text: string): string
export function monsterNameQuery<T extends string | null | undefined>(query: T): T
export function modernKhezuReference(japanese: string, translated: string): string
