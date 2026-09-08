#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { parseCsv } from './lib/csv.mjs'
import { parseArc } from './lib/mhQuestArc.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const installLocal = args.includes('--install-local')
const dataRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const reportRoot = path.join(dataRoot, 'manifests')
const temporaryDatabases = new Set()
process.on('exit', () => {
  for (const file of temporaryDatabases) {
    try { fs.unlinkSync(file) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  }
})
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = (file) => sha256(fs.readFileSync(file))
const clean = (value) => String(value ?? '').trim()
const integer = (value, fallback = null) => { const result = Number.parseInt(String(value ?? ''), 10); return Number.isFinite(result) ? result : fallback }

const specs = {
  mh3g: { dexRoot: 'mh3u/dex/mh3g-dex/direct_sql', questCount: 364, rewardCount: 6560 },
  mh4g: { dexRoot: 'mh4g/dex/mh4g-dex/direct_sql', questCount: 572, rewardCount: 13012 },
  mhgu: { dexRoot: 'mhgu/dex/mhxx-dex/direct_sql', questCount: 1356, rewardCount: 37569 },
}

const weaponTypes = [
  { min: 1, max: 10, id: 0, cn: '通用', en: 'General' },
  { min: 11, max: 22, id: 1, cn: '大剑', en: 'Great Sword' },
  { min: 23, max: 34, id: 3, cn: '片手剑', en: 'Sword & Shield' },
  { min: 35, max: 46, id: 5, cn: '大锤', en: 'Hammer' },
  { min: 47, max: 58, id: 7, cn: '长枪', en: 'Lance' },
  { min: 59, max: 70, id: 13, cn: '重弩炮', en: 'Heavy Bowgun' },
  { min: 83, max: 94, id: 12, cn: '轻弩炮', en: 'Light Bowgun' },
  { min: 95, max: 106, id: 2, cn: '太刀', en: 'Long Sword' },
  { min: 107, max: 118, id: 9, cn: '斩击斧', en: 'Switch Axe' },
  { min: 119, max: 130, id: 8, cn: '铳枪', en: 'Gunlance' },
  { min: 131, max: 142, id: 14, cn: '弓', en: 'Bow' },
  { min: 143, max: 154, id: 4, cn: '双剑', en: 'Dual Blades' },
  { min: 155, max: 166, id: 6, cn: '狩猎笛', en: 'Hunting Horn' },
  { min: 167, max: 178, id: 11, cn: '操虫棍', en: 'Insect Glaive' },
  { min: 179, max: 190, id: 10, cn: '盾斧', en: 'Charge Blade' },
]

function normalizeSearch(value) {
  return clean(value)
    .replace(/^狩技\s*[：:]\s*/u, '')
    .replace(/Ⅲ/gu, '3').replace(/Ⅱ/gu, '2').replace(/Ⅰ/gu, '1')
    .replace(/\bIII\b/giu, '3').replace(/\bII\b/giu, '2').replace(/\bI\b/giu, '1')
    .normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]+/gu, '')
}

