#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { migrateArmorSkillIds } from './runtime/armorSkillMigration.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const specs = {
  mh3g: { database: 'data/mh3g.sqlite', dex: 'mh3u/dex/mh3g-dex', count: 1651, groups: 353, pairs: 170, universal: 13, complete: 312 },
  mh4g: { database: 'data/mh4g.sqlite', dex: 'mh4g/dex/mh4g-dex', count: 3119, groups: 675, pairs: 319, universal: 37, complete: 592 },
  mhgu: { database: 'data/mhgu.sqlite', dex: 'mhgu/dex/mhxx-dex', count: 5726, groups: 1260, pairs: 600, universal: 60, complete: 1053 },
}
const parts = new Map([[1, 'head'], [2, 'chest'], [3, 'arms'], [4, 'waist'], [5, 'legs']])
const saveTypesByPart = new Map([[1, 5], [2, 1], [3, 2], [4, 3], [5, 4]])

function parseCsv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const records = []; let row = [], field = '', quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') { if (quoted && input[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted }
    else if (character === ',' && !quoted) { row.push(field); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && input[index + 1] === '\n') index += 1; row.push(field); if (row.some(Boolean)) records.push(row); row = []; field = '' }
    else field += character
  }
  if (field || row.length) { row.push(field); records.push(row) }
  const headers = records.shift() ?? []
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const integer = (value, fallback = null) => { const parsed = Number.parseInt(String(value ?? ''), 10); return Number.isFinite(parsed) ? parsed : fallback }
const clean = (value) => String(value ?? '').trim()
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = (file) => sha256(fs.readFileSync(file))
const placeholder = (name) => !name || /dummy|未使用|无装备|^无$|^---$/iu.test(name)
const dexFile = (spec, name) => path.join(researchRoot, spec.dex, 'direct_sql', name)

function verifySnapshot(spec) {
  const root = path.join(researchRoot, spec.dex)
  const manifestFile = path.join(root, 'source-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  for (const entry of manifest.files ?? []) {
    const file = path.join(root, entry.path)
    if (!fs.existsSync(file) || fs.statSync(file).size !== entry.size || fileSha256(file) !== entry.sha256) throw new Error(`Dex snapshot mismatch: ${file}`)
  }
  return { sourcePath: manifest.sourcePath, generatedAtUtc: manifest.generatedAtUtc, fileCount: manifest.files?.length ?? 0 }
}

function names(spec, file, id, prefix) {
  return new Map(parseCsv(dexFile(spec, file)).map((row) => [integer(row[id]), { cn: clean(row[`${prefix}_1`]), en: clean(row[`${prefix}_0`]), jp: clean(row[`${prefix}_3`]) }]))
}

