import { normalizeTerm, identityFingerprint } from '../../api/terminology/catalogIdentity.mjs'

// Width variants of Latin letters/digits do not change an item's identity.
// Preserve level prefixes, circled numbers, punctuation and all kana/kanji.
const japaneseKey = value => value.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))

export function createItemDictionary(db, guTerms, catalogs) {
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE terms(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind='item'),ja TEXT NOT NULL,preferred_name TEXT NOT NULL,source TEXT NOT NULL);
    CREATE TABLE aliases(term_id TEXT NOT NULL REFERENCES terms(id),name TEXT NOT NULL,normalized TEXT NOT NULL,game_id TEXT NOT NULL,source TEXT NOT NULL,UNIQUE(term_id,name,game_id,source));
    CREATE TABLE members(game_id TEXT NOT NULL,item_id INTEGER NOT NULL,term_id TEXT NOT NULL REFERENCES terms(id),original_name TEXT NOT NULL,ja TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(game_id,item_id));
    CREATE INDEX aliases_term ON aliases(term_id);
    CREATE INDEX members_term ON members(term_id);
  `)
  const insertTerm = db.prepare('INSERT INTO terms VALUES(?,?,?,?,?)')
  const insertAlias = db.prepare('INSERT OR IGNORE INTO aliases VALUES(?,?,?,?,?)')
  const insertMember = db.prepare('INSERT INTO members VALUES(?,?,?,?,?,?)')
  const meta = db.prepare('INSERT INTO meta VALUES(?,?)')
  const byJapanese = new Map(), stats = {}, reviews = []
  const alias = (id, name, game, source) => {
    if (String(name ?? '').trim()) insertAlias.run(id, name.trim(), normalizeTerm(name), game, source)
  }
  db.transaction(() => {
    meta.run('schema', 'item-terminology-v1')
    for (const term of guTerms) {
      if (term.kind !== 'item' || !term.zhHans) continue
      // Only source-verified official Chinese is eligible as the preferred name.
      if (term.chineseSource !== 'gu_official') throw new Error(`Unverified GU Chinese: ${term.id}`)
      insertTerm.run(term.id, 'item', term.ja ?? '', term.zhHans, 'GU 官方简中')
      for (const [name, source] of [[term.zhHans, 'GU 官方简中'], [term.zhHant, 'GU 官方繁中'], [term.en, 'GU 英文'], [term.ja, 'GU 日文对照']]) alias(term.id, name, 'mhgu', source)
      if (term.ja?.trim()) {
        const key = japaneseKey(term.ja)
        byJapanese.set(key, [...(byJapanese.get(key) ?? []), term])
      }
    }
    for (const { gameId, rows, dexAliases = new Map() } of catalogs) {
      meta.run(`catalog:${gameId}`, identityFingerprint(rows))
      stats[gameId] = { matched: 0, missingJapanese: 0, absentFromGu: 0, ambiguous: 0 }
      for (const row of rows.filter(row => !row.is_placeholder)) {
        const ja = row.name_jp.trim(), matches = ja ? byJapanese.get(japaneseKey(ja)) ?? [] : []
        const status = !ja ? 'missing-japanese' : matches.length === 1 ? 'matched' : matches.length > 1 ? 'ambiguous-japanese' : 'not-in-gu'
        const id = status === 'matched' ? matches[0].id : `local:${gameId}:item:${row.id}`
        stats[gameId][status === 'matched' ? 'matched' : status === 'missing-japanese' ? 'missingJapanese' : status === 'not-in-gu' ? 'absentFromGu' : 'ambiguous']++
        if (status !== 'matched') {
          insertTerm.run(id, 'item', ja, row.name_cn, row.name_source ?? '保留本作原译名')
          reviews.push({ gameId, itemId: row.id, status })
        }
        if (status === 'matched' && row.name_status && row.name_cn !== matches[0].zhHans) throw new Error(`P2G catalog/dictionary translation conflict at ${row.id}`)
        const memberStatus = row.name_status === 'pending' ? 'translation-pending' : row.name_status === 'reviewed' ? 'project-reviewed' : row.name_status === 'official' && status !== 'matched' ? 'official-wording' : status
        insertMember.run(gameId, row.id, id, row.original_name ?? row.name_cn, ja, memberStatus)
        alias(id, row.name_cn, gameId, row.name_source ?? '本作原译名')
        alias(id, row.original_name, gameId, '旧汉化搜索别名（非定名依据）')
        alias(id, row.name_en, gameId, '本作英文名')
        alias(id, ja, gameId, gameId === 'mhp2g' ? 'P2G 日文资料对照' : 'Dex 日文')
        for (const name of dexAliases.get(row.dex_id) ?? []) alias(id, name, gameId, 'Dex 译名')
      }
    }
  })()
  if (db.pragma('foreign_key_check').length) throw new Error('Dictionary has dangling members')
  return { stats, reviews, terms: db.prepare('SELECT count(*) n FROM terms').get().n }
}