function plainWiki(value) {
  return clean(value)
    .replace(/\[\[[^\]|#]+(?:#[^\]|]*)?\|([^\]]+)\]\]/gu, '$1')
    .replace(/\[\[([^\]]+)\]\]/gu, '$1')
    .replace(/<br\s*\/?\s*>/giu, ' ')
    .replace(/<[^>]+>/gu, '')
    .replace(/'{2,}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function readGmdStrings(file, key, expectedRows, fieldsPerRow) {
  const values = fs.readFileSync(file).subarray(0x28).toString('utf8').split('\0')
  if (values[0] !== key) throw new Error(`Unexpected GMD key in ${file}`)
  const rows = values.slice(1, 1 + expectedRows * fieldsPerRow)
  if (rows.length !== expectedRows * fieldsPerRow) throw new Error(`Unexpected GMD row count in ${file}`)
  return rows
}

function wikiRevision(file, expectedRevision) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const page = json.query?.pages?.[0]
  const revision = page?.revisions?.[0]
  if (revision?.revid !== expectedRevision) throw new Error(`Wiki revision mismatch: ${file}`)
  return { title: page.title, revisionId: revision.revid, timestamp: revision.timestamp, content: revision.slots.main.content }
}

function hunterArtWikiRows(content) {
  const rows = []
  const expression = /\|-\n\|[^\n]*\|([^\n]*?)<br\s*\/?>([^\n]*)\n\|([\s\S]*?)\n\|([^\n]*)/gu
  let match
  while ((match = expression.exec(content))) rows.push({ nameEn: plainWiki(match[1]), nameJp: plainWiki(match[2]), description: plainWiki(match[3]), unlockText: plainWiki(match[4]), unlockWikitext: match[4] })
  if (rows.length !== 178) throw new Error(`Expected 178 Hunter Art wiki rows, received ${rows.length}`)
  return rows
}

function questWikiRows(content) {
  const rows = []
  const blockExpression = /\{\{MH4 Quest Box\s*\n([\s\S]*?)\n\}\}/gu
  let block
  while ((block = blockExpression.exec(content))) {
    const fields = {}
    const fieldExpression = /^\|([^=\n]+?)\s*=\s*([\s\S]*?)(?=^\|[^=\n]+?\s*=|$)/gmu
    let field
    while ((field = fieldExpression.exec(block[1]))) fields[field[1].trim()] = field[2].trim()
    if (fields['English Quest Name']) rows.push({ nameEn: plainWiki(fields['English Quest Name']), nameJp: plainWiki(fields['Japanese Quest Name']), notes: fields.Notes ?? '' })
  }
  return rows
}

function addColumn(db, table, definition) {
  const name = definition.split(/\s+/u)[0]
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

function classifyQuest(gameId, nameCn, nameEn, nativeRank) {
  const text = `${nameCn} ${nameEn}`
  const starMatch = text.match(/G\s*(\d+)\s*★/iu) ?? text.match(/(\d+)\s*★/u)
  const star = starMatch ? Number(starMatch[1]) : null
  let system = 'other'; let systemNameCn = '其他'
  if (/村|旅|Village|Caravan|^V\s/iu.test(text)) { system = 'village'; systemNameCn = gameId === 'mh4g' ? '旅团' : '村' }
  else if (/港|集|Port|Hall|Hub|^P\s|^G\s/iu.test(text)) { system = 'hub'; systemNameCn = gameId === 'mh3g' ? '港' : '集会所' }
  else if (/DLC|Event|活动/iu.test(text)) { system = 'event'; systemNameCn = '活动' }
  else if (/许可|Permit/iu.test(text)) { system = 'permit'; systemNameCn = '特殊许可' }
  let rank = nativeRank ?? 'other'
  if (!nativeRank) {
    if (/G级|Ｇ级|G\s*(?:Rank|\d)/iu.test(text)) rank = 'g'
    else if (/上位|High/iu.test(text)) rank = 'high'
    else if (/下位|Low/iu.test(text)) rank = 'low'
    else if (star != null) {
      if (gameId === 'mh3g') rank = system === 'village' ? (star <= 5 ? 'low' : 'high') : star <= 2 ? 'low' : star <= 5 ? 'high' : 'g'
      else if (gameId === 'mh4g') rank = system === 'village' ? (star <= 5 ? 'low' : 'high') : star <= 3 ? 'low' : star <= 7 ? 'high' : 'g'
      else rank = system === 'village' ? (star <= 6 ? 'low' : 'high') : star <= 3 ? 'low' : star <= 7 ? 'high' : 'g'
    }
  }
  return { system, systemNameCn, rank, star }
}

function createExtensionSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS catalog_hunter_art_quest_refs;
    DROP TABLE IF EXISTS catalog_hunter_art_unlocks;
    DROP TABLE IF EXISTS catalog_hunter_art_search_terms;
    DROP TABLE IF EXISTS catalog_hunter_arts;
    DROP TABLE IF EXISTS catalog_quest_search_terms;
    DROP TABLE IF EXISTS catalog_quest_relations;
    DROP TABLE IF EXISTS catalog_quest_special_rewards;
    DROP TABLE IF EXISTS catalog_quest_rewards;
    CREATE TABLE catalog_quest_rewards (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, quest_key TEXT NOT NULL, group_key TEXT NOT NULL, region TEXT NOT NULL,
      item_save_id INTEGER NOT NULL, item_name_cn TEXT NOT NULL, item_name_en TEXT NOT NULL, quantity INTEGER NOT NULL,
      probability REAL NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key),
      FOREIGN KEY(game_id,item_save_id) REFERENCES catalog_items(game_id,save_id)
    );
    CREATE TABLE catalog_quest_special_rewards (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, quest_key TEXT NOT NULL, reward_kind TEXT NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL, hunter_art_id INTEGER,
      evidence_status TEXT NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key)
    );
    CREATE TABLE catalog_quest_relations (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, group_key TEXT NOT NULL, source_quest_key TEXT NOT NULL,
      target_quest_key TEXT NOT NULL, condition_operator TEXT NOT NULL, source_text TEXT NOT NULL,
      evidence_status TEXT NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,source_quest_key) REFERENCES catalog_quests(game_id,quest_key),
      FOREIGN KEY(game_id,target_quest_key) REFERENCES catalog_quests(game_id,quest_key)
    );
    CREATE TABLE catalog_quest_search_terms (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, quest_key TEXT NOT NULL, term_kind TEXT NOT NULL,
      label TEXT NOT NULL, normalized_text TEXT NOT NULL,
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key)
    );
    CREATE TABLE catalog_hunter_arts (
      game_id TEXT NOT NULL, hunter_art_id INTEGER NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      short_description_cn TEXT NOT NULL, long_description_cn TEXT NOT NULL, short_description_en TEXT NOT NULL,
      long_description_en TEXT NOT NULL, short_description_jp TEXT NOT NULL, long_description_jp TEXT NOT NULL,
      weapon_type_id INTEGER NOT NULL, weapon_type_name_cn TEXT NOT NULL, weapon_type_name_en TEXT NOT NULL,
      level INTEGER, content_variant TEXT NOT NULL, is_placeholder INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      PRIMARY KEY(game_id,hunter_art_id)
    );
    CREATE TABLE catalog_hunter_art_unlocks (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, hunter_art_id INTEGER NOT NULL, unlock_kind TEXT NOT NULL,
      condition_json TEXT NOT NULL, source_text TEXT NOT NULL, evidence_status TEXT NOT NULL, source_title TEXT NOT NULL,
      source_revision INTEGER NOT NULL,
      FOREIGN KEY(game_id,hunter_art_id) REFERENCES catalog_hunter_arts(game_id,hunter_art_id)
    );
    CREATE TABLE catalog_hunter_art_quest_refs (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, hunter_art_id INTEGER NOT NULL, quest_key TEXT NOT NULL,
      relation_order INTEGER NOT NULL, condition_operator TEXT NOT NULL, after_npc_conversation INTEGER NOT NULL DEFAULT 0,
      evidence_status TEXT NOT NULL,
      FOREIGN KEY(game_id,hunter_art_id) REFERENCES catalog_hunter_arts(game_id,hunter_art_id),
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key)
    );
    CREATE TABLE catalog_hunter_art_search_terms (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, hunter_art_id INTEGER NOT NULL, term_kind TEXT NOT NULL,
      label TEXT NOT NULL, normalized_text TEXT NOT NULL,
      FOREIGN KEY(game_id,hunter_art_id) REFERENCES catalog_hunter_arts(game_id,hunter_art_id)
    );
    CREATE INDEX idx_quest_rewards_quest ON catalog_quest_rewards(game_id,quest_key,group_key,probability DESC);
    CREATE INDEX idx_quest_search ON catalog_quest_search_terms(game_id,normalized_text,quest_key);
    CREATE INDEX idx_quest_relations_source ON catalog_quest_relations(game_id,source_quest_key);
    CREATE INDEX idx_quest_relations_target ON catalog_quest_relations(game_id,target_quest_key);
    CREATE INDEX idx_hunter_art_filters ON catalog_hunter_arts(game_id,is_placeholder,weapon_type_id,level);
    CREATE INDEX idx_hunter_art_quest ON catalog_hunter_art_quest_refs(game_id,quest_key,hunter_art_id);
    CREATE INDEX idx_hunter_art_search ON catalog_hunter_art_search_terms(game_id,normalized_text,hunter_art_id);
  `)
}

function buildGame(gameId, spec, hunterArtSources) {
  const canonical = path.join(dataRoot, `${gameId}.sqlite`)
  if (!fs.existsSync(canonical)) throw new Error(`Build monsters first; missing ${canonical}`)
  const temp = path.join(dataRoot, `.${gameId}.quest-build-${process.pid}.sqlite`)
  temporaryDatabases.add(temp)
  fs.copyFileSync(canonical, temp)
  const db = new Database(temp)
  db.pragma('foreign_keys = ON')
  addColumn(db, 'catalog_quests', "key_status TEXT NOT NULL DEFAULT 'normal'")
  addColumn(db, 'catalog_quests', "system_key TEXT NOT NULL DEFAULT 'other'")
  addColumn(db, 'catalog_quests', "system_name_cn TEXT NOT NULL DEFAULT '其他'")
  addColumn(db, 'catalog_quests', "rank_key TEXT NOT NULL DEFAULT 'other'")
  addColumn(db, 'catalog_quests', 'star INTEGER')
  addColumn(db, 'catalog_quests', 'source_order INTEGER NOT NULL DEFAULT 0')
  addColumn(db, 'catalog_quests', 'is_placeholder INTEGER NOT NULL DEFAULT 0')
  createExtensionSchema(db)

  const dexRoot = path.join(researchRoot, spec.dexRoot)
  const questRows = parseCsv(path.join(dexRoot, 'DB_Qst.csv'))
  const rewards = parseCsv(path.join(dexRoot, 'DB_ItmtoQst.csv'))
  if (rewards.length !== spec.rewardCount) throw new Error(`${gameId}: expected ${spec.rewardCount} rewards, received ${rewards.length}`)
  const nativeReport = gameId === 'mhgu' ? JSON.parse(fs.readFileSync(path.join(reportRoot, 'mhgu-native-quest-crosswalk.json'), 'utf8')) : null
  const nativeByKey = new Map(nativeReport?.tasks.map((task) => [task.nativeQuestId, task]) ?? [])
  const questDex = new Map(questRows.map((row, index) => [integer(row.Qst_ID), { row, index }]))
  const itemsByDex = new Map(db.prepare('SELECT save_id,dex_id,name_cn,name_en FROM catalog_items WHERE game_id=? AND dex_id IS NOT NULL').all(gameId).map((row) => [row.dex_id, row]))
  const itemsBySave = new Map(db.prepare('SELECT save_id,dex_id,name_cn,name_en FROM catalog_items WHERE game_id=?').all(gameId).map((row) => [row.save_id, row]))

  const updateQuest = db.prepare('UPDATE catalog_quests SET key_status=?,system_key=?,system_name_cn=?,rank_key=?,star=?,source_order=?,is_placeholder=? WHERE game_id=? AND quest_key=?')
  const insertReward = db.prepare('INSERT INTO catalog_quest_rewards (game_id,quest_key,group_key,region,item_save_id,item_name_cn,item_name_en,quantity,probability,source) VALUES (?,?,?,?,?,?,?,?,?,?)')
  const insertSpecial = db.prepare('INSERT INTO catalog_quest_special_rewards (game_id,quest_key,reward_kind,name_cn,name_en,name_jp,hunter_art_id,evidence_status,source) VALUES (?,?,?,?,?,?,?,?,?)')
  const insertRelation = db.prepare('INSERT INTO catalog_quest_relations (game_id,group_key,source_quest_key,target_quest_key,condition_operator,source_text,evidence_status,source) VALUES (?,?,?,?,?,?,?,?)')
  const insertTerm = db.prepare('INSERT INTO catalog_quest_search_terms (game_id,quest_key,term_kind,label,normalized_text) VALUES (?,?,?,?,?)')

  const transaction = db.transaction(() => {
    const quests = db.prepare('SELECT * FROM catalog_quests WHERE game_id=? ORDER BY level_id,COALESCE(dex_id,999999),quest_key').all(gameId)
    if (quests.length !== spec.questCount) throw new Error(`${gameId}: expected ${spec.questCount} quests, received ${quests.length}`)
    quests.forEach((quest, index) => {
      const dex = quest.dex_id == null ? null : questDex.get(quest.dex_id)?.row
      const native = nativeByKey.get(quest.quest_key)
      const classification = classifyQuest(gameId, quest.level_name_cn, quest.level_name_en, native?.rank)
      const keyId = integer(dex?.Qst_Key_ID, -1)
      const keyStatus = keyId === 1 ? 'key' : keyId === 2 ? 'urgent' : 'normal'
      const placeholder = /dummy|未使用|预备/iu.test(`${quest.name_cn} ${quest.name_en}`) ? 1 : 0
      updateQuest.run(keyStatus, classification.system, classification.systemNameCn, classification.rank, native?.star ?? classification.star, index, placeholder, gameId, quest.quest_key)
    })

    for (const row of rewards) {
      const questKey = `dex:${integer(row.Qst_ID)}`
      const item = itemsByDex.get(integer(row.Itm_ID))
      if (!item || !db.prepare('SELECT 1 FROM catalog_quests WHERE game_id=? AND quest_key=?').get(gameId, questKey)) throw new Error(`${gameId}: unmapped Dex reward ${row.ID}`)
      insertReward.run(gameId, questKey, clean(row.Type) || '—', clean(row.Region) || '—', item.save_id, item.name_cn, item.name_en, integer(row.Qty, 1), Number(row.Pct), `${gameId}:DB_ItmtoQst`)
    }

    if (gameId === 'mhgu') {
      installNativeQuestRewards(db, nativeReport, itemsBySave, insertReward)
      installActivityRewards(db, nativeReport, hunterArtSources.activity, insertSpecial)
      installHunterArts(db, hunterArtSources, insertSpecial)
      installQuestWikiRelations(db, hunterArtSources.questWiki, insertRelation, insertSpecial)
    }

    const allQuests = db.prepare('SELECT * FROM catalog_quests WHERE game_id=?').all(gameId)
    for (const quest of allQuests) {
      const direct = [['name',quest.name_cn],['name',quest.name_en],['name',quest.name_jp],['goal',quest.goal_cn],['goal',quest.goal_en],['subGoal',quest.sub_goal_cn],['subGoal',quest.sub_goal_en],['map',quest.location_name_cn],['map',quest.location_name_en],['id',quest.quest_key],['id',quest.dex_id == null ? '' : String(quest.dex_id)],['id',quest.dex_id == null ? '' : `0x${Number(quest.dex_id).toString(16)}`]]
      for (const [kind, label] of direct) addSearchTerm(insertTerm, gameId, quest.quest_key, kind, label)
    }
    for (const row of db.prepare('SELECT quest_key,name_cn,name_en FROM catalog_quest_targets JOIN catalog_monsters USING(game_id,monster_id) WHERE game_id=?').all(gameId)) { addSearchTerm(insertTerm,gameId,row.quest_key,'monster',row.name_cn); addSearchTerm(insertTerm,gameId,row.quest_key,'monster',row.name_en) }
    for (const row of db.prepare('SELECT quest_key,item_name_cn,item_name_en FROM catalog_quest_rewards WHERE game_id=?').all(gameId)) { addSearchTerm(insertTerm,gameId,row.quest_key,'reward',row.item_name_cn); addSearchTerm(insertTerm,gameId,row.quest_key,'reward',row.item_name_en) }
    for (const row of db.prepare('SELECT quest_key,name_cn,name_en,name_jp,hunter_art_id FROM catalog_quest_special_rewards WHERE game_id=?').all(gameId)) {
      for (const name of [row.name_cn,row.name_en,row.name_jp]) addSearchTerm(insertTerm,gameId,row.quest_key,row.hunter_art_id == null?'special':'hunterArt',name)
    }
    for (const row of db.prepare(`SELECT r.source_quest_key quest_key,q.name_cn,q.name_en,q.name_jp FROM catalog_quest_relations r JOIN catalog_quests q ON q.game_id=r.game_id AND q.quest_key=r.target_quest_key WHERE r.game_id=? UNION ALL SELECT r.target_quest_key,q.name_cn,q.name_en,q.name_jp FROM catalog_quest_relations r JOIN catalog_quests q ON q.game_id=r.game_id AND q.quest_key=r.source_quest_key WHERE r.game_id=?`).all(gameId,gameId)) {
      for (const name of [row.name_cn,row.name_en,row.name_jp]) addSearchTerm(insertTerm,gameId,row.quest_key,'relatedQuest',name)
    }
  })
  transaction()

  const foreignKeys = db.pragma('foreign_key_check')
  if (foreignKeys.length) throw new Error(`${gameId}: foreign key validation failed`)
  const counts = {
    quests: db.prepare('SELECT count(*) count FROM catalog_quests WHERE game_id=?').get(gameId).count,
    rewards: db.prepare('SELECT count(*) count FROM catalog_quest_rewards WHERE game_id=?').get(gameId).count,
    dexRewards: db.prepare("SELECT count(*) count FROM catalog_quest_rewards WHERE game_id=? AND source LIKE '%DB_ItmtoQst'").get(gameId).count,
    hunterArts: gameId === 'mhgu' ? db.prepare('SELECT count(*) count FROM catalog_hunter_arts WHERE game_id=? AND is_placeholder=0').get(gameId).count : 0,
    placeholderHunterArts: gameId === 'mhgu' ? db.prepare('SELECT count(*) count FROM catalog_hunter_arts WHERE game_id=? AND is_placeholder=1').get(gameId).count : 0,
    unlocks: gameId === 'mhgu' ? db.prepare("SELECT count(*) count FROM catalog_hunter_art_unlocks WHERE game_id=? AND evidence_status!='conflict'").get(gameId).count : 0,
  }
  if (counts.dexRewards !== spec.rewardCount) throw new Error(`${gameId}: Dex reward count mismatch`)
  if (gameId === 'mhgu' && (counts.hunterArts !== 178 || counts.placeholderHunterArts !== 13 || counts.unlocks !== 178)) throw new Error(`mhgu: Hunter Art audit mismatch ${JSON.stringify(counts)}`)
  const tables = ['catalog_quests','catalog_quest_rewards','catalog_quest_special_rewards','catalog_quest_relations','catalog_quest_search_terms','catalog_hunter_arts','catalog_hunter_art_unlocks','catalog_hunter_art_quest_refs','catalog_hunter_art_search_terms']
  const contentSha256 = sha256(JSON.stringify(tables.map((table) => [table, db.prepare(`SELECT * FROM ${table} WHERE game_id=? ORDER BY rowid`).all(gameId)])))
  db.close()
  fs.renameSync(temp, canonical)
  temporaryDatabases.delete(temp)
  if (installLocal) fs.copyFileSync(canonical, path.join(projectRoot, 'data', `${gameId}.sqlite`))
  return { gameId, counts, contentSha256 }
}

function addSearchTerm(statement, gameId, questKey, kind, label) {
  const normalized = normalizeSearch(label)
  if (normalized) statement.run(gameId, questKey, kind, plainWiki(label), normalized)
}

function installNativeQuestRewards(db, report, itemsBySave, insertReward) {
  const questRoot = path.join(researchRoot, 'mhgu/romfs/mhgu-quests')
  for (const task of report.tasks.filter((row) => row.availability === 'mhgu')) {
    const file = path.join(questRoot, task.nativeFile)
    const arc = parseArc(file)
    const link = arc.entries.find((entry) => entry.type === 0x00e0bb1c)
    const rewardEntries = new Map(arc.entries.filter((entry) => entry.type === 0x5b3c302d).map((entry) => [entry.name.split(/[\\/]/u).at(-1), entry]))
    const ordered = link ? [...link.data.toString('latin1').matchAll(/rem_(\d+)/gu)].map((match) => `rem_${match[1]}`) : [...rewardEntries.keys()].sort()
    for (const [groupIndex, name] of [...new Set(ordered)].entries()) {
      const entry = rewardEntries.get(name); if (!entry) continue
      const count = entry.data.readUInt8(9)
      for (let index = 0; index < count; index += 1) {
        const offset = 24 + index * 4
        const item = itemsBySave.get(entry.data.readUInt16LE(offset))
        if (!item) throw new Error(`mhgu: unmapped native reward ${task.nativeFile}:${name}:${index}`)
        insertReward.run('mhgu', task.nativeQuestId, `原生奖励组 ${groupIndex + 1}`, 'MHGU', item.save_id, item.name_cn, item.name_en, entry.data.readUInt8(offset + 2), entry.data.readUInt8(offset + 3) / 100, `mhgu:${task.nativeFile}:${name}`)
      }
    }
  }
}

function installActivityRewards(db, report, activity, insertSpecial) {
  const atd = fs.readFileSync(activity.table)
  const cn = readGmdStrings(activity.cn, 'activityData', 184, 5)
  const en = readGmdStrings(activity.en, 'activityData', 184, 5)
  const jp = readGmdStrings(activity.jp, 'activityData', 184, 5)
  const tasksByFile = new Map(report.tasks.map((task) => [task.nativeFile, task]))
  for (const row of report.dexCrosswalk) for (const nativeFile of row.mhguNativeFiles) {
    if (!tasksByFile.has(nativeFile)) tasksByFile.set(nativeFile, { nativeFile, availability: row.availability, dexQuestIds: [row.dexQuestId] })
  }
  for (let index = 0; index < 184; index += 1) {
    const nativeNumber = atd.readUInt32LE(8 + index * 55 + 22)
    if (!nativeNumber) continue
    const task = tasksByFile.get(`q${String(nativeNumber).padStart(7,'0')}.arc`)
    if (!task) throw new Error(`mhgu: unmapped activity quest ${nativeNumber}`)
    const questKey = task.availability === 'mhgu' ? task.nativeQuestId : `dex:${task.dexQuestIds[0]}`
    for (let reward = 1; reward <= 4; reward += 1) {
      const names = [cn[index*5+reward],en[index*5+reward],jp[index*5+reward]]
      if (!names[0] || /^dummy$/iu.test(names[0])) continue
      insertSpecial.run('mhgu',questKey,classifySpecialReward(names[0]),names[0],names[1],names[2],null,'verified',`mhgu:activityData:${index}`)
    }
  }
}

function classifySpecialReward(value) {
  if (/狩技/u.test(value)) return 'hunter-art-category'
  if (/食材|料理/u.test(value)) return 'food'
  if (/装备|裝備|制作|製法/u.test(value)) return 'equipment'
  if (/任务|任務/u.test(value)) return 'quest'
  if (/设施|設施|服务|服務/u.test(value)) return 'facility'
  return 'other'
}

function extractNpcName(value) {
  const match = value.match(/talk to (?:the )?(.+?)(?:\s+in\s+[^.]+|\s*\(|\.|$)/iu)
  return clean(match?.[1]) || '相关 NPC'
}

function parseStandaloneUnlock(value, monstersByName) {
  let match = value.match(/(?:Hunter Rank|\bHR)\s*(\d+)/iu)
  if (match) return { kind: 'hunterRank', condition: { kind: 'hunterRank', minimum: Number(match[1]) } }

  match = value.match(/(?:Get )?a Palico to Level\s*(\d+)/iu)
  if (match) return { kind: 'palicoLevel', condition: { kind: 'palicoLevel', minimum: Number(match[1]) } }

  match = value.match(/Gain\s*(\d+)\s*or more points in\s+(.+?)\s+Village/iu)
  if (match) return { kind: 'contribution', condition: { kind: 'villageContribution', village: clean(match[2]), minimum: Number(match[1]) } }

  match = value.match(/Complete\s*(\d+)\s+(.+?)\s+Quests?\.?$/iu)
  if (match) return { kind: 'contribution', condition: { kind: 'villageQuestCount', village: clean(match[2]), minimum: Number(match[1]) } }

  match = value.match(/Complete the Arena Quest\s+["“](.+?)["”]/iu)
  if (match) return { kind: 'other', condition: { kind: 'arenaQuest', name: clean(match[1]) } }

  match = value.match(/(?:Hunt|Slay)\s+(?:an?\s+)?(.+?)[.!]?$/iu)
  if (match) {
    const name = clean(match[1])
    const monster = monstersByName.get(normalizeSearch(name))
    if (!monster) throw new Error(`Unmapped Hunter Art unlock monster: ${name}`)
    return {
      kind: 'monster',
      condition: {
        kind: 'huntMonster',
        monsterId: monster.monster_id,
        nameCn: monster.name_cn,
        nameEn: monster.name_en,
        quantity: 1,
      },
    }
  }

  if (/speak|talk/iu.test(value)) return { kind: 'npc', condition: { kind: 'npcConversation', npcName: extractNpcName(value) } }
  return { kind: 'other', condition: { kind: 'sourceText', text: value } }
}

function installHunterArts(db, sources, insertSpecial) {
  const table = fs.readFileSync(sources.hunterArts.table)
  if (table.length !== 8 + 191 * 25) throw new Error('Unexpected Hunter Art table size')
  const cn = readGmdStrings(sources.hunterArts.cn, 'hunterArtsData', 191, 4)
  const en = readGmdStrings(sources.hunterArts.en, 'hunterArtsData', 191, 4)
  const jp = readGmdStrings(sources.hunterArts.jp, 'hunterArtsData', 191, 4)
  const wikiRows = hunterArtWikiRows(sources.hunterArts.wiki.content)
  const wikiByName = new Map(wikiRows.map((row) => [normalizeSearch(row.nameEn), row]))
  const quests = db.prepare('SELECT quest_key,name_cn,name_en,name_jp FROM catalog_quests WHERE game_id=\'mhgu\'').all()
  const questByName = new Map()
  for (const quest of quests) for (const name of [quest.name_en,quest.name_jp]) { const key=normalizeSearch(name); if(key&&!questByName.has(key)) questByName.set(key,quest) }
  const monstersByName = new Map()
  for (const monster of db.prepare("SELECT monster_id,name_cn,name_en,name_jp FROM catalog_monsters WHERE game_id='mhgu' AND is_placeholder=0").all()) {
    for (const name of [monster.name_cn,monster.name_en,monster.name_jp]) {
      const key = normalizeSearch(name)
      if (key) monstersByName.set(key, monster)
    }
  }
  const insertArt = db.prepare('INSERT INTO catalog_hunter_arts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertUnlock = db.prepare('INSERT INTO catalog_hunter_art_unlocks (game_id,hunter_art_id,unlock_kind,condition_json,source_text,evidence_status,source_title,source_revision) VALUES (?,?,?,?,?,?,?,?)')
  const insertRef = db.prepare('INSERT INTO catalog_hunter_art_quest_refs (game_id,hunter_art_id,quest_key,relation_order,condition_operator,after_npc_conversation,evidence_status) VALUES (?,?,?,?,?,?,?)')
  const insertTerm = db.prepare('INSERT INTO catalog_hunter_art_search_terms (game_id,hunter_art_id,term_kind,label,normalized_text) VALUES (?,?,?,?,?)')
  const verifiedArts = new Set([21,33,45,57,69,93,105,117,129,141,153,165,177,189])
  for (let id = 0; id < 191; id += 1) {
    if (table.readUInt32LE(8 + id * 25) !== id) throw new Error(`Hunter Art ID mismatch at ${id}`)
    const names = { cn: cn[id*4], en: en[id*4], jp: jp[id*4] }
    const placeholder = id === 0 || (id >= 71 && id <= 82) || !names.cn || names.cn === '@'
    const type = weaponTypes.find((entry) => id >= entry.min && id <= entry.max) ?? { id: 0, cn: '占位', en: 'Placeholder' }
    const levelMatch = names.cn.match(/([ⅠⅡⅢ])$/u)
    const level = levelMatch ? ({Ⅰ:1,Ⅱ:2,Ⅲ:3})[levelMatch[1]] : null
    insertArt.run('mhgu',id,names.cn,names.en,names.jp,cn[id*4+2],cn[id*4+3],en[id*4+2],en[id*4+3],jp[id*4+2],jp[id*4+3],type.id,type.cn,type.en,level,'common',placeholder?1:0,'mhgu:hunterArtsData')
    if (placeholder) continue
    const wiki = wikiByName.get(normalizeSearch(names.en))
    if (!wiki) throw new Error(`Missing Hunter Art wiki row: ${id} ${names.en}`)
    const references = [...wiki.unlockWikitext.matchAll(/\[\[[^\]]*#([^\]|]+)\|([^\]]+)\]\]/gu)]
    const questRefs = references.map((match) => questByName.get(normalizeSearch(plainWiki(match[2])))).filter(Boolean)
    const operator = /\bor\b/iu.test(wiki.unlockText) ? 'any' : 'all'
    const afterNpc = /(?:speak|talk).*?(?:after|upon)|after.*?(?:speak|talk)/iu.test(wiki.unlockText)
    const evidence = verifiedArts.has(id) ? 'verified' : 'wiki_only'
    const conditions = questRefs.map((quest) => ({ kind:'quest',questKey:quest.quest_key,nameCn:quest.name_cn,nameEn:quest.name_en,afterNpcConversation:afterNpc }))
    let kind
    let condition
    if (/unlocked from the beginning/iu.test(wiki.unlockText)) {
      kind = 'initial'
      condition = {kind:'initial'}
    } else if (conditions.length) {
      const questCondition = conditions.length === 1 ? conditions[0] : {kind:operator,conditions}
      const npcName = extractNpcName(wiki.unlockText)
      condition = afterNpc
        ? {kind:'all',conditions:[questCondition,{kind:'npcConversation',npcName}]}
        : questCondition
      kind = conditions.length > 1 || afterNpc ? 'compound' : 'quest'
    } else {
      const parsed = parseStandaloneUnlock(wiki.unlockText, monstersByName)
      kind = parsed.kind
      condition = parsed.condition
    }
    insertUnlock.run('mhgu',id,kind,JSON.stringify(condition),wiki.unlockText,evidence,sources.hunterArts.wiki.title,sources.hunterArts.wiki.revisionId)
    questRefs.forEach((quest,index)=>insertRef.run('mhgu',id,quest.quest_key,index,operator,afterNpc?1:0,evidence))
    for (const [termKind,label] of [['id',String(id)],['id',`0x${id.toString(16)}`],['name',names.cn],['name',names.en],['name',names.jp],['description',cn[id*4+2]],['description',cn[id*4+3]],['description',en[id*4+2]],['description',en[id*4+3]],['description',jp[id*4+2]],['description',jp[id*4+3]],['weapon',type.cn],['weapon',type.en],['unlock',wiki.unlockText]]) {
      const normalized = normalizeSearch(label); if (normalized) insertTerm.run('mhgu',id,termKind,plainWiki(label),normalized)
    }
    for (const quest of questRefs) for (const label of [quest.name_cn,quest.name_en,quest.name_jp]) { const normalized=normalizeSearch(label); if(normalized) insertTerm.run('mhgu',id,'quest',label,normalized) }
  }
  const duplicateWiki = wikiRows.filter((row)=>!db.prepare('SELECT 1 FROM catalog_hunter_arts WHERE game_id=\'mhgu\' AND name_en=? AND is_placeholder=0').get(row.nameEn))
  if (duplicateWiki.length) throw new Error(`Unmapped Hunter Art wiki entries: ${duplicateWiki.map((row)=>row.nameEn).join(', ')}`)
  for (const row of db.prepare(`SELECT r.quest_key,a.hunter_art_id,a.name_cn,a.name_en,a.name_jp,r.evidence_status FROM catalog_hunter_art_quest_refs r JOIN catalog_hunter_arts a USING(game_id,hunter_art_id) WHERE r.game_id='mhgu'`).all()) {
    insertSpecial.run('mhgu',row.quest_key,'hunter-art',row.name_cn,row.name_en,row.name_jp,row.hunter_art_id,row.evidence_status,'MHGU: Hunter Arts rev 917516')
  }
}

function installQuestWikiRelations(db, sources, insertRelation, insertSpecial) {
  const quests = db.prepare("SELECT quest_key,name_cn,name_en,name_jp FROM catalog_quests WHERE game_id='mhgu'").all()
  const byName = new Map()
  for (const quest of quests) for (const name of [quest.name_en,quest.name_jp]) { const key=normalizeSearch(name); if(key) byName.set(key,[...(byName.get(key)??[]),quest]) }
  const seen = new Set()
  for (const source of sources) for (const row of questWikiRows(source.content)) {
    const candidates = byName.get(normalizeSearch(row.nameEn)) ?? []
    const current = candidates.length === 1 ? candidates[0] : candidates.find((quest)=>normalizeSearch(quest.name_jp)===normalizeSearch(row.nameJp))
    if (!current || !row.notes) continue
    for (const [lineIndex,line] of row.notes.split(/\n+/u).entries()) {
      const text = plainWiki(line); if (!text) continue
      const links = [...line.matchAll(/\[\[(?:[^\]]*#)?([^\]|#]+)\|([^\]]+)\]\]/gu)]
      const targets = links.map((match)=>{const matches=byName.get(normalizeSearch(plainWiki(match[2])))??[];return matches.length===1?matches[0]:undefined}).filter(Boolean)
      const operator = /\bor\b/iu.test(text) ? 'any' : 'all'
      if (/must complete/iu.test(text)) for (const sourceQuest of targets) addRelation(sourceQuest.quest_key,current.quest_key)
      else if (/unlock/iu.test(text) && targets.length) for (const target of targets) addRelation(current.quest_key,target.quest_key)
      else if (/unlock/iu.test(text)) insertSpecial.run('mhgu',current.quest_key,'wiki-note',text,text,'',null,'wiki_only',`${source.title} rev ${source.revisionId}`)
      function addRelation(sourceKey,targetKey){const key=`${sourceKey}>${targetKey}>${text}`;if(seen.has(key))return;seen.add(key);insertRelation.run('mhgu',`${source.revisionId}:${normalizeSearch(row.nameEn)}:${lineIndex}`,sourceKey,targetKey,operator,text,'wiki_only',`${source.title} rev ${source.revisionId}`)}
    }
  }
}

const hunterArtFiles = {
  table: path.join(researchRoot,'mhgu/romfs/mhgu-table/hunterArtsData.hta'),
  cn: path.join(researchRoot,'mhgu/romfs/mhgu-table/localized/hunterArtsData_chS.gmd'),
  en: path.join(researchRoot,'mhgu/romfs/mhgu-table/localized/hunterArtsData_eng.gmd'),
  jp: path.join(researchRoot,'mhgu/romfs/mhxx-table/hunterArtsData_jpn.gmd'),
}
const activityFiles = {
  table: path.join(researchRoot,'mhgu/romfs/mhgu-table/activityData.atd'),
  cn: path.join(researchRoot,'mhgu/romfs/mhgu-table/localized/activityData_chS.gmd'),
  en: path.join(researchRoot,'mhgu/romfs/mhgu-table/localized/activityData_eng.gmd'),
  jp: path.join(researchRoot,'mhgu/romfs/mhxx-table/activityData_jpn.gmd'),
}
for (const file of [...Object.values(hunterArtFiles),...Object.values(activityFiles)]) if (!fs.existsSync(file)) throw new Error(`Missing private quest source: ${file}`)
const artWiki = wikiRevision(path.join(researchRoot,'mhgu/wiki/hunter-arts-rev-917516.json'),917516)
const questWikiSpecs = [
  ['village-quests-rev-896922.json',896922],['hub-low-rev-848136.json',848136],['hub-high-rev-856112.json',856112],
  ['hub-g-rev-884067.json',884067],['gu-special-permit-rev-879101.json',879101],['gen-special-permit-rev-721306.json',721306],
]
const questWiki = questWikiSpecs.map(([file,revision])=>wikiRevision(path.join(researchRoot,'mhgu/wiki',file),revision))
const villagerWiki = wikiRevision(path.join(researchRoot,'mhgu/wiki/villager-requests-rev-890905.json'),890905)
if (!villagerWiki.content.includes('Through Thick and Fin') || !villagerWiki.content.includes('Rapid Fire Rain II')) throw new Error('Expected Hunter Art conflict is missing from the fixed Villager Requests revision')
const sources = { hunterArts:{...hunterArtFiles,wiki:artWiki},activity:activityFiles,questWiki }
fs.mkdirSync(reportRoot,{recursive:true})
const results = Object.entries(specs).map(([gameId,spec])=>buildGame(gameId,spec,sources))
const sourceFiles = [...Object.values(hunterArtFiles),...Object.values(activityFiles),...questWikiSpecs.map(([file])=>path.join(researchRoot,'mhgu/wiki',file)),path.join(researchRoot,'mhgu/wiki/hunter-arts-rev-917516.json'),path.join(researchRoot,'mhgu/wiki/villager-requests-rev-890905.json')]
const conflicts = [{
  key: 'through-thick-and-fin-hunter-art',
  questKey: 'dex:764',
  wikiClaim: 'Rapid Fire Rain II',
  acceptedHunterArtId: 93,
  acceptedNameCn: '蓄力射击Ⅱ',
  acceptedNameEn: 'Charge Shot II',
  status: 'conflict',
  resolution: 'Hunter Arts revision and native consecutive ID/GMD data agree on Charge Shot II; the Villager Requests claim is retained only in this audit.',
}]
const report = {format:'mh-save-edit-quest-catalog-build-v1',sources:Object.fromEntries(sourceFiles.map((file)=>[path.relative(researchRoot,file),fileSha256(file)])),conflicts,results}
fs.writeFileSync(path.join(reportRoot,'quest-catalog-build.json'),`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify(report,null,2))
