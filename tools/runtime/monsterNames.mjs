import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { isKhezu, khezuName, modernMonsterText, modernKhezuReference } from '../../api/catalog/monsterNaming.mjs'
import { catalogIdentityRows, identityFingerprint, normalizeTerm } from '../../api/terminology/catalogIdentity.mjs'

// Only application-owned display columns are eligible. Dex copies, Japanese,
// source/evidence fields, IDs and gameplay values remain immutable.
const displayColumns = {
  catalog_items: ['name_cn', 'description'],
  catalog_item_relations: ['target_name'],
  catalog_weapons: ['name_cn'],
  catalog_armors: ['name_cn'],
  catalog_armor_sets: ['blademaster_name_cn', 'gunner_name_cn'],
  catalog_quests: ['name_cn', 'goal_cn', 'sub_goal_cn'],
  catalog_palico_weapons: ['name_cn', 'description_cn'],
  catalog_palico_armors: ['name_cn', 'description_cn'],
  catalog_palico_support_move_unlocks: ['description_cn'],
  p2g_quests: ['name_cn'],
}
const jsonTables = ['p2g_quests', 'p2g_skill_equipment', 'p2g_weapons', 'p2g_armors', 'p2g_armor_sets']
const jsonDisplayKeys = new Set(['nameCn', 'goalCn', 'subGoalCn', 'descriptionCn', 'monsterTextCn'])
const namingSource = '项目译名：按用户确认的崛起怪物名称统一相关称呼'
const exists = (db, table) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
const columns = (db, table) => new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name))
const sourceHash = () => createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url)))
  .update(fs.readFileSync(new URL('../../api/catalog/monsterNaming.mjs', import.meta.url))).digest('hex')

function displayJson(value) {
  if (Array.isArray(value)) return value.map(displayJson)
  if (!value || typeof value !== 'object') return value
  const output = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    ['raw', 'evidence', 'source', 'nameAliases'].includes(key) ? entry
      : jsonDisplayKeys.has(key) && typeof entry === 'string' ? modernMonsterText(entry) : displayJson(entry)]))
  if (typeof value.nameCn === 'string' && value.nameCn !== output.nameCn) {
    output.nameAliases = [...new Set([...(value.nameAliases ?? []), value.nameCn])]
    if (Object.hasOwn(value, 'nameSource')) output.nameSource = namingSource
  }
  for (const [chinese, japanese] of [['descriptionCn', 'descriptionJp'], ['goalCn', 'goalJp']]) {
    if (typeof value[chinese] === 'string' && typeof value[japanese] === 'string') output[chinese] = modernKhezuReference(value[japanese], value[chinese])
  }
  return output
}

function repairSearch(db, table, transform = modernMonsterText) {
  if (!exists(db, table)) return
  const info = db.prepare(`PRAGMA table_info("${table}")`).all()
  const primary = info.find(row => row.pk)?.name
  const names = info.map(row => row.name).filter(name => name !== primary)
  const update = db.prepare(`UPDATE "${table}" SET label=? WHERE "${primary}"=?`)
  const insert = db.prepare(`INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`)
  for (const row of db.prepare(`SELECT * FROM "${table}"`).all()) {
    const label = transform(row.label, row)
    if (label === row.label) continue
    // Keep the old normalized spelling, but show the current label. A second
    // row indexes the current spelling, so both full old titles and new names work.
    update.run(label, row[primary])
    const normalized = transform(row.normalized_text, row)
    if (normalized !== row.normalized_text) insert.run(...names.map(name => name === 'label' ? label : name === 'normalized_text' ? normalized : row[name]))
  }
}