function commonName(values) {
  const names = values.filter(Boolean)
  if (!names.length) return ''
  let prefix = [...names[0]]
  for (const name of names.slice(1)) { const chars = [...name]; let index = 0; while (index < prefix.length && prefix[index] === chars[index]) index += 1; prefix = prefix.slice(0, index) }
  const result = prefix.join('').replace(/[・【〔［（(\-\s]+$/u, '').trim()
  return result.length >= 2 ? result : names[0]
}

function groupSeries(rows) {
  const groups = []; let current = []; let previousPart = 0; let image = ''
  for (const row of rows) {
    const part = integer(row.Part, 0); const nextImage = clean(row.Amr_ImgFile)
    if (current.length && (part <= previousPart || nextImage !== image)) { groups.push(current); current = [] }
    current.push(row); previousPart = part; image = nextImage
  }
  if (current.length) groups.push(current)
  return groups
}

function groupCombat(group) {
  if (group[0]._combatOverride) return group[0]._combatOverride
  const values = new Set(group.map((row) => integer(row.BorG, 0)).filter((value) => value === 1 || value === 2))
  if (values.size > 1) throw new Error(`Mixed armor combat group at ${group[0].Amr_ID}`)
  if (values.has(1)) return 'blademaster'
  if (values.has(2)) return 'gunner'
  const imageCombat = integer(group[0].Amr_ImgFileBorG, 0)
  return imageCombat === 1 ? 'blademaster' : imageCombat === 2 ? 'gunner' : 'both'
}

function createSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS catalog_armor_set_members; DROP TABLE IF EXISTS catalog_armor_sets;
    DROP TABLE IF EXISTS catalog_armor_materials; DROP TABLE IF EXISTS catalog_armor_skills;
    DROP TABLE IF EXISTS catalog_armor_save_identities; DROP TABLE IF EXISTS catalog_armors;
    CREATE TABLE catalog_armors (
      game_id TEXT NOT NULL,dex_id INTEGER NOT NULL,name_cn TEXT NOT NULL,name_en TEXT NOT NULL,name_jp TEXT NOT NULL,
      part TEXT NOT NULL,part_order INTEGER NOT NULL,combat TEXT NOT NULL,gender TEXT NOT NULL,rarity INTEGER NOT NULL,slots INTEGER NOT NULL,
      base_defense INTEGER NOT NULL,max_defense INTEGER NOT NULL,fire_res INTEGER NOT NULL,water_res INTEGER NOT NULL,thunder_res INTEGER NOT NULL,ice_res INTEGER NOT NULL,dragon_res INTEGER NOT NULL,
      price INTEGER,icon_path TEXT,is_placeholder INTEGER NOT NULL,mapping_status TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(game_id,dex_id));
    CREATE TABLE catalog_armor_save_identities (game_id TEXT NOT NULL,armor_dex_id INTEGER NOT NULL,save_type INTEGER NOT NULL,save_id INTEGER NOT NULL,mapping_status TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(game_id,armor_dex_id,save_type,save_id));
    CREATE TABLE catalog_armor_skills (game_id TEXT NOT NULL,armor_dex_id INTEGER NOT NULL,skill_id INTEGER NOT NULL,name_cn TEXT NOT NULL,name_en TEXT NOT NULL,points INTEGER NOT NULL,active_skill_name_cn TEXT,active_skill_name_en TEXT,source TEXT NOT NULL,PRIMARY KEY(game_id,armor_dex_id,skill_id));
    CREATE TABLE catalog_armor_materials (row_id INTEGER PRIMARY KEY,game_id TEXT NOT NULL,armor_dex_id INTEGER NOT NULL,item_save_id INTEGER NOT NULL,item_dex_id INTEGER NOT NULL,quantity INTEGER NOT NULL,source TEXT NOT NULL);
    CREATE TABLE catalog_armor_sets (game_id TEXT NOT NULL,set_key TEXT NOT NULL,sort_order INTEGER NOT NULL,blademaster_name_cn TEXT NOT NULL,gunner_name_cn TEXT NOT NULL,rarity INTEGER NOT NULL,total_slots INTEGER NOT NULL,total_base_defense INTEGER NOT NULL,total_max_defense INTEGER NOT NULL,content_variant TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(game_id,set_key));
    CREATE TABLE catalog_armor_set_members (game_id TEXT NOT NULL,set_key TEXT NOT NULL,combat_row TEXT NOT NULL,part TEXT NOT NULL,part_order INTEGER NOT NULL,armor_dex_id INTEGER NOT NULL,source TEXT NOT NULL,PRIMARY KEY(game_id,set_key,combat_row,part));
    CREATE INDEX idx_catalog_armors_filter ON catalog_armors(game_id,part,combat,gender,rarity,slots);
    CREATE INDEX idx_catalog_armor_skills_filter ON catalog_armor_skills(game_id,skill_id,points);
    CREATE INDEX idx_catalog_armor_sets_order ON catalog_armor_sets(game_id,sort_order);
  `)
}

function rawSaveIdentities(db, gameId, armorRows, armorNames) {
  const result = new Map()
  const add = (dexId, identity) => result.set(dexId, [...(result.get(dexId) ?? []), identity])
  if (gameId === 'mh3g') {
    for (const row of db.prepare('SELECT dex_id,save_type,save_id,mapping_status,mapping_source FROM armors WHERE dex_id IS NOT NULL AND save_type IS NOT NULL').all()) add(row.dex_id, { saveType: row.save_type, saveId: row.save_id, status: row.mapping_status, source: row.mapping_source })
    return result
  }
  if (gameId === 'mh4g') {
    const byName = new Map()
    for (const row of db.prepare('SELECT * FROM armors WHERE is_relic=0 AND save_id>0').all()) byName.set(`${row.save_type}:${row.name_cn}`, [...(byName.get(`${row.save_type}:${row.name_cn}`) ?? []), row])
    for (const armor of armorRows) {
      const dexId = integer(armor.Amr_ID); const part = integer(armor.Part); const name = armorNames.get(dexId)?.cn
      const candidates = byName.get(`${saveTypesByPart.get(part)}:${name}`) ?? []
      const exact = candidates.find((row) => row.rarity === integer(armor.Rare) && row.base_defense === integer(armor.Def)) ?? candidates[0]
      if (exact) add(dexId, { saveType: exact.save_type, saveId: exact.save_id, status: 'confirmed_name_stats', source: exact.source })
    }
    return result
  }
  const tableByPart = new Map([[1, 'cn__armor_head'], [2, 'cn__armor_chest'], [3, 'cn__armor_arms'], [4, 'cn__armor_waist'], [5, 'cn__armor_legs']])
  for (const [part, table] of tableByPart) {
    const byName = new Map(db.prepare(`SELECT id,name FROM ${table} WHERE id>0`).all().map((row) => [row.name, row.id]))
    for (const armor of armorRows.filter((row) => integer(row.Part) === part)) {
      const dexId = integer(armor.Amr_ID); const saveId = byName.get(armorNames.get(dexId)?.cn)
      if (saveId != null) add(dexId, { saveType: part, saveId, status: 'confirmed_name_part', source: 'mhxx-native-array+dex' })
    }
  }
  return result
}

function buildGame(gameId, spec) {
  const snapshot = verifySnapshot(spec)
  let nativeSeries = null
  if (gameId === 'mhgu') {
    const nativeFiles = ['mhgu', 'mhxx'].map((variant) => {
      const file = path.join(researchRoot, `mhgu/romfs/${variant}-table/armorSeriesData.asd`)
      const buffer = fs.readFileSync(file)
      const recordCount = (buffer.length - 8) / 127
      if (!Number.isInteger(recordCount) || recordCount !== 1287) throw new Error(`${variant}: invalid armorSeriesData.asd size`)
      const combat = { blademaster: 0, gunner: 0, both: 0, empty: 0 }
      for (let index = 0; index < recordCount; index += 1) {
        const offset = 8 + index * 127; const blade = Boolean(buffer[offset + 15]); const gunner = Boolean(buffer[offset + 16])
        combat[blade && gunner ? 'both' : blade ? 'blademaster' : gunner ? 'gunner' : 'empty'] += 1
      }
      return { variant, path: path.relative(researchRoot, file), size: buffer.length, sha256: fileSha256(file), recordCount, combat }
    })
    nativeSeries = { sameContent: nativeFiles[0].sha256 === nativeFiles[1].sha256, files: nativeFiles }
  }
  const db = new Database(path.join(projectRoot, spec.database))
  const armorRows = parseCsv(dexFile(spec, 'DB_Amr.csv')).sort((a, b) => integer(a.Amr_ID) - integer(b.Amr_ID))
  if (gameId === 'mhgu') {
    const overrides = new Map([[589, 'blademaster'], [590, 'gunner'], [1997, 'blademaster'], [1998, 'gunner'], [5468, 'blademaster'], [5469, 'gunner']])
    for (const row of armorRows) if (overrides.has(integer(row.Amr_ID))) row._combatOverride = overrides.get(integer(row.Amr_ID))
  }
  const armorGroups = groupSeries(armorRows)
  const combatByDex = new Map(armorGroups.flatMap((group) => group.map((row) => [integer(row.Amr_ID), groupCombat(group)])))
  if (armorRows.length !== spec.count) throw new Error(`${gameId}: expected ${spec.count} armors, received ${armorRows.length}`)
  const armorNames = names(spec, 'ID_Amr_Name.csv', 'Amr_ID', 'Amr_Name')
  const skillNames = names(spec, 'ID_SklTree_Name.csv', 'SklTree_ID', 'SklTree_Name')
  const activeNames = names(spec, 'ID_Skl_Name.csv', 'Skl_ID', 'Skl_Name')
  const activeByExact = new Map(parseCsv(dexFile(spec, 'DB_Skl.csv')).map((row) => [`${row.SklTree_ID}:${row.Pt}`, activeNames.get(integer(row.Skl_ID))]))
  const skillRows = parseCsv(dexFile(spec, 'DB_SklTreetoAmr.csv'))
  const skillCrosswalk = new Map()
  for (const row of db.prepare('SELECT dex_id,skill_id FROM catalog_skills WHERE game_id=? AND dex_id IS NOT NULL').all(gameId)) {
    if (skillCrosswalk.has(row.dex_id)) throw new Error(`${gameId}: Dex 技能系 ${row.dex_id} 存在重复 crosswalk`)
    skillCrosswalk.set(row.dex_id, row.skill_id)
  }
  const materialRows = parseCsv(dexFile(spec, 'DB_ItmtoAmr.csv'))
  const itemByDex = new Map(db.prepare('SELECT dex_id,save_id FROM catalog_items WHERE game_id=? AND dex_id IS NOT NULL').all(gameId).map((row) => [row.dex_id, row.save_id]))
  const saveIdentities = rawSaveIdentities(db, gameId, armorRows, armorNames)
  let iconMap = {}
  const iconFile = [
    path.join(projectRoot, `data/manifests/${gameId}-armor-icons.json`),
    path.join(researchRoot, `generated/mh-save-edit/catalog/data/manifests/${gameId}-armor-icons.json`),
  ].find((candidate) => fs.existsSync(candidate))
  if (iconFile) { const parsed = JSON.parse(fs.readFileSync(iconFile, 'utf8')); iconMap = parsed.icons ?? parsed.entries ?? parsed }
  createSchema(db)
  const insertArmor = db.prepare('INSERT INTO catalog_armors VALUES (@game_id,@dex_id,@name_cn,@name_en,@name_jp,@part,@part_order,@combat,@gender,@rarity,@slots,@base_defense,@max_defense,@fire_res,@water_res,@thunder_res,@ice_res,@dragon_res,@price,@icon_path,@is_placeholder,@mapping_status,@source)')
  const insertSave = db.prepare('INSERT INTO catalog_armor_save_identities VALUES (?,?,?,?,?,?)')
  const insertSkill = db.prepare('INSERT INTO catalog_armor_skills VALUES (?,?,?,?,?,?,?,?,?)')
  const insertMaterial = db.prepare('INSERT INTO catalog_armor_materials VALUES (NULL,?,?,?,?,?,?)')
  const insertSet = db.prepare('INSERT INTO catalog_armor_sets VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  const insertMember = db.prepare('INSERT INTO catalog_armor_set_members VALUES (?,?,?,?,?,?,?)')
  const source = `dex:${snapshot.generatedAtUtc ?? 'fixed'}+catalog-v1`
  const transaction = db.transaction(() => {
    for (const row of armorRows) {
      const dexId = integer(row.Amr_ID); const name = armorNames.get(dexId) ?? { cn: '', en: '', jp: '' }; const partOrder = integer(row.Part); const rarity = integer(row.Rare, 0)
      insertArmor.run({ game_id: gameId, dex_id: dexId, name_cn: name.cn, name_en: name.en, name_jp: name.jp, part: parts.get(partOrder), part_order: partOrder, combat: combatByDex.get(dexId) ?? 'both', gender: integer(row.MorF) === 1 ? 'male' : integer(row.MorF) === 2 ? 'female' : 'both', rarity, slots: integer(row.Slot, 0), base_defense: integer(row.Def, 0), max_defense: integer(row.MaxDef, 0), fire_res: integer(row.Res_Fire, 0), water_res: integer(row.Res_Water, 0), thunder_res: integer(row.Res_Thunder, 0), ice_res: integer(row.Res_Ice, 0), dragon_res: integer(row.Res_Dragon, 0), price: integer(row.Price), icon_path: iconMap[`Amr_${String(partOrder).padStart(2, '0')}${String(rarity).padStart(2, '0')}`] ?? null, is_placeholder: placeholder(name.cn || name.en) ? 1 : 0, mapping_status: saveIdentities.has(dexId) ? 'confirmed' : 'dex_only', source })
      for (const identity of saveIdentities.get(dexId) ?? []) insertSave.run(gameId, dexId, identity.saveType, identity.saveId, identity.status, identity.source ?? source)
    }
    for (const row of skillRows) {
      const dexId = integer(row.Amr_ID); const dexSkillId = integer(row.SklTree_ID); const skillId = skillCrosswalk.get(dexSkillId); if (skillId == null) throw new Error(`${gameId}: 防具 ${dexId} 的 Dex 技能系 ${dexSkillId} 缺少 crosswalk`); const point = integer(row.Pt, 0); const skill = db.prepare('SELECT name_cn cn,name_en en FROM catalog_skills WHERE game_id=? AND skill_id=?').get(gameId, skillId); const name = skill ?? skillNames.get(dexSkillId) ?? { cn: `技能 ${skillId}`, en: '', jp: '' }; const active = activeByExact.get(`${dexSkillId}:${point}`)
      insertSkill.run(gameId, dexId, skillId, name.cn, name.en, point, active?.cn ?? null, active?.en ?? null, source)
    }
    for (const row of materialRows) {
      const itemDexId = integer(row.Itm_ID); const itemSaveId = itemByDex.get(itemDexId)
      if (itemSaveId != null) insertMaterial.run(gameId, integer(row.Amr_ID), itemSaveId, itemDexId, integer(row.Qty, 0), source)
    }
    const groups = armorGroups
    if (groups.length !== spec.groups) throw new Error(`${gameId}: expected ${spec.groups} armor groups, received ${groups.length}`)
    const complete = groups.filter((group) => new Set(group.map((row) => row.Part)).size === 5).length
    if (complete !== spec.complete) throw new Error(`${gameId}: expected ${spec.complete} complete groups, received ${complete}`)
    const sets = []; let pairs = 0; let universal = 0
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index]; const combat = groupCombat(group)
      if (combat === 'both') { sets.push({ blade: group, gunner: group }); universal += 1; continue }
      const next = groups[index + 1]; const nextCombat = next ? groupCombat(next) : null
      if (!next || nextCombat === combat || nextCombat === 'both') throw new Error(`${gameId}: unpaired armor group at Dex ${group[0].Amr_ID}`)
      sets.push(combat === 'blademaster' ? { blade: group, gunner: next } : { blade: next, gunner: group }); pairs += 1; index += 1
    }
    if (pairs !== spec.pairs || universal !== spec.universal) throw new Error(`${gameId}: expected ${spec.pairs}/${spec.universal} paired/universal groups, received ${pairs}/${universal}`)
    sets.forEach((set, index) => {
      const unique = new Map([...set.blade, ...set.gunner].map((row) => [row.Amr_ID, row])); const values = [...unique.values()]
      const setTotal = (field) => Math.max(set.blade.reduce((sum, row) => sum + integer(row[field], 0), 0), set.gunner.reduce((sum, row) => sum + integer(row[field], 0), 0))
      const bladeName = commonName(set.blade.map((row) => armorNames.get(integer(row.Amr_ID))?.cn)); const gunnerName = commonName(set.gunner.map((row) => armorNames.get(integer(row.Amr_ID))?.cn))
      const setKey = `set:${String(index + 1).padStart(4, '0')}`
      insertSet.run(gameId, setKey, index + 1, bladeName, gunnerName === bladeName ? '' : gunnerName, Math.max(...values.map((row) => integer(row.Rare, 0))), setTotal('Slot'), setTotal('Def'), setTotal('MaxDef'), gameId === 'mhgu' ? 'mhgu-mhxx-audited' : gameId, source)
      for (const [combatRow, group] of [['blademaster', set.blade], ['gunner', set.gunner]]) for (const row of group) insertMember.run(gameId, setKey, combatRow, parts.get(integer(row.Part)), integer(row.Part), integer(row.Amr_ID), source)
    })
  })
  transaction()
  migrateArmorSkillIds(db, gameId)
  const missingMaterials = materialRows.filter((row) => !itemByDex.has(integer(row.Itm_ID))).length
  const iconStats = db.prepare('SELECT count(*) total, sum(icon_path IS NOT NULL) mapped, sum(is_placeholder=0 AND icon_path IS NULL) missing FROM catalog_armors WHERE game_id=?').get(gameId)
  const audit = { gameId, armorCount: armorRows.length, rawSeriesCount: spec.groups, pairedSeriesCount: spec.pairs, universalSeriesCount: spec.universal, displayedSetCount: spec.pairs + spec.universal, completeSeriesCount: spec.complete, relicArmorCount: 0, saveIdentityCount: db.prepare('SELECT count(*) count FROM catalog_armor_save_identities WHERE game_id=?').get(gameId).count, materialCount: db.prepare('SELECT count(*) count FROM catalog_armor_materials WHERE game_id=?').get(gameId).count, missingMaterialMappings: missingMaterials, iconStats, nativeSeries, combatOverrides: gameId === 'mhgu' ? [589, 590, 1997, 1998, 5468, 5469] : [], source: snapshot }
  const manifestDir = path.join(projectRoot, 'data/manifests'); fs.mkdirSync(manifestDir, { recursive: true })
  fs.writeFileSync(path.join(manifestDir, `${gameId}-armors-audit.json`), `${JSON.stringify(audit, null, 2)}\n`)
  db.close(); return audit
}

const results = Object.entries(specs).map(([gameId, spec]) => buildGame(gameId, spec))
console.log(JSON.stringify(results, null, 2))
