import { normalizeTerm, identityFingerprint } from '../../api/terminology/catalogIdentity.mjs'
import { modernMonsterText } from '../../api/catalog/monsterNaming.mjs'

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
      // Require verified official input. An explicit project display policy has
      // its own provenance; it does not relabel derived names as official text.
      if (term.chineseSource !== 'gu_official') throw new Error(`Unverified GU Chinese: ${term.id}`)
      const preferred = modernMonsterText(term.zhHans)
      const source = preferred === term.zhHans ? 'GU 官方简中' : '项目译名：按用户确认的崛起怪物名称统一相关称呼'
      insertTerm.run(term.id, 'item', term.ja ?? '', preferred, source)
      if (preferred !== term.zhHans) alias(term.id, preferred, 'mhgu', source)
      for (const [name, source] of [[term.zhHans, 'GU 官方简中'], [term.zhHant, 'GU 官方繁中'], [term.en, 'GU 英文'], [term.ja, 'GU 日文对照']]) alias(term.id, name, 'mhgu', source)
      if (term.ja?.trim()) {
        const key = japaneseKey(term.ja)
        byJapanese.set(key, [...(byJapanese.get(key) ?? []), term])
      }
    }
    for (const { gameId, rows, dexAliases = new Map(), itemAliases = new Map() } of catalogs) {
      meta.run(`catalog:${gameId}`, identityFingerprint(rows))
      stats[gameId] = { matched: 0, missingJapanese: 0, absentFromGu: 0, ambiguous: 0 }
      for (const row of rows.filter(row => !row.is_placeholder)) {
        const ja = row.name_jp.trim(), matches = ja ? byJapanese.get(japaneseKey(ja)) ?? [] : []
        const status = !ja ? 'missing-japanese' : matches.length === 1 ? 'matched' : matches.length > 1 ? 'ambiguous-japanese' : 'not-in-gu'
        const useGu = status === 'matched' && (gameId !== 'mhp3' || modernMonsterText(row.name_cn) === modernMonsterText(matches[0].zhHans))
        const id = useGu ? matches[0].id : `local:${gameId}:item:${row.id}`
        stats[gameId][status === 'matched' ? 'matched' : status === 'missing-japanese' ? 'missingJapanese' : status === 'not-in-gu' ? 'absentFromGu' : 'ambiguous']++
        if (!useGu) {
          const preferred = modernMonsterText(row.name_cn)
          insertTerm.run(id, 'item', ja, preferred, preferred === row.name_cn ? row.name_source ?? '保留本作原译名' : '项目译名：按用户确认的崛起怪物名称统一相关称呼')
          if (preferred !== row.name_cn) alias(id, preferred, gameId, '项目当前显示名')
          reviews.push({ gameId, itemId: row.id, status })
        }
        if (gameId !== 'mhp3' && status === 'matched' && row.name_status && modernMonsterText(row.name_cn) !== modernMonsterText(matches[0].zhHans)) throw new Error(`P2G catalog/dictionary translation conflict at ${row.id}`)
        const memberStatus = gameId === 'mhp3' ? 'project-reviewed' : row.name_status === 'pending' ? 'translation-pending' : row.name_status === 'reviewed' ? 'project-reviewed' : row.name_status === 'official' && status !== 'matched' ? 'official-wording' : status
        insertMember.run(gameId, row.id, id, row.original_name ?? row.name_cn, ja, memberStatus)
        alias(id, row.name_cn, gameId, row.name_source ?? '本作原译名')
        alias(id, row.original_name, gameId, '旧汉化搜索别名（非定名依据）')
        for (const name of itemAliases.get(row.id) ?? []) alias(id, name, gameId, '项目旧译名搜索别名（非定名依据）')
        alias(id, row.name_en, gameId, '本作英文名')
        alias(id, ja, gameId, gameId === 'mhp3' ? 'P3 原生日文' : gameId === 'mhp2g' ? 'P2G 日文资料对照' : 'Dex 日文')
        for (const name of dexAliases.get(row.dex_id) ?? []) alias(id, name, gameId, 'Dex 译名')
      }
    }
  })()
  if (db.pragma('foreign_key_check').length) throw new Error('Dictionary has dangling members')
  return { stats, reviews, terms: db.prepare('SELECT count(*) n FROM terms').get().n }
}
