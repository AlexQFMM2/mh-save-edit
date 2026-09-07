#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchArgument = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchArgument >= 0 ? args[researchArgument + 1] : '../research')

const GAME_SPECS = {
  mh3g: {
    database: 'data/mh3g.sqlite',
    dex: 'mh3u/dex/mh3g-dex',
    iconManifest: 'data/manifests/mh3g-weapon-icons.json',
    handicraftStages: 2,
    saveTypes: [7, 14, 8, 18, 9, 19, 10, 16, 15, 13, 11, 17],
  },
  mh4g: {
    database: 'data/mh4g.sqlite',
    dex: 'mh4g/dex/mh4g-dex',
    iconManifest: 'data/manifests/mh4g-weapon-icons.json',
    handicraftStages: 2,
    saveTypes: [7, 13, 8, 17, 9, 18, 10, 15, 14, 20, 19, 11, 12, 16],
    ignoredDexIds: new Map([
      [387, 'overseas-alternate-without-jp-save-identity'],
      [1874, 'overseas-alternate-without-jp-save-identity'],
    ]),
    duplicateDexAliases: new Map([[273, 257], [274, 258], [275, 259], [276, 260], [277, 261]]),
    manualDexBySaveIdentity: new Map([['7:47', 68], ['13:85', 386], ['19:133', 1873], ['19:134', 1875]]),
  },
  mhgu: {
    database: 'data/mhgu.sqlite',
    dex: 'mhgu/dex/mhxx-dex',
    iconManifest: 'data/manifests/mhgu-weapon-icons.json',
    handicraftStages: 3,
    saveTypes: [7, 14, 8, 18, 9, 19, 10, 16, 15, 21, 20, 13, 11, 17],
  },
}

const WEAPON_TYPES = [
  ['大剑', 'Great Sword'], ['太刀', 'Long Sword'], ['片手剑', 'Sword and Shield'],
  ['双剑', 'Dual Blades'], ['大锤', 'Hammer'], ['狩猎笛', 'Hunting Horn'],
  ['长枪', 'Lance'], ['铳枪', 'Gunlance'], ['斩击斧', 'Switch Axe'],
  ['盾斧', 'Charge Blade'], ['操虫棍', 'Insect Glaive'], ['轻弩', 'Light Bowgun'],
  ['重弩', 'Heavy Bowgun'], ['弓', 'Bow'],
]

const GU_FAMILY_TABLES = [
  'cn__weapon_great_sword', 'cn__weapon_long_sword', 'cn__weapon_sword_and_shield',
  'cn__weapon_dual_blades', 'cn__weapon_hammer', 'cn__weapon_hunting_horn',
  'cn__weapon_lance', 'cn__weapon_gunlance', 'cn__weapon_switch_axe',
  'cn__weapon_charge_blade', 'cn__weapon_insect_glaive', 'cn__weapon_light_bowgun',
  'cn__weapon_heavy_bowgun', 'cn__weapon_bow',
]

const NOTE_NAMES = new Map([
  [1, ['白', 'White']], [2, ['紫', 'Purple']], [3, ['红', 'Red']], [4, ['蓝', 'Blue']],
  [5, ['天蓝', 'Cyan']], [6, ['绿', 'Green']], [7, ['黄', 'Yellow']], [8, ['橙', 'Orange']],
])

function parseCsv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rows = []
  let row = [], field = '', quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(field); field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []; field = ''
    } else field += character
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const integer = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
const decimal = (value, fallback = null) => {
  const parsed = Number.parseFloat(String(value ?? '').trim())
  return Number.isFinite(parsed) ? parsed : fallback
}
const clean = (value) => String(value ?? '').trim()
const normalize = (value) => clean(value).normalize('NFKC').toLowerCase()
  .replace(/^\s*(?:\[jp\]|【日】|【jp】)\s*/iu, '')
  .replace(/\s*-\s*lv\.?\s*\d+$/iu, '')
  .replace(/[^a-z0-9\p{L}]/gu, '')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = (file) => sha256(fs.readFileSync(file))
const groupBy = (rows, key) => {
  const groups = new Map()
  for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row])
  return groups
}

function dexPath(spec, file) {
  return path.join(researchRoot, spec.dex, 'direct_sql', file)
}

function verifySourceSnapshot(manifestFile, snapshotRoot) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const failures = []
  for (const entry of manifest.files ?? []) {
    const file = path.join(snapshotRoot, entry.path)
    if (!fs.existsSync(file)) { failures.push({ path: entry.path, reason: 'missing' }); continue }
    const stat = fs.statSync(file)
    if (stat.size !== entry.size) failures.push({ path: entry.path, reason: 'size', expected: entry.size, actual: stat.size })
    const actualSha256 = fileSha256(file)
    if (actualSha256 !== entry.sha256) failures.push({ path: entry.path, reason: 'sha256', expected: entry.sha256, actual: actualSha256 })
  }
  if (failures.length) throw new Error(`Dex snapshot verification failed: ${JSON.stringify(failures.slice(0, 5))}`)
  return { fileCount: manifest.files?.length ?? 0, sourcePath: manifest.sourcePath, exportToolPath: manifest.exportToolPath, generatedAtUtc: manifest.generatedAtUtc }
}

function namesById(spec, file, idColumn, prefix) {
  const target = dexPath(spec, file)
  if (!fs.existsSync(target)) return new Map()
  return new Map(parseCsv(target).map((row) => [integer(row[idColumn]), {
    cn: clean(row[`${prefix}_1`]), en: clean(row[`${prefix}_0`]), jp: clean(row[`${prefix}_3`]),
  }]).filter(([id]) => id != null))
}

function parseSharpness(raw) {
  const value = clean(raw).padStart(14, '0')
  if (!/^\d{14}$/.test(value)) throw new Error(`Invalid sharpness value: ${raw}`)
  const offsets = [12, 10, 8, 6, 4, 2, 0]
  return offsets.map((offset) => Number.parseInt(value.slice(offset, offset + 2), 10))
}

