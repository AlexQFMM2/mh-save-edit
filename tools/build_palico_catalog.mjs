#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const installLocal = args.includes('--install-local')
const dexRoot = path.join(researchRoot, 'mhgu/dex/mhxx-dex/direct_sql')
const palicoRoot = path.join(researchRoot, 'mhgu/palico')
const residentRoot = path.join(palicoRoot, 'native/resident')
const nativeRoot = path.join(researchRoot, 'mhgu/romfs/mhgu-table')
const nativeXxRoot = path.join(researchRoot, 'mhgu/romfs/mhxx-table')
const generatedRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const manifestRoot = path.join(generatedRoot, 'manifests')
const dbFile = path.join(generatedRoot, 'mhgu.sqlite')
const gameDataFile = path.join(researchRoot, 'mhgu/reference-editors/Cotto-MHGU-Editor-source/core/game_data.json')

const required = [
  'DB_PeliWpn.csv', 'DB_PeliAmr.csv', 'DB_ItmtoPeliWpn.csv', 'DB_ItmtoPeliAmr.csv',
  'ID_PeliWpn_Name.csv', 'ID_PeliAmr_Name.csv', 'ID_PeliWpn_Type.csv', 'ID_Wpn_SpAtk.csv',
].map(name => path.join(dexRoot, name)).concat([
  gameDataFile,
  path.join(palicoRoot, 'reference/palico_support_moves_en.csv'),
  path.join(palicoRoot, 'reference/palico_skills_en.csv'),
  path.join(palicoRoot, 'reference/palico_cn_translation.json'),
  path.join(palicoRoot, 'reference/support_move_unlock_crosswalk.json'),
  path.join(residentRoot, 'spt_act_base.sab'),
  path.join(residentRoot, 'ot_skl.oskl'),
  path.join(palicoRoot, 'localization/chS/spt_act_base_chS.gmd'),
  path.join(palicoRoot, 'localization/eng/spt_act_base_eng.gmd'),
  path.join(palicoRoot, 'localization/jpn/spt_act_base_jpn.gmd'),
  path.join(palicoRoot, 'wiki/support-moves.html'),
  path.join(palicoRoot, 'localization/chS/ot_skl_chS.gmd'),
  path.join(palicoRoot, 'localization/chS/otWeaponData_chS.gmd'),
  path.join(palicoRoot, 'localization/chS/otArmorData_chS.gmd'),
  path.join(palicoRoot, 'localization/chS/OtInfoMsg_chS.gmd'),
  path.join(palicoRoot, 'localization/eng/ot_skl_eng.gmd'),
  path.join(palicoRoot, 'localization/eng/otWeaponData_eng.gmd'),
  path.join(palicoRoot, 'localization/eng/otArmorData_eng.gmd'),
  path.join(palicoRoot, 'localization/eng/OtInfoMsg_eng.gmd'),
  path.join(researchRoot, 'mhgu/romfs/mhxx-table/ot_skl_jpn.gmd'),
  path.join(researchRoot, 'mhgu/romfs/mhxx-table/OtInfoMsg_jpn.gmd'),
  path.join(researchRoot, 'mhgu/romfs/mhxx-table/otWeaponData_jpn.gmd'),
  path.join(researchRoot, 'mhgu/romfs/mhxx-table/otArmorData_jpn.gmd'),
  path.join(manifestRoot, 'mhgu-weapon-icons.json'), path.join(manifestRoot, 'mhgu-armor-icons.json'),
  path.join(nativeRoot, 'otWeaponData.owp'), path.join(nativeRoot, 'otArmorData.oar'),
  path.join(nativeRoot, 'otWeaponCreate.oec'), path.join(nativeRoot, 'otArmorCreate.oec'),
  path.join(nativeRoot, 'catSkillData.cskd'),
  ...['Support', 'Skill'].flatMap(kind => [1, 2, 3].flatMap(tier => [
    path.join(nativeRoot, `lobby/ot${kind}Ini${tier}pt.otil`),
    path.join(nativeXxRoot, `lobby/ot${kind}Ini${tier}pt.otil`),
  ])),
])
for (const file of required) if (!fs.existsSync(file)) throw new Error(`缺少猎猫图鉴输入：${file}`)
if (!fs.existsSync(path.join(residentRoot, 'source-manifest.json'))) throw new Error('缺少 resident ARC 提取来源 manifest')
if (!fs.existsSync(dbFile)) throw new Error(`缺少 MHGU 基础图鉴数据库：${dbFile}`)

const clean = value => String(value ?? '').replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n').trim()
const integer = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
const normalize = value => clean(value).normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]+/gu, '')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = file => sha256(fs.readFileSync(file))
const PALICO_TABLE_ORDER = {
  catalog_palico_types: 'type_id',
  catalog_palico_support_moves: 'support_move_id',
  catalog_palico_type_support_moves: 'type_id,support_move_id',
  catalog_palico_support_move_unlocks: 'support_move_id,unlock_key',
  catalog_palico_skills: 'palico_skill_id',
  catalog_palico_type_skills: 'type_id,palico_skill_id',
  catalog_palico_skill_unlocks: 'palico_skill_id,unlock_key',
  catalog_palico_weapons: 'equipment_id',
  catalog_palico_weapon_materials: 'equipment_id,row_id',
  catalog_palico_armors: 'equipment_id',
  catalog_palico_armor_materials: 'equipment_id,row_id',
  catalog_palico_sources: 'source_key',
}