export function repairMonsterNames(db, gameId) {
  if (!exists(db, 'catalog_monsters')) return { monsters: 0, changedRows: 0 }
  const matches = db.prepare('SELECT * FROM catalog_monsters WHERE game_id=?').all(gameId).filter(isKhezu)
  assert(matches.length <= 1, 'Ambiguous Khezu identity; refusing a display-name migration')
  if (!matches.length) return { monsters: 0, changedRows: 0 }
  const monster = matches[0]
  const localizedItems = gameId === 'mhp2g' && exists(db, 'catalog_item_localization')
    ? db.prepare('SELECT i.item_id,i.name_cn,i.description FROM catalog_items i JOIN catalog_item_localization l USING(item_id)').all() : []
  let changedRows = 0
  db.transaction(() => {
    if (monster.name_cn !== khezuName) changedRows += db.prepare('UPDATE catalog_monsters SET name_cn=? WHERE game_id=? AND monster_id=?').run(khezuName, gameId, monster.monster_id).changes
    if (columns(db, 'catalog_monsters').has('aliases')) {
      const old = JSON.parse(monster.aliases)
      const aliases = [...new Set([...old, monster.name_cn, '白电', '白电龙'])].filter(name => name !== khezuName)
      if (JSON.stringify(old) !== JSON.stringify(aliases)) db.prepare('UPDATE catalog_monsters SET aliases=? WHERE game_id=? AND monster_id=?').run(JSON.stringify(aliases), gameId, monster.monster_id)
    }
    if (exists(db, 'catalog_item_relations')) {
      if (gameId === 'mhp2g' && exists(db, 'catalog_monster_drops')) {
        db.prepare('UPDATE catalog_item_relations SET target_name=? WHERE id IN (SELECT relation_id FROM catalog_monster_drops WHERE monster_id=?)').run(khezuName, monster.monster_id)
      } else if (columns(db, 'catalog_item_relations').has('target_id')) {
        db.prepare("UPDATE catalog_item_relations SET target_name=? WHERE game_id=? AND source_kind='monster' AND target_id=?").run(khezuName, gameId, monster.monster_id)
      }
    }
    for (const [table, fields] of Object.entries(displayColumns)) {
      if (!exists(db, table)) continue
      const present = columns(db, table)
      for (const field of fields.filter(field => present.has(field))) {
        for (const row of db.prepare(`SELECT rowid AS _rid,"${field}" AS value FROM "${table}" WHERE instr("${field}",'白电')>0`).all()) {
          changedRows += db.prepare(`UPDATE "${table}" SET "${field}"=? WHERE rowid=?`).run(modernMonsterText(row.value), row._rid).changes
        }
      }
    }
    for (const table of jsonTables) {
      if (!exists(db, table) || !columns(db, table).has('detail_json')) continue
      for (const row of db.prepare(`SELECT rowid AS _rid,detail_json FROM "${table}" WHERE instr(detail_json,'白电')>0 OR instr(detail_json,'フルフル')>0`).all()) {
        const before = JSON.parse(row.detail_json), after = displayJson(before)
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          changedRows += db.prepare(`UPDATE "${table}" SET detail_json=? WHERE rowid=?`).run(JSON.stringify(after), row._rid).changes
        }
      }
    }
    if (gameId === 'mhp2g' && exists(db, 'catalog_item_localization')) {
      for (const row of db.prepare(`SELECT i.item_id,i.description,l.description_jp FROM catalog_items i JOIN catalog_item_localization l USING(item_id)
        WHERE instr(l.description_jp,'フルフル')>0`).all()) {
        const description = modernKhezuReference(row.description_jp, row.description)
        if (description !== row.description) {
          changedRows += db.prepare('UPDATE catalog_items SET description=? WHERE item_id=?').run(description, row.item_id).changes
        }
      }
      for (const before of localizedItems) {
        const after = db.prepare('SELECT name_cn,description FROM catalog_items WHERE item_id=?').get(before.item_id)
        if (after.name_cn !== before.name_cn) db.prepare("UPDATE catalog_item_localization SET name_source=?,name_status='reviewed' WHERE item_id=?").run(namingSource, before.item_id)
        if (after.description !== before.description) db.prepare("UPDATE catalog_item_localization SET description_source=?,description_status='reviewed' WHERE item_id=?").run(namingSource, before.item_id)
      }
    }
    for (const table of ['catalog_quest_search_terms', 'catalog_hunter_art_search_terms', 'p2g_quest_search', 'p2g_skill_search']) repairSearch(db, table)
    // 4G's base Khezu used 电龙. Scope that legacy spelling to its linked
    // quests; never rewrite 赤电龙 or GU Astalos by a family-name substring.
    if (gameId === 'mh4g' && exists(db, 'catalog_quest_targets') && exists(db, 'catalog_quests')) {
      const rename = value => String(value).replace(/(?<!赤|红|青)电龙/gu, khezuName)
      const keys = db.prepare('SELECT DISTINCT quest_key FROM catalog_quest_targets WHERE game_id=? AND monster_id=?').all(gameId, monster.monster_id).map(row => row.quest_key)
      for (const key of keys) {
        const row = db.prepare('SELECT name_cn,goal_cn,sub_goal_cn FROM catalog_quests WHERE game_id=? AND quest_key=?').get(gameId, key)
        if (row) db.prepare('UPDATE catalog_quests SET name_cn=?,goal_cn=?,sub_goal_cn=? WHERE game_id=? AND quest_key=?').run(...Object.values(row).map(rename), gameId, key)
      }
      const kinds = new Set(['name', 'goal', 'subGoal', 'monster', 'relatedQuest'])
      repairSearch(db, 'catalog_quest_search_terms', (value, row) => kinds.has(row.term_kind) ? rename(value) : value)
    }
    if (exists(db, 'catalog_build_metadata')) db.prepare('INSERT OR REPLACE INTO catalog_build_metadata VALUES (?,?,?,?)').run('monster_names', gameId, sourceHash(), sourceHash())
  })()
  return { monsters: 1, changedRows }
}

