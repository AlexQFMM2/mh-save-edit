// 2026-10-21: user-confirmed Rise wording for Khezu. This is a display/search
// policy, not a cross-generation monster ID or gameplay-data mapping.
export const khezuName = '奇怪龙'
export const isKhezu = row => row.name_jp === 'フルフル' && row.name_en === 'Khezu'

export function modernMonsterText(text) {
  return String(text).replaceAll('白电龙', khezuName).replaceAll('白电', khezuName)
}

export function monsterNameQuery(query) {
  return query == null ? query : modernMonsterText(query)
}

export function modernKhezuReference(japanese, translated) {
  const text = modernMonsterText(translated)
  return japanese.includes('フルフル') && !japanese.includes('亜種')
    ? text.replace(/(?<!红|赤|青)电龙(?!亚种)/gu, khezuName) : text
}