function graphFor(rows) {
  const edges = []
  const roots = []
  for (const typeRows of groupBy(rows, 'Wpn_Type_ID').values()) {
    const stack = []
    for (const row of typeRows.sort((left, right) => integer(left.Wpn_ID) - integer(right.Wpn_ID))) {
      while (stack.length && stack.at(-1).remaining === 0) stack.pop()
      if (stack.length) {
        const parent = stack.at(-1)
        edges.push({ parentDexId: integer(parent.row.Wpn_ID), childDexId: integer(row.Wpn_ID), branchOrder: integer(parent.row.Child) - parent.remaining })
        parent.remaining -= 1
      } else roots.push(integer(row.Wpn_ID))
      const children = integer(row.Child, 0)
      if (children > 0) stack.push({ row, remaining: children })
    }
    while (stack.length && stack.at(-1).remaining === 0) stack.pop()
    if (stack.length) throw new Error(`Unclosed derivation stack for weapon type ${typeRows[0].Wpn_Type_ID}`)
  }
  return { edges, roots }
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_weapon_types (
      game_id TEXT NOT NULL, type_id INTEGER NOT NULL, save_type INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, sort_order INTEGER NOT NULL,
      icon_key_prefix TEXT NOT NULL, PRIMARY KEY (game_id, type_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapons (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, type_id INTEGER NOT NULL,
      save_type INTEGER NOT NULL, save_id INTEGER NOT NULL, save_level INTEGER,
      display_level INTEGER, dex_id INTEGER, name_cn TEXT NOT NULL, name_en TEXT NOT NULL,
      name_jp TEXT NOT NULL DEFAULT '', rarity INTEGER, display_attack INTEGER, true_raw_attack INTEGER,
      affinity REAL, defense INTEGER, slots INTEGER, production_price INTEGER, upgrade_price INTEGER,
      is_directly_producible INTEGER NOT NULL DEFAULT 0, is_final_form INTEGER NOT NULL DEFAULT 0,
      icon_path TEXT, preview_path TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0,
      mapping_status TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_dex_sources (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, dex_id INTEGER NOT NULL,
      source_role TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key, dex_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_attributes (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, position INTEGER NOT NULL,
      attribute_id INTEGER NOT NULL, kind TEXT NOT NULL, name_cn TEXT NOT NULL,
      name_en TEXT NOT NULL, value INTEGER NOT NULL, is_hidden INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key, position)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_sharpness (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, red INTEGER NOT NULL, orange INTEGER NOT NULL,
      yellow INTEGER NOT NULL, green INTEGER NOT NULL, blue INTEGER NOT NULL, white INTEGER NOT NULL,
      purple INTEGER NOT NULL, base_cutoff INTEGER NOT NULL, handicraft_1_cutoff INTEGER,
      handicraft_2_cutoff INTEGER, raw_value TEXT NOT NULL, interpretation_status TEXT NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_edges (
      game_id TEXT NOT NULL, parent_weapon_key TEXT NOT NULL, child_weapon_key TEXT NOT NULL,
      branch_order INTEGER NOT NULL, edge_kind TEXT NOT NULL, mapping_status TEXT NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY (game_id, parent_weapon_key, child_weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_materials (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, weapon_key TEXT NOT NULL,
      material_kind TEXT NOT NULL, item_save_id INTEGER NOT NULL, item_dex_id INTEGER,
      quantity INTEGER NOT NULL, source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_hunting_horns (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, note1_id INTEGER NOT NULL, note1_name_cn TEXT NOT NULL,
      note1_name_en TEXT NOT NULL, note2_id INTEGER NOT NULL, note2_name_cn TEXT NOT NULL,
      note2_name_en TEXT NOT NULL, note3_id INTEGER NOT NULL, note3_name_cn TEXT NOT NULL,
      note3_name_en TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_horn_songs (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, song_id INTEGER NOT NULL, song_rank_id INTEGER NOT NULL,
      notes TEXT NOT NULL, effect_name_cn TEXT NOT NULL, effect_name_en TEXT NOT NULL,
      encore_effect_name_cn TEXT, encore_effect_name_en TEXT, duration INTEGER, encore_duration INTEGER,
      source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key, song_id, song_rank_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_gunlances (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, shot_type_id INTEGER NOT NULL,
      shot_name_cn TEXT NOT NULL, shot_name_en TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_phials (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, weapon_kind TEXT NOT NULL, phial_id INTEGER NOT NULL,
      phial_name_cn TEXT NOT NULL, phial_name_en TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_insect_glaives (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, kinsect_type_id INTEGER NOT NULL,
      kinsect_type_name_cn TEXT NOT NULL, kinsect_type_name_en TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_bowguns (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, reload_id INTEGER NOT NULL, reload_name_cn TEXT NOT NULL,
      reload_name_en TEXT NOT NULL, recoil_id INTEGER NOT NULL, recoil_name_cn TEXT NOT NULL,
      recoil_name_en TEXT NOT NULL, steadiness_id INTEGER NOT NULL, steadiness_name_cn TEXT NOT NULL,
      steadiness_name_en TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_gun_ammo (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, weapon_key TEXT NOT NULL,
      item_save_id INTEGER, item_dex_id INTEGER NOT NULL, ammo_name_cn TEXT NOT NULL, ammo_name_en TEXT NOT NULL,
      load_quantity INTEGER NOT NULL, load_quantity_plus INTEGER, max_carry INTEGER,
      special_fire_quantity INTEGER, rapid_fire_gap_id INTEGER, rapid_fire_gap_name_cn TEXT,
      rapid_fire_gap_name_en TEXT, action_kind TEXT NOT NULL, source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_bows (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, shot_mode_id INTEGER NOT NULL,
      shot_mode_name_cn TEXT NOT NULL, shot_mode_name_en TEXT NOT NULL, load_up_charge_level INTEGER,
      source TEXT NOT NULL, PRIMARY KEY (game_id, weapon_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_bow_charges (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, charge_level INTEGER NOT NULL,
      shot_type_id INTEGER NOT NULL, shot_type_name_cn TEXT NOT NULL, shot_type_name_en TEXT NOT NULL,
      requires_load_up INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
      PRIMARY KEY (game_id, weapon_key, charge_level)
    );
    CREATE TABLE IF NOT EXISTS catalog_weapon_content_variants (
      game_id TEXT NOT NULL, weapon_key TEXT NOT NULL, variant_id TEXT NOT NULL,
      field_name TEXT NOT NULL, integer_value INTEGER, text_value TEXT, source_path TEXT NOT NULL,
      source_sha256 TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, weapon_key, variant_id, field_name)
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_weapon_type ON catalog_weapons(game_id, type_id, save_id, save_level);
    CREATE INDEX IF NOT EXISTS idx_catalog_weapon_dex ON catalog_weapon_dex_sources(game_id, dex_id);
    CREATE INDEX IF NOT EXISTS idx_catalog_weapon_material ON catalog_weapon_materials(game_id, weapon_key, material_kind);
    CREATE INDEX IF NOT EXISTS idx_catalog_weapon_ammo ON catalog_weapon_gun_ammo(game_id, weapon_key);
  `)
}

function mh3gCrosswalk(db, dexRows) {
  const authority = db.prepare('SELECT * FROM weapons ORDER BY save_type, save_id').all()
  const dexById = new Map(dexRows.map((row) => [integer(row.Wpn_ID), row]))
  return authority.map((row) => ({
    authority: row,
    dex: row.dex_id == null ? null : dexById.get(row.dex_id) ?? null,
    classification: row.is_placeholder ? 'placeholder' : row.dex_id == null ? 'unmapped' : 'confirmed-existing-crosswalk',
  }))
}

function mh4gCrosswalk(db, dexRows, spec) {
  const authority = db.prepare('SELECT * FROM weapons WHERE is_relic = 0 ORDER BY save_type, save_id').all()
  const byType = groupBy(dexRows, 'Wpn_Type_ID')
  const result = []
  for (let typeId = 1; typeId <= 14; typeId += 1) {
    const saveType = spec.saveTypes[typeId - 1]
    const allAuthority = authority.filter((row) => row.save_type === saveType)
    const placeholders = allAuthority.filter((row) => row.save_id === 0 || (['dummy', 'ダミー'].includes(normalize(row.name_cn)) && normalize(row.name_en).startsWith('dummy')))
    const realAuthority = allAuthority.filter((row) => !placeholders.includes(row))
    const usableDex = (byType.get(String(typeId)) ?? byType.get(typeId) ?? [])
      .filter((row) => !spec.ignoredDexIds.has(integer(row.Wpn_ID)) && !spec.duplicateDexAliases.has(integer(row.Wpn_ID)))
      .sort((left, right) => integer(left.Wpn_ID) - integer(right.Wpn_ID))
    const dexNames = namesById(spec, 'ID_Wpn_Name.csv', 'Wpn_ID', 'Wpn_Name')
    const dexByName = new Map()
    for (const dex of usableDex) {
      const names = dexNames.get(integer(dex.Wpn_ID))
      for (const value of [names?.cn, names?.en, names?.jp]) {
        const key = normalize(value)
        if (key) dexByName.set(key, [...(dexByName.get(key) ?? []), dex])
      }
    }
    const usedDexIds = new Set()
    for (const authorityRow of realAuthority) {
      const manualDexId = spec.manualDexBySaveIdentity.get(`${authorityRow.save_type}:${authorityRow.save_id}`)
      const candidates = manualDexId == null ? [authorityRow.name_cn, authorityRow.name_en]
        .flatMap((value) => dexByName.get(normalize(value)) ?? [])
        .filter((dex) => !usedDexIds.has(integer(dex.Wpn_ID)))
        .sort((left, right) => integer(left.Wpn_ID) - integer(right.Wpn_ID)) : usableDex.filter((dex) => integer(dex.Wpn_ID) === manualDexId)
      const dex = candidates[0]
      if (!dex) {
        result.push({ authority: authorityRow, dex: null, classification: 'regional-extension-not-in-dex-build7', excluded: true })
        continue
      }
      usedDexIds.add(integer(dex.Wpn_ID))
      const aliases = [...spec.duplicateDexAliases]
        .filter(([, primaryId]) => primaryId === integer(dex.Wpn_ID))
        .map(([aliasId]) => dexRows.find((row) => integer(row.Wpn_ID) === aliasId))
        .filter(Boolean)
      result.push({ authority: authorityRow, dex, dexAliases: aliases, classification: aliases.length ? 'confirmed-name-with-duplicate-derived-alias' : 'confirmed-name' })
    }
    const unmatchedDex = usableDex.filter((row) => !usedDexIds.has(integer(row.Wpn_ID)))
    if (unmatchedDex.length) throw new Error(`MH4G type ${typeId}: unmatched Dex nodes ${unmatchedDex.map((row) => row.Wpn_ID).join(',')}`)
    for (const row of placeholders) result.push({ authority: row, dex: null, classification: row.save_id === 0 ? 'placeholder-none' : 'placeholder-dummy' })
  }
  const mapped = result.filter((entry) => entry.dex).length
  const regional = result.filter((entry) => entry.excluded).length
  const aliases = result.reduce((sum, entry) => sum + (entry.dexAliases?.length ?? 0), 0)
  if (mapped !== 2324 || regional !== 28 || aliases !== 5) throw new Error(`MH4G crosswalk totals differ: mapped=${mapped}, regional=${regional}, aliases=${aliases}`)
  return result.sort((left, right) => left.authority.save_type - right.authority.save_type || left.authority.save_id - right.authority.save_id)
}

function mhguCrosswalk(db, dexRows, spec) {
  const dexByType = groupBy(dexRows, 'Wpn_Type_ID')
  const dexNames = namesById(spec, 'ID_Wpn_Name.csv', 'Wpn_ID', 'Wpn_Name')
  const result = []
  for (let typeId = 1; typeId <= 14; typeId += 1) {
    const saveType = spec.saveTypes[typeId - 1]
    const families = db.prepare(`SELECT id, name name_cn, english name_en, rarity, max_level, source FROM ${GU_FAMILY_TABLES[typeId - 1]} ORDER BY id`).all()
    const familyById = new Map(families.map((row) => [row.id, row]))
    const slots = db.prepare(`SELECT * FROM cn__weapon_level_slots WHERE equipment_type = ? ORDER BY weapon_id, save_level`).all(saveType)
    const placeholders = slots.filter((row) => row.weapon_id === 0)
    const realSlots = slots.filter((row) => row.weapon_id !== 0)
    const typeDex = (dexByType.get(String(typeId)) ?? dexByType.get(typeId) ?? []).sort((left, right) => integer(left.Wpn_ID) - integer(right.Wpn_ID))
    if (realSlots.length !== typeDex.length) throw new Error(`MHGU type ${typeId}: ${realSlots.length} level slots != ${typeDex.length} Dex nodes`)
    const usedDexIds = new Set()
    for (const family of families.filter((row) => row.id !== 0)) {
      const familySlots = realSlots.filter((row) => row.weapon_id === family.id)
      if (familySlots.length !== family.max_level) throw new Error(`MHGU type ${typeId} family ${family.id}: slots=${familySlots.length}, max_level=${family.max_level}`)
      const starts = typeDex.filter((dex) => {
        const dexId = integer(dex.Wpn_ID)
        if (usedDexIds.has(dexId)) return false
        const names = dexNames.get(dexId)
        return [family.name_cn, family.name_en].some((value) => [names?.cn, names?.en].some((candidate) => normalize(value) === normalize(candidate)))
          && /lv\.?\s*1$/iu.test(`${names?.cn} ${names?.en}`)
      })
      if (starts.length !== 1) throw new Error(`MHGU type ${typeId} family ${family.id} ${family.name_cn}: expected one Lv.1 Dex start, found ${starts.length}`)
      const startId = integer(starts[0].Wpn_ID)
      for (const slot of familySlots) {
        const dexId = startId + slot.save_level
        const dex = typeDex.find((candidate) => integer(candidate.Wpn_ID) === dexId)
        if (!dex || integer(dex.Wpn_Type_ID) !== typeId || usedDexIds.has(dexId)) throw new Error(`MHGU type ${typeId} family ${family.id}: invalid Dex level node ${dexId}`)
        const displayNames = dexNames.get(dexId)
        const expectedLevel = slot.display_level
        if (![displayNames?.cn, displayNames?.en].some((name) => new RegExp(`lv\\.?\\s*${expectedLevel}$`, 'iu').test(clean(name)))) {
          throw new Error(`MHGU type ${typeId} family ${family.id}: Dex ${dexId} does not display Lv.${expectedLevel}`)
        }
        usedDexIds.add(dexId)
        result.push({ authority: { ...slot, ...family, save_type: saveType, save_id: slot.weapon_id, save_level: slot.save_level }, dex, classification: 'confirmed-family-name-level-range' })
      }
    }
    const unused = typeDex.filter((row) => !usedDexIds.has(integer(row.Wpn_ID)))
    if (unused.length) throw new Error(`MHGU type ${typeId}: ${unused.length} Dex nodes were not assigned to a family`)
    for (const slot of placeholders) result.push({ authority: { ...slot, save_type: saveType, save_id: 0, save_level: 0, name_cn: '无装备', name_en: 'None', rarity: 0 }, dex: null, classification: 'placeholder-none' })
  }
  return result.sort((left, right) => left.authority.save_type - right.authority.save_type || left.authority.save_id - right.authority.save_id || (left.authority.save_level ?? -1) - (right.authority.save_level ?? -1))
}

function weaponKey(gameId, row) {
  return gameId === 'mhgu'
    ? `${row.save_type}:${row.save_id}:${row.save_level}`
    : `${row.save_type}:${row.save_id}`
}

function clearGame(db, gameId) {
  const tables = [
    'catalog_weapon_content_variants', 'catalog_weapon_bow_charges', 'catalog_weapon_bows',
    'catalog_weapon_gun_ammo', 'catalog_weapon_bowguns', 'catalog_weapon_insect_glaives',
    'catalog_weapon_phials', 'catalog_weapon_gunlances', 'catalog_weapon_horn_songs',
    'catalog_weapon_hunting_horns', 'catalog_weapon_materials', 'catalog_weapon_edges',
    'catalog_weapon_sharpness', 'catalog_weapon_attributes', 'catalog_weapon_dex_sources',
    'catalog_weapons', 'catalog_weapon_types',
  ]
  for (const table of tables) db.prepare(`DELETE FROM ${table} WHERE game_id = ?`).run(gameId)
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('catalog_weapon_materials','catalog_weapon_gun_ammo')").run()
}

function insertContent(db, gameId, spec, crosswalk, dexRows, sourceSha) {
  const iconManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, spec.iconManifest), 'utf8'))
  const weaponNames = namesById(spec, 'ID_Wpn_Name.csv', 'Wpn_ID', 'Wpn_Name')
  const attributeNames = namesById(spec, 'ID_Wpn_SpAtk.csv', 'Wpn_SpAtk_ID', 'Wpn_SpAtk')
  const shotNames = namesById(spec, 'ID_Wpn_ShotType.csv', 'Wpn_ShotType_ID', 'Wpn_ShotType')
  const bowModeNames = namesById(spec, 'ID_Wpn_BowShot.csv', 'Wpn_BowShot_ID', 'Wpn_BowShot')
  const phialNames = namesById(spec, 'ID_Wpn_AxePhial.csv', 'Wpn_AxePhial_ID', 'Wpn_AxePhial')
  const kinsectNames = namesById(spec, 'ID_Wpn_ISKinsectType.csv', 'Wpn_ISKinsectType_ID', 'Wpn_ISKinsectType')
  const reloadNames = namesById(spec, 'ID_Wpn_GunReloadSpd.csv', 'Wpn_GunReloadSpd_ID', 'Wpn_GunReloadSpd')
  const recoilNames = namesById(spec, 'ID_Wpn_GunRecoil.csv', 'Wpn_GunRecoil_ID', 'Wpn_GunRecoil')
  const steadinessNames = namesById(spec, 'ID_Wpn_GunSteadiness.csv', 'Wpn_GunSteadiness_ID', 'Wpn_GunSteadiness')
  const rapidNames = namesById(spec, 'ID_Wpn_RapidFireGap.csv', 'Wpn_RapidFireGap_ID', 'Wpn_RapidFireGap')
  const recitalNames = namesById(spec, 'ID_Wpn_RecitalEffect.csv', 'Wpn_RecitalEffect_ID', 'Wpn_RecitalEffect')
  const itemNames = namesById(spec, 'ID_Itm_Name.csv', 'Itm_ID', 'Itm_Name')
  const itemSaveByDex = new Map(db.prepare('SELECT dex_id, save_id FROM catalog_items WHERE game_id = ? AND dex_id IS NOT NULL').all(gameId).map((row) => [row.dex_id, row.save_id]))
  const dexById = new Map(dexRows.map((row) => [integer(row.Wpn_ID), row]))
  const dexToKey = new Map()
  const keyToDex = new Map()
  const source = `dex:${sourceSha.slice(0, 16)}`

  const insertType = db.prepare('INSERT INTO catalog_weapon_types VALUES (?,?,?,?,?,?,?)')
  for (let typeId = 1; typeId <= spec.saveTypes.length; typeId += 1) {
    const [nameCn, nameEn] = gameId === 'mh3g' && typeId >= 10 ? WEAPON_TYPES[typeId + 1] : WEAPON_TYPES[typeId - 1]
    insertType.run(gameId, typeId, spec.saveTypes[typeId - 1], nameCn, nameEn, typeId, `Wpn_${String(typeId).padStart(2, '0')}`)
  }

  const insertWeapon = db.prepare(`INSERT INTO catalog_weapons VALUES
    (@game_id,@weapon_key,@type_id,@save_type,@save_id,@save_level,@display_level,@dex_id,
     @name_cn,@name_en,@name_jp,@rarity,@display_attack,@true_raw_attack,@affinity,@defense,@slots,
     @production_price,@upgrade_price,@is_directly_producible,@is_final_form,@icon_path,@preview_path,
     @is_placeholder,@mapping_status,@source)`)
  const insertDexSource = db.prepare('INSERT INTO catalog_weapon_dex_sources VALUES (?,?,?,?,?)')
  const insertAttribute = db.prepare('INSERT INTO catalog_weapon_attributes VALUES (?,?,?,?,?,?,?,?,?,?)')
  const insertSharpness = db.prepare('INSERT INTO catalog_weapon_sharpness VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertHorn = db.prepare('INSERT INTO catalog_weapon_hunting_horns VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertGunlance = db.prepare('INSERT INTO catalog_weapon_gunlances VALUES (?,?,?,?,?,?)')
  const insertPhial = db.prepare('INSERT INTO catalog_weapon_phials VALUES (?,?,?,?,?,?,?)')
  const insertInsect = db.prepare('INSERT INTO catalog_weapon_insect_glaives VALUES (?,?,?,?,?,?)')
  const insertBowgun = db.prepare('INSERT INTO catalog_weapon_bowguns VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  const insertBow = db.prepare('INSERT INTO catalog_weapon_bows VALUES (?,?,?,?,?,?,?)')
  const insertCharge = db.prepare('INSERT INTO catalog_weapon_bow_charges VALUES (?,?,?,?,?,?,?,?)')

  for (const entry of crosswalk.filter((value) => !value.excluded)) {
    const authority = entry.authority
    const dex = entry.dex
    const typeId = dex ? integer(dex.Wpn_Type_ID) : spec.saveTypes.indexOf(authority.save_type) + 1
    const key = weaponKey(gameId, authority)
    const names = dex ? weaponNames.get(integer(dex.Wpn_ID)) : null
    const rarity = dex ? integer(dex.Rare) : integer(authority.rarity, 0)
    const iconKey = dex ? `Wpn_${String(typeId).padStart(2, '0')}${String(rarity).padStart(2, '0')}` : null
    const iconPath = iconKey ? iconManifest.icons?.[iconKey] ?? null : null
    const placeholder = !dex
    insertWeapon.run({
      game_id: gameId, weapon_key: key, type_id: typeId, save_type: authority.save_type,
      save_id: authority.save_id, save_level: authority.save_level ?? null,
      display_level: authority.display_level ?? (authority.save_level == null ? null : authority.save_level + 1),
      dex_id: dex ? integer(dex.Wpn_ID) : null,
      name_cn: clean(names?.cn) || clean(authority.name_cn), name_en: clean(names?.en) || clean(authority.name_en),
      name_jp: clean(names?.jp), rarity, display_attack: dex ? integer(dex.Atk) : integer(authority.attack),
      true_raw_attack: null, affinity: dex ? decimal(dex.Affinity) : decimal(authority.affinity),
      defense: dex ? integer(dex.Def) : integer(authority.defense), slots: dex ? integer(dex.Slot) : integer(authority.slots),
      production_price: dex ? integer(dex.ProPx) : null, upgrade_price: dex ? integer(dex.LvUpPx) : null,
      is_directly_producible: dex && integer(dex.ProPx, 0) > 0 ? 1 : 0,
      is_final_form: dex && integer(dex.Child, 0) === 0 ? 1 : 0, icon_path: iconPath,
      preview_path: null, is_placeholder: placeholder ? 1 : 0, mapping_status: entry.classification,
      source: `${source}+${clean(authority.source) || 'save-authority'}`,
    })
    if (!dex) continue
    const dexId = integer(dex.Wpn_ID)
    dexToKey.set(dexId, key)
    keyToDex.set(key, dexId)
    insertDexSource.run(gameId, key, dexId, 'primary', source)
    for (const alias of entry.dexAliases ?? []) {
      const aliasId = integer(alias.Wpn_ID)
      dexToKey.set(aliasId, key)
      insertDexSource.run(gameId, key, aliasId, 'duplicate-derived-alias', source)
    }
    for (const position of [1, 2]) {
      const id = integer(dex[`SpAtk${position}_ID`])
      const rawPoints = integer(dex[`SpAtk${position}_Pt`])
      const absent = id == null || id < 0 || rawPoints == null || (gameId === 'mhgu' && rawPoints < 0) || rawPoints === 0
      if (absent) continue
      const name = attributeNames.get(id)
      if (!name?.cn || !name?.en) throw new Error(`${gameId} weapon ${dexId}: unknown attribute ${id}`)
      insertAttribute.run(gameId, key, position, id, normalize(name.en), name.cn, name.en, Math.abs(rawPoints), gameId !== 'mhgu' && rawPoints < 0 ? 1 : 0, source)
    }
    const isRemote = gameId === 'mh3g' ? typeId >= 10 : typeId >= 12
    if (!isRemote) {
      const segments = parseSharpness(dex.Sharp)
      const total = segments.reduce((sum, value) => sum + value, 0)
      const extendable = integer(dex.SharpP1, 0) === 1
      const base = extendable ? total - (spec.handicraftStages === 3 ? 10 : 5) : total
      const plus1 = extendable ? total - (spec.handicraftStages === 3 ? 5 : 0) : total
      if (base < 0 || plus1 < base) throw new Error(`${gameId} weapon ${dexId}: invalid sharpness cutoffs`)
      insertSharpness.run(gameId, key, ...segments, base, plus1, spec.handicraftStages === 3 ? total : null, clean(dex.Sharp), `dex-sharpness-v1-${spec.handicraftStages}-stages`, source)
    }
    if (typeId === 6) {
      const notes = [1, 2, 3].map((position) => integer(dex[`HHNote${position}_ID`]))
      const labels = notes.map((id) => NOTE_NAMES.get(id))
      if (labels.some((label) => !label)) throw new Error(`${gameId} weapon ${dexId}: unknown hunting horn note`)
      insertHorn.run(gameId, key, notes[0], ...labels[0], notes[1], ...labels[1], notes[2], ...labels[2], source)
    }
    if (typeId === 8) {
      const id = integer(dex.GLShotType_ID), name = shotNames.get(id)
      if (!name?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown gunlance shot ${id}`)
      insertGunlance.run(gameId, key, id, name.cn, name.en, source)
    }
    if (typeId === 9 || (gameId !== 'mh3g' && typeId === 10)) {
      const id = integer(dex.AxePhial_ID), name = phialNames.get(id)
      if (!name?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown phial ${id}`)
      insertPhial.run(gameId, key, typeId === 9 ? 'switch-axe' : 'charge-blade', id, name.cn, name.en, source)
    }
    if (gameId !== 'mh3g' && typeId === 11) {
      const id = integer(dex.ISKinsectType_ID), name = kinsectNames.get(id)
      if (!name?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown kinsect type ${id}`)
      insertInsect.run(gameId, key, id, name.cn, name.en, source)
    }
    if ((gameId === 'mh3g' && (typeId === 10 || typeId === 11)) || (gameId !== 'mh3g' && (typeId === 12 || typeId === 13))) {
      const reloadId = integer(dex.GunReloadSpd_ID), recoilId = integer(dex.GunRecoil_ID), steadinessId = integer(dex.GunSteadiness_ID)
      const reload = reloadNames.get(reloadId), recoil = recoilNames.get(recoilId), steadiness = steadinessNames.get(steadinessId)
      if (!reload?.cn || !recoil?.cn || !steadiness?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown bowgun enum`)
      insertBowgun.run(gameId, key, reloadId, reload.cn, reload.en, recoilId, recoil.cn, recoil.en, steadinessId, steadiness.cn, steadiness.en, source)
    }
    if ((gameId === 'mh3g' && typeId === 12) || (gameId !== 'mh3g' && typeId === 14)) {
      const modeId = integer(dex.BowShot_ID), mode = bowModeNames.get(modeId)
      if (!mode?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown bow mode ${modeId}`)
      const loadUp = integer(dex.SharpP1, 0) === 1 ? 4 : null
      insertBow.run(gameId, key, modeId, mode.cn, mode.en, loadUp, source)
      for (let level = 1; level <= 4; level += 1) {
        const shotId = integer(dex[`BowShotType${level}_ID`]), shot = shotNames.get(shotId)
        if (!shot?.cn) throw new Error(`${gameId} weapon ${dexId}: unknown bow charge ${shotId}`)
        insertCharge.run(gameId, key, level, shotId, shot.cn, shot.en, loadUp === level ? 1 : 0, source)
      }
    }
  }

  const rawGraph = graphFor(dexRows)
  const insertEdge = db.prepare('INSERT OR IGNORE INTO catalog_weapon_edges VALUES (?,?,?,?,?,?,?)')
  let mappedEdges = 0
  for (const edge of rawGraph.edges) {
    const parent = dexToKey.get(edge.parentDexId), child = dexToKey.get(edge.childDexId)
    if (!parent || !child || parent === child) continue
    insertEdge.run(gameId, parent, child, edge.branchOrder, 'upgrade', 'confirmed-dex-preorder', source)
    mappedEdges += 1
  }

  const materialRows = parseCsv(dexPath(spec, 'DB_ItmtoWpn.csv'))
  const insertMaterial = db.prepare('INSERT INTO catalog_weapon_materials (game_id,weapon_key,material_kind,item_save_id,item_dex_id,quantity,source) VALUES (?,?,?,?,?,?,?)')
  const materialMisses = []
  const productionKinds = new Set()
  for (const row of materialRows) {
    const key = dexToKey.get(integer(row.Wpn_ID))
    if (!key) continue
    const itemDexId = integer(row.Itm_ID), itemSaveId = itemSaveByDex.get(itemDexId)
    if (itemSaveId == null) { materialMisses.push({ dexId: integer(row.Wpn_ID), itemDexId }); continue }
    const kind = clean(row.Type) === 'P' ? 'production' : 'upgrade'
    if (kind === 'production') productionKinds.add(key)
    insertMaterial.run(gameId, key, kind, itemSaveId, itemDexId, integer(row.Qty, 0), source)
  }
  db.prepare(`UPDATE catalog_weapons SET is_directly_producible = 1 WHERE game_id = ? AND EXISTS (
    SELECT 1 FROM catalog_weapon_materials m WHERE m.game_id = catalog_weapons.game_id
    AND m.weapon_key = catalog_weapons.weapon_key AND m.material_kind = 'production')`).run(gameId)

  const hornSongs = parseCsv(dexPath(spec, 'DB_HHSong.csv'))
  const songsByIdRank = new Map(hornSongs.map((row) => [`${row.HHSong_ID}:${row.HHSongRank_ID}`, row]))
  const insertSong = db.prepare('INSERT OR IGNORE INTO catalog_weapon_horn_songs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  for (const relation of parseCsv(dexPath(spec, 'DB_HHSongtoWpn.csv'))) {
    const key = dexToKey.get(integer(relation.Wpn_ID))
    if (!key) continue
    const song = songsByIdRank.get(`${relation.HHSong_ID}:${relation.HHSongRank_ID}`)
    if (!song) throw new Error(`${gameId}: missing horn song ${relation.HHSong_ID}/${relation.HHSongRank_ID}`)
    const effect = recitalNames.get(integer(song.RecitalEffect_ID)), encore = recitalNames.get(integer(song.RecitalEffect2_ID))
    if (!effect?.cn) throw new Error(`${gameId}: unknown recital effect ${song.RecitalEffect_ID}`)
    const notes = [song.Note1_ID, song.Note2_ID, song.Note3_ID, song.Note4_ID].map(integer).filter((id) => id > 0).map((id) => NOTE_NAMES.get(id)?.[0]).join('')
    insertSong.run(gameId, key, integer(song.HHSong_ID), integer(song.HHSongRank_ID), notes, effect.cn, effect.en, encore?.cn ?? null, encore?.en ?? null, integer(song.Duration), integer(song.Duration_M), source)
  }

  const insertAmmo = db.prepare(`INSERT INTO catalog_weapon_gun_ammo
    (game_id,weapon_key,item_save_id,item_dex_id,ammo_name_cn,ammo_name_en,load_quantity,load_quantity_plus,max_carry,
     special_fire_quantity,rapid_fire_gap_id,rapid_fire_gap_name_cn,rapid_fire_gap_name_en,action_kind,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const row of parseCsv(dexPath(spec, 'DB_Wpn_Gun.csv'))) {
    const key = dexToKey.get(integer(row.Wpn_ID))
    if (!key) continue
    const dexId = keyToDex.get(key), weapon = dexById.get(dexId)
    const typeId = integer(weapon.Wpn_Type_ID), itemDexId = integer(row.Itm_ID), itemName = itemNames.get(itemDexId)
    if (!itemName?.cn || itemDexId < 0) continue
    const gapId = integer(row.RapidFireGap_ID), gap = rapidNames.get(gapId)
    const special = integer(row.SpFireQty, -1)
    const lightBowgunType = gameId === 'mh3g' ? 10 : 12
    const heavyBowgunType = gameId === 'mh3g' ? 11 : 13
    const bowType = gameId === 'mh3g' ? 12 : 14
    const action = typeId === lightBowgunType && special > 0 ? 'rapid-fire' : typeId === heavyBowgunType && special > 0 ? 'siege-fire' : typeId === bowType ? 'coating' : 'standard'
    insertAmmo.run(gameId, key, itemSaveByDex.get(itemDexId) ?? null, itemDexId, itemName.cn, itemName.en,
      integer(row.LoadQty, 0), integer(row.LoadQtyP), integer(row.Max), special, gapId,
      gap?.cn ?? null, gap?.en ?? null, action, source)
  }

  if (gameId === 'mhgu') {
    const insertVariant = db.prepare('INSERT INTO catalog_weapon_content_variants VALUES (?,?,?,?,?,?,?,?,?)')
    const key = [...dexToKey.values()].find((weaponKeyValue) => weaponKeyValue === '7:60:0')
    if (key) {
      const guFile = path.join(researchRoot, 'mhgu/romfs/mhgu-table/weapon00BaseData.w00d')
      const xxFile = path.join(researchRoot, 'mhgu/romfs/mhxx-table/weapon00BaseData.w00d')
      insertVariant.run(gameId, key, 'mhgu-switch', 'model_resource_id', 134, null, 'D:\\MH\\unpack\\mhgu\\romfs\\nativeNX\\table\\weapon00BaseData.w00d', fileSha256(guFile), 'decoded-record-family-60-offset-6')
      insertVariant.run(gameId, key, 'mhxx-3ds', 'model_resource_id', 112, null, 'D:\\MH\\unpack\\mhxx\\cci_unpacked\\romfs\\table\\weapon00BaseData.w00d', fileSha256(xxFile), 'decoded-record-family-60-offset-6')
    }
  }

  const productionPriceMismatches = db.prepare(`SELECT weapon_key, production_price, 'price-without-production-materials' reason FROM catalog_weapons
      WHERE game_id = ? AND is_placeholder = 0 AND production_price > 0
      AND NOT EXISTS (SELECT 1 FROM catalog_weapon_materials m WHERE m.game_id = catalog_weapons.game_id AND m.weapon_key = catalog_weapons.weapon_key AND m.material_kind = 'production')`).all(gameId)
  const zeroPriceProductionRecipes = db.prepare(`SELECT weapon_key, production_price, 'production-materials-with-zero-price' reason FROM catalog_weapons
      WHERE game_id = ? AND is_placeholder = 0 AND COALESCE(production_price, 0) <= 0
      AND EXISTS (SELECT 1 FROM catalog_weapon_materials m WHERE m.game_id = catalog_weapons.game_id AND m.weapon_key = catalog_weapons.weapon_key AND m.material_kind = 'production')`).all(gameId)
  const storedEdges = db.prepare('SELECT count(*) count FROM catalog_weapon_edges WHERE game_id = ?').get(gameId).count
  return { dexToKey, rawGraph, mappedEdges: storedEdges, materialMisses, productionKinds: productionKinds.size, productionPriceMismatches, zeroPriceProductionRecipes }
}

function canonicalDigest(db, gameId) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'catalog_weapon%' ORDER BY name").all().map((row) => row.name)
  const hash = crypto.createHash('sha256')
  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)
    const rows = db.prepare(`SELECT * FROM ${table} WHERE game_id = ? ORDER BY ${columns.join(',')}`).all(gameId)
    hash.update(`${table}\0${JSON.stringify(rows)}\0`)
  }
  return hash.digest('hex')
}

function buildGame(gameId, spec) {
  const dexRoot = path.join(researchRoot, spec.dex)
  const sourceManifest = path.join(dexRoot, 'source-manifest.json')
  if (!fs.existsSync(sourceManifest)) throw new Error(`${gameId}: missing ${sourceManifest}`)
  const snapshot = verifySourceSnapshot(sourceManifest, dexRoot)
  const required = ['DB_Wpn.csv', 'ID_Wpn_Name.csv', 'DB_ItmtoWpn.csv', 'DB_Wpn_Gun.csv', 'DB_HHSong.csv', 'DB_HHSongtoWpn.csv']
  for (const file of required) if (!fs.existsSync(dexPath(spec, file))) throw new Error(`${gameId}: missing Dex input ${file}`)
  const sourceFiles = required.concat([
    'ID_Wpn_SpAtk.csv', 'ID_Wpn_ShotType.csv', 'ID_Wpn_BowShot.csv', 'ID_Wpn_AxePhial.csv',
    'ID_Wpn_GunReloadSpd.csv', 'ID_Wpn_GunSteadiness.csv', 'ID_Wpn_GunRecoil.csv',
    'ID_Wpn_RapidFireGap.csv', 'ID_Wpn_RecitalEffect.csv', 'ID_Itm_Name.csv',
  ]).filter((file) => fs.existsSync(dexPath(spec, file)))
  const sourceHashes = Object.fromEntries(sourceFiles.sort().map((file) => [file, fileSha256(dexPath(spec, file))]))
  sourceHashes['source-manifest.json'] = fileSha256(sourceManifest)
  sourceHashes[path.basename(spec.iconManifest)] = fileSha256(path.join(projectRoot, spec.iconManifest))
  if (gameId === 'mhgu') {
    sourceHashes['mhgu-table/weapon00BaseData.w00d'] = fileSha256(path.join(researchRoot, 'mhgu/romfs/mhgu-table/weapon00BaseData.w00d'))
    sourceHashes['mhxx-table/weapon00BaseData.w00d'] = fileSha256(path.join(researchRoot, 'mhgu/romfs/mhxx-table/weapon00BaseData.w00d'))
  }
  const sourceSha = sha256(JSON.stringify(sourceHashes))
  const dexRows = parseCsv(dexPath(spec, 'DB_Wpn.csv')).sort((left, right) => integer(left.Wpn_ID) - integer(right.Wpn_ID))
  const db = new Database(path.join(projectRoot, spec.database))
  db.pragma('foreign_keys = ON')
  createSchema(db)
  const crosswalk = gameId === 'mh3g' ? mh3gCrosswalk(db, dexRows) : gameId === 'mh4g' ? mh4gCrosswalk(db, dexRows, spec) : mhguCrosswalk(db, dexRows, spec)
  let inserted
  db.transaction(() => {
    clearGame(db, gameId)
    inserted = insertContent(db, gameId, spec, crosswalk, dexRows, sourceSha)
  })()

  const expected = { mh3g: [1421, 1238, 183], mh4g: [2331, 1930, 401], mhgu: [10911, 10117, 794] }[gameId]
  const rawGraph = inserted.rawGraph
  if (dexRows.length !== expected[0] || rawGraph.edges.length !== expected[1] || rawGraph.roots.length !== expected[2]) {
    throw new Error(`${gameId}: derivation invariant failed (${dexRows.length}/${rawGraph.edges.length}/${rawGraph.roots.length})`)
  }
  const formal = db.prepare('SELECT count(*) count FROM catalog_weapons WHERE game_id = ? AND is_placeholder = 0').get(gameId).count
  const missingIcons = db.prepare('SELECT weapon_key,name_cn FROM catalog_weapons WHERE game_id = ? AND is_placeholder = 0 AND icon_path IS NULL').all(gameId)
  const remoteStart = gameId === 'mh3g' ? 10 : 12
  const missingSharpness = db.prepare(`SELECT weapon_key,name_cn FROM catalog_weapons WHERE game_id = ? AND is_placeholder = 0 AND type_id < ${remoteStart}
    AND NOT EXISTS (SELECT 1 FROM catalog_weapon_sharpness s WHERE s.game_id = catalog_weapons.game_id AND s.weapon_key = catalog_weapons.weapon_key)`).all(gameId)
  const unknownEnums = []
  const crosswalkRows = crosswalk.map((entry) => ({
    saveType: entry.authority.save_type, saveId: entry.authority.save_id,
    saveLevel: entry.authority.save_level ?? null, nameCn: entry.authority.name_cn,
    nameEn: entry.authority.name_en, dexId: entry.dex ? integer(entry.dex.Wpn_ID) : null,
    classification: entry.classification, included: !entry.excluded,
  }))
  const audit = {
    format: 'mh-save-edit-weapon-audit-v1', gameId, sourceSha256: sourceSha,
    input: { dexRows: dexRows.length, snapshot, sourceFiles: sourceHashes },
    derivation: { nodes: dexRows.length, edges: rawGraph.edges.length, roots: rawGraph.roots.length, mappedEdges: inserted.mappedEdges },
    crosswalk: {
      identities: crosswalk.length, includedFormal: formal,
      placeholders: crosswalkRows.filter((row) => row.classification.startsWith('placeholder')).length,
      excluded: crosswalkRows.filter((row) => !row.included).length,
      excludedRelics: gameId === 'mh4g' ? 435 : 0,
      ignoredDexNodes: gameId === 'mh4g' ? [
        ...[...spec.duplicateDexAliases].map(([dexId, primaryDexId]) => ({ dexId, primaryDexId, classification: 'duplicate-derived-alias' })),
        ...[...spec.ignoredDexIds].map(([dexId, classification]) => ({ dexId, classification })),
      ] : [],
    },
    integrity: { missingIcons, missingSharpness, materialForeignKeyMisses: inserted.materialMisses, unknownEnums, productionPriceMismatches: inserted.productionPriceMismatches },
    observations: { zeroPriceProductionRecipes: inserted.zeroPriceProductionRecipes },
    guXxVariant: gameId === 'mhgu' ? { familyId: 60, name: '灼炎大剑', byteOffset: 1994, recordOffset: 6, field: 'model_resource_id', mhgu: 134, mhxx: 112 } : null,
  }
  const crosswalkReport = { format: 'mh-save-edit-weapon-crosswalk-v1', gameId, rows: crosswalkRows }
  const manifest = {
    format: 'mh-save-edit-weapon-catalog-v1', gameId, sourceSha256: sourceSha,
    builderSha256: fileSha256(import.meta.filename), contentSha256: canonicalDigest(db, gameId),
    counts: Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'catalog_weapon%' ORDER BY name").all().map(({ name }) => [name, db.prepare(`SELECT count(*) count FROM ${name} WHERE game_id = ?`).get(gameId).count])),
  }
  db.close()
  fs.mkdirSync(path.join(projectRoot, 'data/manifests'), { recursive: true })
  fs.writeFileSync(path.join(projectRoot, 'data/manifests', `${gameId}-weapons-crosswalk.json`), `${JSON.stringify(crosswalkReport, null, 2)}\n`)
  fs.writeFileSync(path.join(projectRoot, 'data/manifests', `${gameId}-weapons-audit.json`), `${JSON.stringify(audit, null, 2)}\n`)
  fs.writeFileSync(path.join(projectRoot, 'data/manifests', `${gameId}-weapons.json`), `${JSON.stringify(manifest, null, 2)}\n`)
  if (missingIcons.length || missingSharpness.length || inserted.materialMisses.length || unknownEnums.length) {
    throw new Error(`${gameId}: audit failed: icons=${missingIcons.length}, sharpness=${missingSharpness.length}, materialFK=${inserted.materialMisses.length}, enums=${unknownEnums.length}`)
  }
  console.log(`${gameId}: ${formal} weapons, ${rawGraph.edges.length} raw edges, content ${manifest.contentSha256.slice(0, 12)}`)
}

for (const [gameId, spec] of Object.entries(GAME_SPECS)) buildGame(gameId, spec)
