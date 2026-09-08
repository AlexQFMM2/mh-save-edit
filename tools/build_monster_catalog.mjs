#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { indexCsv, parseCsv } from './lib/csv.mjs'
import { loadMonsterMappings } from './lib/monsterMappings.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const installLocal = args.includes('--install-local')
const generatedRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog')
const canonicalDataRoot = path.join(generatedRoot, 'data')
const reportRoot = path.join(canonicalDataRoot, 'manifests')
const privateIconRoot = path.join(generatedRoot, 'ui-public-assets/icons')
const localIconRoot = path.join(projectRoot, 'ui/public/assets/catalog/icons')
const mappings = loadMonsterMappings(researchRoot)

const specs = {
  mh3g: { dexCandidates: ['mh3u/dex/mh3g-monster-dex-staging-v2', 'mh3u/dex/mh3g-dex'], validCount: 73, markerIds: new Set([74]), iconDigits: 2, secondary: false },
  mh4g: { dexCandidates: ['mh4g/dex/mh4g-monster-dex-staging', 'mh4g/dex/mh4g-dex'], validCount: 106, markerIds: new Set([107, 108, 109]), iconDigits: 3, secondary: true },
  mhgu: { dexCandidates: ['mhgu/dex/mhxx-dex'], validCount: 129, markerIds: new Set([130]), iconDigits: 3, secondary: true },
}

const integer = (value, fallback = null) => { const result = Number.parseInt(String(value ?? ''), 10); return Number.isFinite(result) ? result : fallback }
const decimal = (value, fallback = null) => { const result = Number(String(value ?? '')); return Number.isFinite(result) ? result : fallback }
const clean = (value) => String(value ?? '').trim()
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = (file) => sha256(fs.readFileSync(file))
const language = (row, prefix) => ({ cn: clean(row?.[`${prefix}_1`]), en: clean(row?.[`${prefix}_0`]), jp: clean(row?.[`${prefix}_3`]) })
const placeholderName = (name) => !name || /dummy|未使用|占位|环境不稳定|狂龙化|極限化|极限化|^---$/iu.test(name)

function dexRoot(spec) {
  const relative = spec.dexCandidates.find((candidate) => fs.existsSync(path.join(researchRoot, candidate, 'direct_sql')))
  if (!relative) throw new Error(`Missing monster Dex snapshot: ${spec.dexCandidates.join(' or ')}`)
  return path.join(researchRoot, relative, 'direct_sql')
}

function table(root, name, optional = false) {
  const file = path.join(root, `${name}.csv`)
  if (!fs.existsSync(file)) {
    if (optional) return []
    throw new Error(`Missing monster source table: ${file}`)
  }
  return parseCsv(file)
}

function createSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS catalog_quest_modifiers;
    DROP TABLE IF EXISTS catalog_quest_targets;
    DROP TABLE IF EXISTS catalog_quests;
    DROP TABLE IF EXISTS catalog_monster_drops;
    DROP TABLE IF EXISTS catalog_monster_traps;
    DROP TABLE IF EXISTS catalog_monster_ailments;
    DROP TABLE IF EXISTS catalog_monster_weakness;
    DROP TABLE IF EXISTS catalog_monsters;
    CREATE TABLE catalog_monsters (
      game_id TEXT NOT NULL, monster_id INTEGER NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      icon_small_path TEXT, icon_large_path TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      PRIMARY KEY(game_id, monster_id)
    );
    CREATE TABLE catalog_monster_weakness (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, monster_id INTEGER NOT NULL, part_id INTEGER NOT NULL, part_order INTEGER NOT NULL,
      part_name_cn TEXT NOT NULL, part_name_en TEXT NOT NULL, condition_cn TEXT NOT NULL, condition_en TEXT NOT NULL,
      cut INTEGER NOT NULL, impact INTEGER NOT NULL, shot INTEGER NOT NULL, fire INTEGER NOT NULL, water INTEGER NOT NULL,
      thunder INTEGER NOT NULL, ice INTEGER NOT NULL, dragon INTEGER NOT NULL, stun INTEGER NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,monster_id) REFERENCES catalog_monsters(game_id,monster_id)
    );
    CREATE TABLE catalog_monster_ailments (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, monster_id INTEGER NOT NULL, status_id INTEGER NOT NULL,
      status_name_cn TEXT NOT NULL, status_name_en TEXT NOT NULL, tolerance_initial INTEGER, tolerance_increase INTEGER,
      tolerance_max INTEGER, duration INTEGER, damage INTEGER, is_hidden INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      FOREIGN KEY(game_id,monster_id) REFERENCES catalog_monsters(game_id,monster_id)
    );
    CREATE TABLE catalog_monster_traps (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, monster_id INTEGER NOT NULL, trap_id INTEGER NOT NULL,
      trap_name_cn TEXT NOT NULL, trap_name_en TEXT NOT NULL, is_effective INTEGER NOT NULL, duration INTEGER,
      duration_enraged INTEGER, duration_fatigued INTEGER, source TEXT NOT NULL,
      FOREIGN KEY(game_id,monster_id) REFERENCES catalog_monsters(game_id,monster_id)
    );
    CREATE TABLE catalog_monster_drops (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, monster_id INTEGER NOT NULL, drop_type_id INTEGER NOT NULL,
      method_name_cn TEXT NOT NULL, method_name_en TEXT NOT NULL, item_save_id INTEGER NOT NULL, item_dex_id INTEGER NOT NULL,
      item_name_cn TEXT NOT NULL, item_name_en TEXT NOT NULL, quantity INTEGER NOT NULL, probability REAL NOT NULL,
      rank_id INTEGER NOT NULL, rank_name_cn TEXT NOT NULL, rank_name_en TEXT NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,monster_id) REFERENCES catalog_monsters(game_id,monster_id),
      FOREIGN KEY(game_id,item_save_id) REFERENCES catalog_items(game_id,save_id)
    );
    CREATE TABLE catalog_quests (
      game_id TEXT NOT NULL, quest_key TEXT NOT NULL, dex_id INTEGER, native_id TEXT, availability TEXT NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL, goal_cn TEXT NOT NULL, goal_en TEXT NOT NULL,
      sub_goal_cn TEXT NOT NULL, sub_goal_en TEXT NOT NULL, level_id INTEGER NOT NULL, level_name_cn TEXT NOT NULL,
      level_name_en TEXT NOT NULL, quest_type_id INTEGER NOT NULL, quest_type_name_cn TEXT NOT NULL, quest_type_name_en TEXT NOT NULL,
      location_id INTEGER NOT NULL, location_name_cn TEXT NOT NULL, location_name_en TEXT NOT NULL, time_minutes INTEGER,
      fee INTEGER, reward INTEGER, reward2 INTEGER, hrp INTEGER, hrp2 INTEGER, source TEXT NOT NULL,
      PRIMARY KEY(game_id, quest_key)
    );
    CREATE TABLE catalog_quest_targets (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, quest_key TEXT NOT NULL, monster_id INTEGER NOT NULL,
      slot INTEGER NOT NULL, source_kind TEXT NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key),
      FOREIGN KEY(game_id,monster_id) REFERENCES catalog_monsters(game_id,monster_id)
    );
    CREATE TABLE catalog_quest_modifiers (
      row_id INTEGER PRIMARY KEY, game_id TEXT NOT NULL, quest_key TEXT NOT NULL, marker_id INTEGER NOT NULL,
      marker_name_cn TEXT NOT NULL, slot INTEGER NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY(game_id,quest_key) REFERENCES catalog_quests(game_id,quest_key)
    );
    CREATE INDEX idx_catalog_monsters_name ON catalog_monsters(game_id,name_cn,name_en,name_jp);
    CREATE INDEX idx_catalog_monster_weakness ON catalog_monster_weakness(game_id,monster_id,part_order,row_id);
    CREATE INDEX idx_catalog_monster_ailments ON catalog_monster_ailments(game_id,monster_id,is_hidden,status_id);
    CREATE INDEX idx_catalog_monster_traps ON catalog_monster_traps(game_id,monster_id,trap_id);
    CREATE INDEX idx_catalog_monster_drops ON catalog_monster_drops(game_id,monster_id,rank_id,drop_type_id,probability);
    CREATE INDEX idx_catalog_quest_targets_monster ON catalog_quest_targets(game_id,monster_id,quest_key);
  `)
}

function normalizeNullable(value) {
  const result = integer(value)
  return result === -1 ? null : result
}

function trapEffect(gameId, value) {
  const numeric = integer(value)
  if (numeric === 1) return 1
  if ((gameId === 'mhgu' && numeric === -1) || (gameId !== 'mhgu' && numeric === 0)) return 0
  throw new Error(`${gameId}: unknown trap effectiveness ${value}`)
}

function iconKey(prefix, monsterId, digits) { return `${prefix}_${String(monsterId).padStart(digits, '0')}` }

function openSeedDatabase(gameId, tempFile) {
  const local = path.join(projectRoot, 'data', `${gameId}.sqlite`)
  const canonical = path.join(canonicalDataRoot, `${gameId}.sqlite`)
  const seed = fs.existsSync(local) ? local : canonical
  if (!fs.existsSync(seed)) throw new Error(`Missing seed database: ${seed}`)
  fs.mkdirSync(path.dirname(tempFile), { recursive: true })
  fs.copyFileSync(seed, tempFile)
  return new Database(tempFile)
}

function buildGame(gameId, spec, nativeQuestReport) {
  const root = dexRoot(spec)
  const source = `dex-monster:${path.relative(researchRoot, root).split(path.sep).join('/')}`
  const monsters = table(root, 'ID_Mon_Name')
  const parts = indexCsv(table(root, 'ID_Mon_Part'), 'Mon_Part_ID')
  const conditions = indexCsv(table(root, 'ID_Mon_PartCond'), 'Mon_Part_ID')
  const methods = indexCsv(table(root, 'ID_Mon_GetItmType'), 'Mon_GetItmType_ID')
  const ranks = indexCsv(table(root, 'ID_Rank'), 'Rank_ID')
  const questNames = indexCsv(table(root, 'ID_Qst_Name'), 'Qst_ID')
  const questGoals = indexCsv(table(root, 'ID_Qst_Goal'), 'Qst_ID')
  const questSubGoals = indexCsv(table(root, 'ID_Qst_Goal2', !spec.secondary), 'Qst_ID')
  const questLevels = indexCsv(table(root, 'ID_Qst_Lv'), 'Qst_Lv_ID')
  const questTypes = indexCsv(table(root, 'ID_Qst_Type'), 'Qst_Type_ID')
  const locations = indexCsv(table(root, 'ID_Loc_Name'), 'Loc_ID')
  const iconManifestFile = path.join(reportRoot, `${gameId}-monster-icons.json`)
  const iconManifest = JSON.parse(fs.readFileSync(iconManifestFile, 'utf8')).icons
  const validIds = new Set(monsters.map((row) => integer(row.Mon_ID)).filter((id) => id > 0 && !spec.markerIds.has(id)))
  if (validIds.size !== spec.validCount) throw new Error(`${gameId}: expected ${spec.validCount} valid monsters, received ${validIds.size}`)

  const tempFile = path.join(canonicalDataRoot, `.${gameId}.monster-build-${process.pid}.sqlite`)
  const db = openSeedDatabase(gameId, tempFile)
  db.pragma('foreign_keys = ON')
  createSchema(db)
  const itemRows = db.prepare('SELECT dex_id,save_id,name_cn,name_en FROM catalog_items WHERE game_id=? AND dex_id IS NOT NULL').all(gameId)
  const itemsByDex = new Map(itemRows.map((row) => [row.dex_id, row]))
  const insertMonster = db.prepare('INSERT INTO catalog_monsters VALUES (?,?,?,?,?,?,?,?,?)')
  const insertWeakness = db.prepare('INSERT INTO catalog_monster_weakness (game_id,monster_id,part_id,part_order,part_name_cn,part_name_en,condition_cn,condition_en,cut,impact,shot,fire,water,thunder,ice,dragon,stun,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertAilment = db.prepare('INSERT INTO catalog_monster_ailments (game_id,monster_id,status_id,status_name_cn,status_name_en,tolerance_initial,tolerance_increase,tolerance_max,duration,damage,is_hidden,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertTrap = db.prepare('INSERT INTO catalog_monster_traps (game_id,monster_id,trap_id,trap_name_cn,trap_name_en,is_effective,duration,duration_enraged,duration_fatigued,source) VALUES (?,?,?,?,?,?,?,?,?,?)')
  const insertDrop = db.prepare('INSERT INTO catalog_monster_drops (game_id,monster_id,drop_type_id,method_name_cn,method_name_en,item_save_id,item_dex_id,item_name_cn,item_name_en,quantity,probability,rank_id,rank_name_cn,rank_name_en,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertQuest = db.prepare('INSERT INTO catalog_quests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertTarget = db.prepare('INSERT INTO catalog_quest_targets (game_id,quest_key,monster_id,slot,source_kind,source) VALUES (?,?,?,?,?,?)')
  const insertModifier = db.prepare('INSERT INTO catalog_quest_modifiers (game_id,quest_key,marker_id,marker_name_cn,slot,source) VALUES (?,?,?,?,?,?)')

  const transaction = db.transaction(() => {
    for (const row of monsters) {
      const monsterId = integer(row.Mon_ID)
      if (monsterId <= 0) continue
      const name = language(row, 'Mon_Name')
      const small = iconManifest[iconKey('Mon_S', monsterId, spec.iconDigits)] ?? null
      const large = iconManifest[iconKey('Mon_B', monsterId, spec.iconDigits)] ?? null
      const isPlaceholder = spec.markerIds.has(monsterId) || placeholderName(name.cn || name.en)
      insertMonster.run(gameId, monsterId, name.cn, name.en, name.jp, small, large, isPlaceholder ? 1 : 0, source)
    }
    for (const row of table(root, 'DB_Mon_Weak')) {
      const monsterId = integer(row.Mon_ID); if (!validIds.has(monsterId)) continue
      const partId = integer(row.MonPart_ID); const part = language(parts.get(partId), 'Mon_Part'); const condition = language(conditions.get(partId), 'Mon_PartCond')
      insertWeakness.run(gameId, monsterId, partId, integer(row.MonPart_Num, 0), part.cn, part.en, condition.cn, condition.en, integer(row.Cut, 0), integer(row.Impact, 0), integer(row.Shot, 0), integer(row.Fir, 0), integer(row.Wtr, 0), integer(row.Thd, 0), integer(row.Ice, 0), integer(row.Drg, 0), integer(row.Diz, 0), source)
    }
    for (const row of table(root, 'DB_Mon_Ail')) {
      const monsterId = integer(row.Mon_ID); if (!validIds.has(monsterId)) continue
      const statusId = integer(row.Stat_ID); const mapped = mappings.statusNames.get(statusId); const hidden = mappings.hiddenStatusIds.has(statusId)
      if (!mapped && !hidden) throw new Error(`${gameId}: unknown status ${statusId}`)
      const statusName = typeof mapped === 'string' ? mapped : mapped?.cn ?? (statusId === 12 ? '隐藏状态' : `状态 ${statusId}`)
      const statusNameEn = typeof mapped === 'object' ? mapped.en ?? '' : ''
      insertAilment.run(gameId, monsterId, statusId, statusName, statusNameEn, normalizeNullable(row.TolInitial), normalizeNullable(row.TolIncrease), normalizeNullable(row.TolMax), normalizeNullable(row.Duration), normalizeNullable(row.Damage), hidden ? 1 : 0, source)
    }
    for (const row of table(root, 'DB_Mon_Trap')) {
      const monsterId = integer(row.Mon_ID); if (!validIds.has(monsterId)) continue
      const trapId = integer(row.Trap_ID); const mapped = mappings.trapNames.get(trapId); if (!mapped) throw new Error(`${gameId}: unknown trap ${trapId}`)
      const name = typeof mapped === 'string' ? mapped : mapped.cn; const en = typeof mapped === 'object' ? mapped.en ?? '' : ''
      insertTrap.run(gameId, monsterId, trapId, name, en, trapEffect(gameId, row.IsEffect), normalizeNullable(row.Duration), normalizeNullable(row.DurationEnraged), normalizeNullable(row.DurationFatigued), source)
    }
    for (const row of table(root, 'DB_ItmtoMon')) {
      const monsterId = integer(row.Mon_ID); const itemDexId = integer(row.Itm_ID)
      if (!validIds.has(monsterId) || itemDexId <= 0) continue
      const item = itemsByDex.get(itemDexId); if (!item) throw new Error(`${gameId}: monster drop item ${itemDexId} is not mapped`)
      const methodId = integer(row.Mon_GetItmType_ID); const method = language(methods.get(methodId), 'Mon_GetItmType')
      const rankId = integer(row.Rank_ID); const rank = language(ranks.get(rankId), 'Rank')
      insertDrop.run(gameId, monsterId, methodId, method.cn, method.en, item.save_id, itemDexId, item.name_cn, item.name_en, integer(row.Qty, 0), decimal(row.Pct, 0), rankId, rank.cn, rank.en, source)
    }
    for (const row of table(root, 'DB_Qst')) {
      const dexId = integer(row.Qst_ID); const questKey = `dex:${dexId}`
      const name = language(questNames.get(dexId), 'Qst_Name'); const goal = language(questGoals.get(dexId), 'Qst_Goal'); const subGoal = language(questSubGoals.get(dexId), 'Qst_Goal2')
      const levelId = integer(row.Qst_Lv_ID); const level = language(questLevels.get(levelId), 'Qst_Lv')
      const typeId = integer(row.Qst_Type_ID); const type = language(questTypes.get(typeId), 'Qst_Type')
      const locationId = integer(row.Loc_ID); const location = language(locations.get(locationId), 'Loc_Name')
      insertQuest.run(gameId, questKey, dexId, null, 'common', name.cn, name.en, name.jp, goal.cn, goal.en, subGoal.cn, subGoal.en, levelId, level.cn, level.en, typeId, type.cn, type.en, locationId, location.cn, location.en, integer(row.Time), integer(row.Fee), integer(row.Reward), integer(row.Reward2), integer(row.HRP), integer(row.HRP2), source)
      for (let slot = 1; slot <= 8; slot += 1) {
        const monsterId = integer(row[`Mon${slot}_ID`])
        if (validIds.has(monsterId)) insertTarget.run(gameId, questKey, monsterId, slot, 'dex-slot', source)
        else if (spec.markerIds.has(monsterId)) {
          const markerName = language(monsters.find((candidate) => integer(candidate.Mon_ID) === monsterId), 'Mon_Name').cn
          insertModifier.run(gameId, questKey, monsterId, markerName, slot, source)
        }
      }
    }
    if (gameId === 'mhgu') for (const task of nativeQuestReport.tasks.filter((entry) => entry.availability === 'mhgu')) {
      const questKey = task.nativeQuestId
      const level = language(questLevels.get(task.levelId), 'Qst_Lv'); const type = language(questTypes.get(task.typeId), 'Qst_Type'); const location = language(locations.get(task.locationId), 'Loc_Name')
      insertQuest.run(gameId, questKey, null, task.nativeFile.replace(/\.arc$/u, ''), 'mhgu', task.titleCn, '', '', task.goalCn, '', task.subGoalCn, '', task.levelId, level.cn, level.en, task.typeId, type.cn, type.en, task.locationId, location.cn, location.en, task.timeMinutes, task.fee, task.reward, task.reward2, task.hrp, task.hrp2, 'mhgu-native-quest-audit-v1')
      const targets = [...task.largeMonsterIds, ...task.smallMonsterIds]
      targets.forEach((monsterId, index) => insertTarget.run(gameId, questKey, monsterId, index + 1, index < task.largeMonsterIds.length ? 'native-large-slot' : 'gmd-appearing', 'mhgu-native-quest-audit-v1'))
    }
  })
  transaction()

  const foreignKeyErrors = db.pragma('foreign_key_check')
  if (foreignKeyErrors.length) throw new Error(`${gameId}: foreign_key_check failed`)
  const catalogTables = ['catalog_monsters','catalog_monster_weakness','catalog_monster_ailments','catalog_monster_traps','catalog_monster_drops','catalog_quests','catalog_quest_targets','catalog_quest_modifiers']
  const counts = Object.fromEntries(catalogTables.map((name) => [name, db.prepare(`SELECT count(*) count FROM ${name} WHERE game_id=?`).get(gameId).count]))
  if (counts.catalog_monsters - spec.markerIds.size !== spec.validCount) throw new Error(`${gameId}: installed monster count mismatch`)
  if (gameId === 'mhgu' && db.prepare("SELECT count(*) count FROM catalog_quests WHERE game_id=? AND availability='mhgu'").get(gameId).count !== 49) throw new Error('mhgu: exclusive quest count mismatch')
  const contentSha256 = sha256(JSON.stringify(catalogTables.map((name) => [name, db.prepare(`SELECT * FROM ${name} WHERE game_id=? ORDER BY rowid`).all(gameId)])))
  db.close()
  const canonical = path.join(canonicalDataRoot, `${gameId}.sqlite`)
  fs.renameSync(tempFile, canonical)
  if (installLocal) fs.copyFileSync(canonical, path.join(projectRoot, 'data', `${gameId}.sqlite`))

  const usedIcons = new Set()
  const installed = new Database(canonical, { readonly: true })
  for (const row of installed.prepare('SELECT icon_small_path,icon_large_path FROM catalog_monsters WHERE game_id=?').all(gameId)) for (const icon of [row.icon_small_path, row.icon_large_path]) if (icon) usedIcons.add(path.basename(icon))
  installed.close()
  if (installLocal) {
    fs.mkdirSync(localIconRoot, { recursive: true })
    for (const filename of usedIcons) fs.copyFileSync(path.join(privateIconRoot, filename), path.join(localIconRoot, filename))
  }
  return { gameId, counts, contentSha256, icons: usedIcons.size, installedLocal: installLocal, source }
}

const preflight = spawnSync(process.execPath, [path.join(projectRoot, 'tools/audit_monster_catalog.mjs'), '--research-root', researchRoot], { cwd: projectRoot, encoding: 'utf8' })
if (preflight.status !== 0) {
  process.stderr.write(preflight.stderr || preflight.stdout)
  process.exit(preflight.status ?? 1)
}
const nativeQuestReport = JSON.parse(fs.readFileSync(path.join(reportRoot, 'mhgu-native-quest-crosswalk.json'), 'utf8'))
fs.mkdirSync(canonicalDataRoot, { recursive: true })
const results = Object.entries(specs).map(([gameId, spec]) => buildGame(gameId, spec, nativeQuestReport))
const report = { format: 'mh-save-edit-monster-catalog-build-v1', results }
fs.writeFileSync(path.join(reportRoot, 'monster-catalog-build.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