export function repairMonsterDictionary(db, catalogs) {
  // Check the original pairing before updating its fingerprint. Never make an
  // unrelated or stale dictionary appear valid by replacing its metadata.
  for (const { gameId, beforeFingerprint, rows } of catalogs) {
    const value = db.prepare('SELECT value FROM meta WHERE key=?').get(`catalog:${gameId}`)?.value
    assert(value === beforeFingerprint || value === identityFingerprint(rows), `${gameId}: stale terminology pairing`)
  }
  db.transaction(() => {
    const alias = db.prepare('INSERT OR IGNORE INTO aliases VALUES (?,?,?,?,?)')
    for (const term of db.prepare("SELECT * FROM terms WHERE instr(preferred_name,'白电')>0").all()) {
      const name = modernMonsterText(term.preferred_name)
      const members = db.prepare('SELECT DISTINCT game_id FROM members WHERE term_id=?').all(term.id)
      for (const { game_id } of members) for (const text of [term.preferred_name, name]) alias.run(term.id, text, normalizeTerm(text), game_id, '项目怪物称呼统一；旧名兼容搜索')
      db.prepare('UPDATE terms SET preferred_name=?,source=? WHERE id=?').run(name, namingSource, term.id)
    }
    for (const { gameId, rows } of catalogs) db.prepare('UPDATE meta SET value=? WHERE key=?').run(identityFingerprint(rows), `catalog:${gameId}`)
  })()
}

export function repairRuntimeMonsterNames(dataRoot) {
  const catalogs = [], dictionaryFile = path.join(dataRoot, 'item-terminology.sqlite')
  const dictionary = fs.existsSync(dictionaryFile) ? new Database(dictionaryFile) : undefined
  try {
    for (const gameId of ['mh3g', 'mh4g', 'mhgu', 'mhp2g']) {
      const file = path.join(dataRoot, `${gameId}.sqlite`)
      if (!fs.existsSync(file)) continue
      const db = new Database(file)
      try {
        const beforeFingerprint = identityFingerprint(catalogIdentityRows(db, gameId))
        if (dictionary) assert.equal(dictionary.prepare('SELECT value FROM meta WHERE key=?').get(`catalog:${gameId}`)?.value, beforeFingerprint, `${gameId}: stale terminology pairing`)
        const result = repairMonsterNames(db, gameId)
        catalogs.push({ gameId, beforeFingerprint, rows: catalogIdentityRows(db, gameId) })
        console.log(`${gameId} monster display names`, result)
      } finally { db.close() }
    }
    if (dictionary) repairMonsterDictionary(dictionary, catalogs)
  } finally { dictionary?.close() }
}