function csv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) { row.push(field); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      row.push(field); if (row.some(value => value !== '')) rows.push(row); row = []; field = ''
    } else field += character
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function gmdValues(file) {
  const data = fs.readFileSync(file)
  if (data.length < 40 || data.subarray(0, 3).toString('ascii') !== 'GMD') throw new Error(`无效 GMD：${file}`)
  const count = data.readUInt32LE(24)
  const valueBytes = data.readUInt32LE(32)
  return data.subarray(data.length - valueBytes).toString('utf8').split('\0').slice(0, count).map(clean)
}

function nativeSupportMoves(file) {
  const data = fs.readFileSync(file)
  const count = data.length >= 8 ? data.readUInt32LE(4) : 0
  if (count !== 58 || data.length !== 8 + count * 24) throw new Error(`无效支援行动原生表：${file}`)
  const result = new Map()
  for (let slot = 0; slot < count; slot += 1) {
    const offset = 8 + slot * 24
    const id = data.readUInt32LE(offset)
    if (id !== slot) throw new Error(`支援行动原生 ID/槽位不一致：${id}/${slot}`)
    const rawGaugeCost = data.readUInt16LE(offset + 6)
    if (rawGaugeCost % 100 !== 0 || rawGaugeCost > 500) throw new Error(`支援行动 ${id} 未知消耗量：${rawGaugeCost}`)
    result.set(id, { gaugeCost: rawGaugeCost / 100, nativeUnlockId: data.readInt32LE(offset + 20) })
  }
  return result
}

function nativePalicoSkills(file) {
  const data = fs.readFileSync(file)
  const count = data.length >= 8 ? data.readUInt32LE(4) : 0
  if (count !== 96 || data.length !== 8 + count * 11) throw new Error(`无效随从技能原生表：${file}`)
  const result = new Map()
  for (let slot = 0; slot < count; slot += 1) {
    const offset = 8 + slot * 11
    const id = data.readUInt32LE(offset)
    if (id !== slot) throw new Error(`随从技能原生 ID/槽位不一致：${id}/${slot}`)
    const memoryCost = data.readUInt8(offset + 5)
    const learnLevel = data.readUInt8(offset + 6)
    const skillKind = data.readInt32LE(offset + 7)
    if (slot > 0 && (memoryCost < 1 || memoryCost > 4)) throw new Error(`随从技能 ${id} 未知记忆槽：${memoryCost}`)
    if (learnLevel > 99) throw new Error(`随从技能 ${id} 未知学习等级：${learnLevel}`)
    if (slot > 0 && (skillKind < 0 || skillKind > 2)) throw new Error(`随从技能 ${id} 未知原生分类：${skillKind}`)
    result.set(id, { memoryCost, learnLevel, skillKind })
  }
  return result
}

function localizedDescriptionMap(values, names) {
  const wanted = new Set(names.map(normalize).filter(Boolean)); const result = new Map()
  for (let index = 0; index < values.length; index += 1) {
    const key = normalize(values[index]); if (!wanted.has(key)) continue
    const description = values.slice(index + 1, index + 5).find(value => value.length > 12 && !wanted.has(normalize(value)))
    if (description) result.set(key, description)
  }
  return result
}

function nativeGenerationGroups(root, kind) {
  const result = new Map()
  for (const [tier, group] of [[1, 'C'], [2, 'B'], [3, 'A']]) {
    const file = path.join(root, `lobby/ot${kind}Ini${tier}pt.otil`)
    const data = fs.readFileSync(file)
    if (data.length < 8 || data.readFloatLE(0) !== 1) throw new Error(`无效猎猫随机池：${file}`)
    const count = data.readUInt32LE(4)
    if (data.length !== 8 + count * 6) throw new Error(`猎猫随机池长度异常：${file}`)
    for (let index = 0; index < count; index += 1) {
      const id = data.readUInt16LE(8 + index * 6)
      if (result.has(id)) throw new Error(`猎猫随机池 ID 重复：${kind} ${id}`)
      result.set(id, { tier, group })
    }
  }
  return result
}

function verifyGenerationGroups(kind, gu, xx, maxId, expectedCount) {
  const serialize = map => JSON.stringify([...map.entries()].sort(([left], [right]) => left - right))
  if (serialize(gu) !== serialize(xx)) throw new Error(`MHGU/MHXX 猎猫${kind}随机池不一致`)
  if (gu.size !== expectedCount) throw new Error(`猎猫${kind}随机池数量错误：${gu.size}，预期 ${expectedCount}`)
  for (const id of gu.keys()) if (id < 1 || id > maxId) throw new Error(`猎猫${kind}随机池包含越界 ID：${id}`)
}

function ensureSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS catalog_palico_armor_set_members;
    DROP TABLE IF EXISTS catalog_palico_armor_sets;
    CREATE TABLE IF NOT EXISTS catalog_palico_types (
      game_id TEXT NOT NULL, type_id INTEGER NOT NULL, type_key TEXT NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY(game_id,type_id), UNIQUE(game_id,type_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_support_moves (
      game_id TEXT NOT NULL, support_move_id INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      generation_tier INTEGER, generation_group TEXT, role TEXT NOT NULL, teachable INTEGER NOT NULL,
      gauge_cost INTEGER, evidence_status TEXT NOT NULL, is_placeholder INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      PRIMARY KEY(game_id,support_move_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_type_support_moves (
      game_id TEXT NOT NULL, type_id INTEGER NOT NULL, support_move_id INTEGER NOT NULL, relation_kind TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,type_id,support_move_id),
      FOREIGN KEY(game_id,type_id) REFERENCES catalog_palico_types(game_id,type_id),
      FOREIGN KEY(game_id,support_move_id) REFERENCES catalog_palico_support_moves(game_id,support_move_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_support_move_unlocks (
      game_id TEXT NOT NULL, support_move_id INTEGER NOT NULL, unlock_key TEXT NOT NULL,
      native_unlock_id INTEGER, unlock_kind TEXT NOT NULL DEFAULT 'initial', unlock_level INTEGER, monster_id INTEGER,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, evidence_status TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,support_move_id,unlock_key),
      FOREIGN KEY(game_id,support_move_id) REFERENCES catalog_palico_support_moves(game_id,support_move_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_skills (
      game_id TEXT NOT NULL, palico_skill_id INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      generation_tier INTEGER, generation_group TEXT, role TEXT NOT NULL, teachable INTEGER NOT NULL,
      memory_cost INTEGER, learn_level INTEGER, evidence_status TEXT NOT NULL, is_placeholder INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      PRIMARY KEY(game_id,palico_skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_type_skills (
      game_id TEXT NOT NULL, type_id INTEGER NOT NULL, palico_skill_id INTEGER NOT NULL, relation_kind TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,type_id,palico_skill_id),
      FOREIGN KEY(game_id,type_id) REFERENCES catalog_palico_types(game_id,type_id),
      FOREIGN KEY(game_id,palico_skill_id) REFERENCES catalog_palico_skills(game_id,palico_skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_skill_unlocks (
      game_id TEXT NOT NULL, palico_skill_id INTEGER NOT NULL, unlock_key TEXT NOT NULL,
      native_unlock_id INTEGER, unlock_kind TEXT NOT NULL DEFAULT 'initial', unlock_level INTEGER, monster_id INTEGER,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, evidence_status TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,palico_skill_id,unlock_key),
      FOREIGN KEY(game_id,palico_skill_id) REFERENCES catalog_palico_skills(game_id,palico_skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_weapons (
      game_id TEXT NOT NULL, equipment_id INTEGER NOT NULL, dex_id INTEGER NOT NULL, save_id INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      rarity INTEGER NOT NULL, attack_type TEXT NOT NULL, specialization_id INTEGER NOT NULL, specialization_cn TEXT NOT NULL, specialization_en TEXT NOT NULL,
      melee_attack INTEGER NOT NULL, melee_affinity INTEGER NOT NULL, ranged INTEGER NOT NULL, ranged_affinity INTEGER NOT NULL,
      special_attack_id INTEGER, special_attack_cn TEXT, special_attack_en TEXT, special_attack_value INTEGER,
      defense INTEGER NOT NULL, sharpness_id INTEGER NOT NULL, price INTEGER NOT NULL, icon_path TEXT, source TEXT NOT NULL,
      PRIMARY KEY(game_id,equipment_id), UNIQUE(game_id,dex_id), UNIQUE(game_id,save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_weapon_materials (
      game_id TEXT NOT NULL, equipment_id INTEGER NOT NULL, row_id INTEGER NOT NULL, item_save_id INTEGER NOT NULL, quantity INTEGER NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,equipment_id,row_id),
      FOREIGN KEY(game_id,equipment_id) REFERENCES catalog_palico_weapons(game_id,equipment_id),
      FOREIGN KEY(game_id,item_save_id) REFERENCES catalog_items(game_id,save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_armors (
      game_id TEXT NOT NULL, equipment_id INTEGER NOT NULL, dex_id INTEGER NOT NULL, save_id INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      part TEXT NOT NULL, rarity INTEGER NOT NULL, defense INTEGER NOT NULL,
      fire_res INTEGER NOT NULL, water_res INTEGER NOT NULL, thunder_res INTEGER NOT NULL, ice_res INTEGER NOT NULL, dragon_res INTEGER NOT NULL,
      price INTEGER NOT NULL, image_key TEXT NOT NULL, icon_path TEXT, source TEXT NOT NULL,
      PRIMARY KEY(game_id,equipment_id), UNIQUE(game_id,dex_id), UNIQUE(game_id,save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_armor_materials (
      game_id TEXT NOT NULL, equipment_id INTEGER NOT NULL, row_id INTEGER NOT NULL, item_save_id INTEGER NOT NULL, quantity INTEGER NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,equipment_id,row_id),
      FOREIGN KEY(game_id,equipment_id) REFERENCES catalog_palico_armors(game_id,equipment_id),
      FOREIGN KEY(game_id,item_save_id) REFERENCES catalog_items(game_id,save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_palico_sources (
      game_id TEXT NOT NULL, source_key TEXT NOT NULL, relative_path TEXT NOT NULL, sha256 TEXT NOT NULL,
      PRIMARY KEY(game_id,source_key)
    );
    CREATE INDEX IF NOT EXISTS idx_palico_weapon_search ON catalog_palico_weapons(game_id,name_cn,name_en,name_jp);
    CREATE INDEX IF NOT EXISTS idx_palico_armor_search ON catalog_palico_armors(game_id,name_cn,name_en,name_jp);
  `)
  ensureColumn(db, 'catalog_palico_support_move_unlocks', 'native_unlock_id', 'INTEGER')
  ensureColumn(db, 'catalog_palico_support_move_unlocks', 'unlock_kind', "TEXT NOT NULL DEFAULT 'initial'")
  ensureColumn(db, 'catalog_palico_support_move_unlocks', 'unlock_level', 'INTEGER')
  ensureColumn(db, 'catalog_palico_skill_unlocks', 'native_unlock_id', 'INTEGER')
  ensureColumn(db, 'catalog_palico_skill_unlocks', 'unlock_kind', "TEXT NOT NULL DEFAULT 'initial'")
  ensureColumn(db, 'catalog_palico_skill_unlocks', 'unlock_level', 'INTEGER')
}

function ensureColumn(db, table, column, definition) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name))
  if (!columns.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

const dexWeapons = csv(path.join(dexRoot, 'DB_PeliWpn.csv'))
const dexArmors = csv(path.join(dexRoot, 'DB_PeliAmr.csv'))
const weaponNames = new Map(csv(path.join(dexRoot, 'ID_PeliWpn_Name.csv')).map(row => [integer(row.PeliWpn_ID), row]))
const armorNames = new Map(csv(path.join(dexRoot, 'ID_PeliAmr_Name.csv')).map(row => [integer(row.PeliAmr_ID), row]))
const specialNames = new Map(csv(path.join(dexRoot, 'ID_Wpn_SpAtk.csv')).map(row => [integer(row.Wpn_SpAtk_ID), row]))
const specializations = new Map(csv(path.join(dexRoot, 'ID_PeliWpn_Type.csv')).map(row => [integer(row.PeliWpn_Type_ID), row]))
const gameData = JSON.parse(fs.readFileSync(gameDataFile, 'utf8'))
const moveMeta = csv(path.join(palicoRoot, 'reference/palico_support_moves_en.csv'))
const skillMeta = csv(path.join(palicoRoot, 'reference/palico_skills_en.csv'))
const translations = JSON.parse(fs.readFileSync(path.join(palicoRoot, 'reference/palico_cn_translation.json'), 'utf8'))
const translationMoves = new Map((translations.supportMoves ?? translations.support_moves ?? []).map(row => [integer(row.id), row]))
const translationSkills = new Map((translations.skills ?? []).map(row => [integer(row.id), row]))
const supportNative = nativeSupportMoves(path.join(residentRoot, 'spt_act_base.sab'))
const skillNative = nativePalicoSkills(path.join(residentRoot, 'ot_skl.oskl'))
const supportUnlockReference = JSON.parse(fs.readFileSync(path.join(palicoRoot, 'reference/support_move_unlock_crosswalk.json'), 'utf8'))
const supportUnlockByNativeId = new Map(supportUnlockReference.rows.map(row => [integer(row.nativeUnlockId), row]))
if (supportUnlockByNativeId.size !== 44 || [...supportUnlockByNativeId.keys()].some((id, index) => id !== index + 1)) throw new Error('支援行动解锁怪物 crosswalk 必须完整覆盖原生 ID 1～44')
const nativeSupportUnlockIds = [...supportNative.values()].map(row => row.nativeUnlockId).filter(id => id > 0).sort((left, right) => left - right)
if (JSON.stringify(nativeSupportUnlockIds) !== JSON.stringify(Array.from({ length: 44 }, (_, index) => index + 1))) throw new Error('原生支援行动解锁索引必须恰好覆盖 1～44 且不重复')
const supportWikiFile = path.join(palicoRoot, 'wiki/support-moves.html')
if (fileSha256(supportWikiFile) !== supportUnlockReference.relationSourceSha256) throw new Error('支援行动解锁 Wiki 快照与 crosswalk 证据哈希不一致')
const wikiUnlockCount = (fs.readFileSync(supportWikiFile, 'utf8').match(/習得怪物[：:]/g) ?? []).length
if (wikiUnlockCount !== 44) throw new Error(`支援行动 Wiki 解锁条件数量错误：${wikiUnlockCount}`)
const moveGroups = nativeGenerationGroups(nativeRoot, 'Support')
const moveGroupsXx = nativeGenerationGroups(nativeXxRoot, 'Support')
const skillGroups = nativeGenerationGroups(nativeRoot, 'Skill')
const skillGroupsXx = nativeGenerationGroups(nativeXxRoot, 'Skill')
verifyGenerationGroups('行动', moveGroups, moveGroupsXx, 56, 39)
verifyGenerationGroups('技能', skillGroups, skillGroupsXx, 95, 36)

const skillCn = gmdValues(path.join(palicoRoot, 'localization/chS/ot_skl_chS.gmd'))
const skillEn = gmdValues(path.join(palicoRoot, 'localization/eng/ot_skl_eng.gmd'))
const skillJp = gmdValues(path.join(researchRoot, 'mhgu/romfs/mhxx-table/ot_skl_jpn.gmd'))
const moveCn = gmdValues(path.join(palicoRoot, 'localization/chS/spt_act_base_chS.gmd'))
const moveEn = gmdValues(path.join(palicoRoot, 'localization/eng/spt_act_base_eng.gmd'))
const moveJp = gmdValues(path.join(palicoRoot, 'localization/jpn/spt_act_base_jpn.gmd'))
const typeCn = gmdValues(path.join(palicoRoot, 'localization/chS/OtInfoMsg_chS.gmd'))
const typeEn = gmdValues(path.join(palicoRoot, 'localization/eng/OtInfoMsg_eng.gmd'))
const typeJp = gmdValues(path.join(researchRoot, 'mhgu/romfs/mhxx-table/OtInfoMsg_jpn.gmd'))
const weaponCn = gmdValues(path.join(palicoRoot, 'localization/chS/otWeaponData_chS.gmd'))
const weaponEn = gmdValues(path.join(palicoRoot, 'localization/eng/otWeaponData_eng.gmd'))
const weaponJp = gmdValues(path.join(researchRoot, 'mhgu/romfs/mhxx-table/otWeaponData_jpn.gmd'))
const armorCn = gmdValues(path.join(palicoRoot, 'localization/chS/otArmorData_chS.gmd'))
const armorEn = gmdValues(path.join(palicoRoot, 'localization/eng/otArmorData_eng.gmd'))
const armorJp = gmdValues(path.join(researchRoot, 'mhgu/romfs/mhxx-table/otArmorData_jpn.gmd'))
const allWeaponNames = [...weaponNames.values()].flatMap(row => [row.PeliWpn_Name_0, row.PeliWpn_Name_1, row.PeliWpn_Name_3])
const allArmorNames = [...armorNames.values()].flatMap(row => [row.PeliAmr_Name_0, row.PeliAmr_Name_1, row.PeliAmr_Name_3])
const weaponDescriptions = [localizedDescriptionMap(weaponCn, allWeaponNames), localizedDescriptionMap(weaponEn, allWeaponNames), localizedDescriptionMap(weaponJp, allWeaponNames)]
const armorDescriptions = [localizedDescriptionMap(armorCn, allArmorNames), localizedDescriptionMap(armorEn, allArmorNames), localizedDescriptionMap(armorJp, allArmorNames)]
const weaponIcons = JSON.parse(fs.readFileSync(path.join(manifestRoot, 'mhgu-weapon-icons.json'), 'utf8')).icons
const armorIcons = JSON.parse(fs.readFileSync(path.join(manifestRoot, 'mhgu-armor-icons.json'), 'utf8')).icons

const typeKeys = ['charisma', 'fighting', 'protection', 'assisting', 'healing', 'bombing', 'gathering', 'beast']
const typeNamesCn = ['领袖', '战斗', '防御', '协助', '回复', '爆弹', '采集', '野兽']
const typeNamesJp = ['カリスマ', 'ファイト', 'ガード', 'アシスト', '回復', 'ボマー', 'コレクト', 'ビースト']
const sharpness = new Set([2, 3, 4, 5, 6, 7])
const itemDb = new Database(dbFile, { readonly: true })
const itemByDex = new Map(itemDb.prepare('SELECT dex_id,save_id FROM catalog_items WHERE game_id=? AND dex_id IS NOT NULL').all('mhgu').map(row => [row.dex_id, row.save_id]))
const monsterById = new Map(itemDb.prepare('SELECT monster_id,name_cn,name_en FROM catalog_monsters WHERE game_id=?').all('mhgu').map(row => [row.monster_id, row]))
itemDb.close()

function equipmentDescription(maps, row, prefix) {
  return maps.map((map, index) => map.get(normalize(row[`${prefix}_Name_${[1, 0, 3][index]}`])) ?? '')
}
function sources(...values) { return [...new Set(values.map(clean).filter(Boolean))].join('+') }

const db = new Database(dbFile)
db.pragma('foreign_keys=ON'); ensureSchema(db)
const insertType = db.prepare('INSERT INTO catalog_palico_types VALUES(?,?,?,?,?,?,?,?,?,?)')
const insertMove = db.prepare('INSERT INTO catalog_palico_support_moves VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
const insertTypeMove = db.prepare('INSERT INTO catalog_palico_type_support_moves VALUES(?,?,?,?,?)')
const insertMoveUnlock = db.prepare(`INSERT INTO catalog_palico_support_move_unlocks(
  game_id,support_move_id,unlock_key,native_unlock_id,unlock_kind,unlock_level,monster_id,description_cn,description_en,evidence_status,source
) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
const insertSkill = db.prepare('INSERT INTO catalog_palico_skills VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
const insertTypeSkill = db.prepare('INSERT INTO catalog_palico_type_skills VALUES(?,?,?,?,?)')
const insertSkillUnlock = db.prepare(`INSERT INTO catalog_palico_skill_unlocks(
  game_id,palico_skill_id,unlock_key,native_unlock_id,unlock_kind,unlock_level,monster_id,description_cn,description_en,evidence_status,source
) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
const insertWeapon = db.prepare('INSERT INTO catalog_palico_weapons VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
const insertWeaponMaterial = db.prepare('INSERT INTO catalog_palico_weapon_materials VALUES(?,?,?,?,?,?)')
const insertArmor = db.prepare('INSERT INTO catalog_palico_armors VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
const insertArmorMaterial = db.prepare('INSERT INTO catalog_palico_armor_materials VALUES(?,?,?,?,?,?)')
const insertSource = db.prepare('INSERT INTO catalog_palico_sources VALUES(?,?,?,?)')

const transaction = db.transaction(() => {
  for (const table of ['catalog_palico_armor_materials','catalog_palico_armors','catalog_palico_weapon_materials','catalog_palico_weapons','catalog_palico_skill_unlocks','catalog_palico_type_skills','catalog_palico_skills','catalog_palico_support_move_unlocks','catalog_palico_type_support_moves','catalog_palico_support_moves','catalog_palico_types','catalog_palico_sources']) db.prepare(`DELETE FROM ${table} WHERE game_id='mhgu'`).run()
  for (let typeId = 0; typeId < 8; typeId += 1) insertType.run('mhgu', typeId, typeKeys[typeId], typeNamesCn[typeId], gameData.PalicoForte[typeId], typeNamesJp[typeId], typeCn[typeId] ?? '', typeEn[typeId] ?? '', typeJp[typeId] ?? '', 'OtInfoMsg GMD+game_data.json')
  const innateMoveIds = new Set(gameData.PalicoForteOwnedMoves.flat().filter(id => id >= 1 && id <= 56))
  for (const row of moveMeta) {
    const id = integer(row.id); if (id == null || id < 1 || id > 56) continue
    const translation = translationMoves.get(id) ?? {}; const native = supportNative.get(id)
    if (!native) throw new Error(`支援行动 ${id} 缺少原生记录`)
    const nameCn = moveCn[id * 2] || clean(translation.chinese) || clean(gameData.PalicoSupportMoves[id] ?? row.english)
    const nameEn = moveEn[id * 2] || clean(gameData.PalicoSupportMoves[id] ?? row.english)
    const nameJp = moveJp[id * 2] || clean(translation.japanese) || nameEn
    const nativeGroup = moveGroups.get(id) ?? null
    const referenceGroup = clean(row.generation_group) || null
    if (referenceGroup !== (nativeGroup?.group ?? null)) throw new Error(`支援行动 ${id} 分组与原生随机池不一致：${referenceGroup ?? '无'} / ${nativeGroup?.group ?? '无'}`)
    insertMove.run('mhgu', id, nameCn, nameEn, nameJp, moveCn[id * 2 + 1] ?? '', moveEn[id * 2 + 1] ?? '', moveJp[id * 2 + 1] ?? '', nativeGroup?.tier ?? 0, nativeGroup?.group ?? null, clean(row.role) || (nativeGroup ? 'generated' : 'fixed'), integer(row.teachable, 0), native.gaugeCost, 'verified', 0, sources('resident.arc:spt_act_base', 'spt_act_base GMD', 'native otSupportIni*.otil', row.source, translation.source))
    if (native.nativeUnlockId > 0) {
      const relation = supportUnlockByNativeId.get(native.nativeUnlockId)
      if (!relation || integer(relation.supportMoveId) !== id) throw new Error(`支援行动 ${id} 的原生解锁索引 ${native.nativeUnlockId} 未闭合`)
      const monsterId = integer(relation.monsterId)
      const monster = monsterById.get(monsterId)
      if (!monster || clean(monster.name_cn) !== clean(relation.monsterNameCn)) throw new Error(`支援行动 ${id} 的解锁怪物 ${monsterId} 未映射`)
      insertMoveUnlock.run('mhgu', id, `monster:${monsterId}`, native.nativeUnlockId, 'monster', null, monsterId, `狩猎「${monster.name_cn}」后解锁。`, `Unlock by hunting ${monster.name_en}.`, 'verified', 'resident.arc:spt_act_base.UnlockMonsterID+fixed Axibug revision')
    } else {
      const innate = innateMoveIds.has(id)
      insertMoveUnlock.run('mhgu', id, innate ? 'innate' : 'initial', 0, innate ? 'innate' : 'initial', null, null, innate ? '对应支援倾向的固有行动，初始习得。' : '无需狩猎特定怪物，初始即可使用或随机习得。', innate ? 'Innate to the corresponding Support Bias and learned initially.' : 'No monster hunt is required; available initially or through normal generation.', 'verified', 'resident.arc:spt_act_base.UnlockMonsterID+game_data.json')
    }
  }
  for (let typeId = 0; typeId < gameData.PalicoForteOwnedMoves.length; typeId += 1) for (const moveId of gameData.PalicoForteOwnedMoves[typeId]) if (moveId <= 56) insertTypeMove.run('mhgu', typeId, moveId, 'innate', 'game_data.json:PalicoForteOwnedMoves')
  for (let id = 1; id <= 95; id += 1) {
    const meta = skillMeta.find(row => integer(row.id) === id) ?? {}
    const translation = translationSkills.get(id) ?? {}
    const native = skillNative.get(id); if (!native) throw new Error(`随从技能 ${id} 缺少原生记录`)
    const nameCn = skillCn[id * 2] || clean(translation.chinese) || gameData.PalicoSkills[id]; const nameEn = skillEn[id * 2] || clean(translation.english) || gameData.PalicoSkills[id]; const nameJp = skillJp[id * 2] || clean(translation.japanese) || nameEn
    const nativeGroup = skillGroups.get(id) ?? null
    const referenceGroup = clean(meta.generation_group) || null
    if (referenceGroup !== (nativeGroup?.group ?? null)) throw new Error(`随从技能 ${id} 分组与原生随机池不一致：${referenceGroup ?? '无'} / ${nativeGroup?.group ?? '无'}`)
    const role = clean(meta.role) || (nativeGroup ? 'generated' : 'innate')
    insertSkill.run('mhgu', id, nameCn, nameEn, nameJp, skillCn[id * 2 + 1] ?? '', skillEn[id * 2 + 1] ?? '', skillJp[id * 2 + 1] ?? '', nativeGroup?.tier ?? 0, nativeGroup?.group ?? null, role, integer(meta.teachable, 1), native.memoryCost, native.learnLevel, 'verified', 0, sources('resident.arc:ot_skl', 'native otSkillIni*.otil', 'ot_skl GMD', 'game_data.json', translation.source))
    if (native.learnLevel > 0) {
      insertSkillUnlock.run('mhgu', id, `level:${native.learnLevel}`, null, 'level', native.learnLevel, null, `随从达到 Lv ${native.learnLevel} 后可学习。`, `Learnable when the Palico reaches Lv ${native.learnLevel}.`, 'verified', 'resident.arc:ot_skl.LearnLevel')
    } else if (role === 'special') {
      insertSkillUnlock.run('mhgu', id, 'distribution', null, 'distribution', null, null, '配信随从携带，可通过传授获得。', 'Carried by a distributed Palico and obtainable through teaching.', 'wiki_only', sources(meta.source, translation.source))
    } else {
      insertSkillUnlock.run('mhgu', id, 'innate', null, 'innate', 0, null, '对应支援倾向的固有技能，初始习得。', 'Innate to the corresponding Support Bias and learned initially.', 'verified', 'resident.arc:ot_skl.LearnLevel+game_data.json')
    }
  }
  for (let typeId = 0; typeId < gameData.PalicoForteOwnedSkills.length; typeId += 1) for (const skillId of gameData.PalicoForteOwnedSkills[typeId]) if (skillId <= 95) insertTypeSkill.run('mhgu', typeId, skillId, 'innate', 'game_data.json:PalicoForteOwnedSkills')
  for (const row of dexWeapons) {
    const id = integer(row.PeliWpn_ID); const names = weaponNames.get(id); if (!names) throw new Error(`猫武器 ${id} 缺少名称`)
    const sharpnessId = integer(row.Sharp_ID); if (!sharpness.has(sharpnessId)) throw new Error(`猫武器 ${id} 未知斩味 ${sharpnessId}`)
    const descriptions = equipmentDescription(weaponDescriptions, names, 'PeliWpn')
    const specialization = specializations.get(integer(row.PeliWpn_Type_ID)) ?? {}; const special = specialNames.get(integer(row.SpAtk_ID)) ?? {}
    const iconKey = `Wpn_${row.Part}${String(row.Rare).padStart(2, '0')}`; const iconPath = weaponIcons[iconKey]
    if (!iconPath) throw new Error(`猫武器 ${id} 缺少图标 ${iconKey}`)
    insertWeapon.run('mhgu', id, id, id, clean(names.PeliWpn_Name_1), clean(names.PeliWpn_Name_0), clean(names.PeliWpn_Name_3), ...descriptions, integer(row.Rare), row.Part === '21' ? 'cut' : 'blunt', integer(row.PeliWpn_Type_ID), clean(specialization.PeliWpn_Type_1), clean(specialization.PeliWpn_Type_0), integer(row.AtkD, 0), integer(row.AtkD_Affinity, 0), integer(row.AtkI, 0), integer(row.AtkI_Affinity, 0), integer(row.SpAtk_ID) >= 0 ? integer(row.SpAtk_ID) : null, clean(special.Wpn_SpAtk_1) || null, clean(special.Wpn_SpAtk_0) || null, Math.max(integer(row.AtkD_SpAtkPt, 0), integer(row.AtkI_SpAtkPt, 0)) || null, integer(row.Def, 0), sharpnessId, integer(row.Price, 0), iconPath, 'DB_PeliWpn.csv+native OWP')
  }
  let materialRow = 0
  for (const row of csv(path.join(dexRoot, 'DB_ItmtoPeliWpn.csv'))) { const itemSaveId = itemByDex.get(integer(row.Itm_ID)); if (itemSaveId == null) throw new Error(`猫武器材料道具未映射 ${row.Itm_ID}`); insertWeaponMaterial.run('mhgu', integer(row.PeliWpn_ID), ++materialRow, itemSaveId, integer(row.Qty, 1), 'DB_ItmtoPeliWpn.csv') }
  for (const row of dexArmors) {
    const id = integer(row.PeliAmr_ID); const names = armorNames.get(id); if (!names) throw new Error(`猫防具 ${id} 缺少名称`)
    const descriptions = equipmentDescription(armorDescriptions, names, 'PeliAmr'); const part = row.Part === '11' ? 'head' : 'body'
    const iconKey = `Amr_${row.Part}${String(row.Rare).padStart(2, '0')}`; const iconPath = armorIcons[iconKey]
    if (!iconPath) throw new Error(`猫防具 ${id} 缺少图标 ${iconKey}`)
    insertArmor.run('mhgu', id, id, id, clean(names.PeliAmr_Name_1), clean(names.PeliAmr_Name_0), clean(names.PeliAmr_Name_3), ...descriptions, part, integer(row.Rare), integer(row.Def), integer(row.Res_Fire), integer(row.Res_Water), integer(row.Res_Thunder), integer(row.Res_Ice), integer(row.Res_Dragon), integer(row.Price), clean(row.ImgFile), iconPath, 'DB_PeliAmr.csv+native OAR')
  }
  materialRow = 0
  for (const row of csv(path.join(dexRoot, 'DB_ItmtoPeliAmr.csv'))) { const itemSaveId = itemByDex.get(integer(row.Itm_ID)); if (itemSaveId == null) throw new Error(`猫防具材料道具未映射 ${row.Itm_ID}`); insertArmorMaterial.run('mhgu', integer(row.PeliAmr_ID), ++materialRow, itemSaveId, integer(row.Qty, 1), 'DB_ItmtoPeliAmr.csv') }
  required.forEach((file, index) => insertSource.run('mhgu', `input:${index + 1}`, path.relative(researchRoot, file).replaceAll(path.sep, '/'), fileSha256(file)))
})

transaction(); db.pragma('optimize')
const counts = Object.fromEntries(['types','support_moves','support_move_unlocks','skills','skill_unlocks','weapons','armors','weapon_materials','armor_materials'].map(name => [name, db.prepare(`SELECT count(*) count FROM catalog_palico_${name} WHERE game_id='mhgu'`).get().count]))
const generationGroups = {
  supportMoves: Object.fromEntries(db.prepare("SELECT COALESCE(generation_group,'unassigned') value,count(*) count FROM catalog_palico_support_moves WHERE game_id='mhgu' GROUP BY generation_group ORDER BY value").all().map(row => [row.value, row.count])),
  skills: Object.fromEntries(db.prepare("SELECT COALESCE(generation_group,'unassigned') value,count(*) count FROM catalog_palico_skills WHERE game_id='mhgu' GROUP BY generation_group ORDER BY value").all().map(row => [row.value, row.count])),
}
const tableSha256 = Object.fromEntries(Object.entries(PALICO_TABLE_ORDER).map(([table, order]) => {
  const rows = db.prepare(`SELECT * FROM ${table} WHERE game_id='mhgu' ORDER BY ${order}`).all()
  return [table, sha256(JSON.stringify(rows))]
}))
const contentSha256 = sha256(JSON.stringify(tableSha256))
const crosswalk = {
  format: 'mh-save-edit-palico-crosswalk-v3',
  types: db.prepare("SELECT type_id nativeId,type_key typeKey FROM catalog_palico_types WHERE game_id='mhgu' ORDER BY type_id").all(),
  supportMoves: db.prepare("SELECT m.support_move_id nativeId,u.native_unlock_id nativeUnlockId,u.monster_id monsterId FROM catalog_palico_support_moves m JOIN catalog_palico_support_move_unlocks u USING(game_id,support_move_id) WHERE m.game_id='mhgu' ORDER BY m.support_move_id").all(),
  skills: db.prepare("SELECT s.palico_skill_id nativeId,s.memory_cost memoryCost,s.learn_level learnLevel,u.unlock_kind unlockKind FROM catalog_palico_skills s JOIN catalog_palico_skill_unlocks u USING(game_id,palico_skill_id) WHERE s.game_id='mhgu' ORDER BY s.palico_skill_id").all(),
  weapons: db.prepare("SELECT equipment_id equipmentId,dex_id dexId,save_id saveId FROM catalog_palico_weapons WHERE game_id='mhgu' ORDER BY equipment_id").all(),
  armors: db.prepare("SELECT equipment_id equipmentId,dex_id dexId,save_id saveId FROM catalog_palico_armors WHERE game_id='mhgu' ORDER BY equipment_id").all(),
}
const foreignKeys = db.pragma('foreign_key_check'); db.close()
if (foreignKeys.length) throw new Error(`猎猫图鉴外键检查失败：${JSON.stringify(foreignKeys.slice(0, 5))}`)
const report = { format: 'mh-save-edit-palico-catalog-v3', counts, generationGroups, contentSha256, tableSha256 }
fs.mkdirSync(manifestRoot, { recursive: true })
fs.writeFileSync(path.join(manifestRoot, 'palico-catalog-crosswalk.json'), `${JSON.stringify(crosswalk, null, 2)}\n`)
fs.writeFileSync(path.join(manifestRoot, 'palico-catalog-build.json'), `${JSON.stringify(report, null, 2)}\n`)
if (installLocal) fs.copyFileSync(dbFile, path.join(projectRoot, 'data/mhgu.sqlite'))
console.log(JSON.stringify(report, null, 2))
