#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const rootIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, rootIndex >= 0 ? args[rootIndex + 1] : '../research')
const dataRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const reportRoot = path.join(researchRoot, 'generated/mh-save-edit/loadouts')
const builderSha = crypto.createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = (value) => value == null ? '' : String(value)

function table(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

function record(saveType, saveId, slots, rarity) {
  const bytes = new Uint8Array(28)
  bytes[0] = saveType & 255
  bytes[2] = saveId & 255
  bytes[3] = (saveId >>> 8) & 255
  bytes[0x10] = (Math.max(0, Math.min(3, slots)) & 3) << 2
  bytes[0x11] = Math.max(0, (rarity ?? 1) - 1) & 255
  return Buffer.from(bytes).toString('hex')
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_loadout_relic_weapon_templates(
      game_id TEXT NOT NULL, template_key TEXT NOT NULL, save_type INTEGER NOT NULL,
      save_id INTEGER NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL,
      type_id INTEGER NOT NULL, type_name_cn TEXT NOT NULL, rarity INTEGER,
      slots INTEGER NOT NULL, attack REAL, affinity REAL, defense REAL NOT NULL,
      record_hex TEXT NOT NULL, legality TEXT NOT NULL, encoding TEXT NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY(game_id,template_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_loadout_relic_armor_templates(
      game_id TEXT NOT NULL, template_key TEXT NOT NULL, save_type INTEGER NOT NULL,
      save_id INTEGER NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL,
      part TEXT NOT NULL, combat TEXT NOT NULL, gender TEXT NOT NULL, rarity INTEGER,
      slots INTEGER NOT NULL, base_defense REAL NOT NULL, max_defense REAL NOT NULL,
      fire_res REAL NOT NULL, water_res REAL NOT NULL, thunder_res REAL NOT NULL,
      ice_res REAL NOT NULL, dragon_res REAL NOT NULL, record_hex TEXT NOT NULL,
      legality TEXT NOT NULL, encoding TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,template_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_loadout_relic_value_lookups(
      game_id TEXT NOT NULL, lookup_kind TEXT NOT NULL, lookup_key TEXT NOT NULL,
      payload_json TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(game_id,lookup_kind,lookup_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_loadout_instance_sources(
      game_id TEXT NOT NULL, source_key TEXT NOT NULL, instance_kind TEXT NOT NULL,
      source_table TEXT NOT NULL, source_identity TEXT NOT NULL,
      record_sha256 TEXT NOT NULL, data_version TEXT NOT NULL,
      PRIMARY KEY(game_id,source_key)
    );
  `)
}

const summaries = []
for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
  const file = path.join(dataRoot, `${gameId}.sqlite`)
  if (!fs.existsSync(file)) throw new Error(`缺少基础图鉴数据库：${file}`)
  const db = new Database(file)
  createSchema(db)
  const invalidRaw = []

  db.transaction(() => {
    for (const name of [
      'catalog_loadout_relic_weapon_templates',
      'catalog_loadout_relic_armor_templates',
      'catalog_loadout_relic_value_lookups',
      'catalog_loadout_instance_sources',
    ]) db.prepare(`DELETE FROM ${name} WHERE game_id=?`).run(gameId)
    if (gameId !== 'mh4g') return
    if (!table(db, 'weapons') || !table(db, 'armors')) throw new Error('MH4G 缺少旧修改器发掘来源表')

    const types = new Map(db.prepare('SELECT save_type,type_id,name_cn FROM catalog_weapon_types WHERE game_id=?').all(gameId).map(row => [number(row.save_type), row]))
    const insertWeapon = db.prepare('INSERT INTO catalog_loadout_relic_weapon_templates VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    const insertArmor = db.prepare('INSERT INTO catalog_loadout_relic_armor_templates VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    const insertSource = db.prepare('INSERT INTO catalog_loadout_instance_sources VALUES(?,?,?,?,?,?,?)')
    const insertLookup = db.prepare('INSERT INTO catalog_loadout_relic_value_lookups VALUES(?,?,?,?,?)')

    for (const row of db.prepare('SELECT * FROM weapons WHERE is_relic=1 ORDER BY save_type,save_id').all()) {
      const saveType = number(row.save_type)
      const saveId = number(row.save_id)
      const type = types.get(saveType) ?? { type_id: 0, name_cn: '未知武器' }
      const hex = record(saveType, saveId, number(row.slots), row.rarity == null ? null : number(row.rarity))
      if (text(row.raw_hex) && text(row.raw_hex).length !== 56) invalidRaw.push({ kind: 'weapon', saveType, saveId, length: text(row.raw_hex).length })
      const key = `w:${saveType}:${saveId}`
      insertWeapon.run(gameId, key, saveType, saveId, text(row.name_cn), text(row.name_en), number(type.type_id), text(type.name_cn), row.rarity == null ? null : number(row.rarity), number(row.slots), row.attack == null ? null : number(row.attack), row.affinity == null ? null : number(row.affinity), number(row.defense), hex, 'unknown', 'encodable', 'generated-minimal-confirmed-fields')
      insertSource.run(gameId, `relic:${key}`, 'relicWeapon', 'weapons', `${saveType}:${saveId}`, sha(hex), 'loadout-v2')
    }

    const parts = { 1: 'chest', 2: 'arms', 3: 'waist', 4: 'legs', 5: 'head' }
    for (const row of db.prepare('SELECT * FROM armors WHERE is_relic=1 ORDER BY save_type,save_id').all()) {
      const saveType = number(row.save_type)
      const saveId = number(row.save_id)
      const hex = record(saveType, saveId, number(row.slots), row.rarity == null ? null : number(row.rarity))
      if (text(row.raw_hex) && text(row.raw_hex).length !== 56) invalidRaw.push({ kind: 'armor', saveType, saveId, length: text(row.raw_hex).length })
      const key = `a:${saveType}:${saveId}`
      const combat = number(row.combat) === 1 ? 'blademaster' : number(row.combat) === 2 ? 'gunner' : 'both'
      const gender = number(row.gender) === 1 ? 'male' : number(row.gender) === 2 ? 'female' : 'both'
      insertArmor.run(gameId, key, saveType, saveId, text(row.name_cn), text(row.name_en), parts[saveType] ?? 'head', combat, gender, row.rarity == null ? null : number(row.rarity), number(row.slots), number(row.base_defense), number(row.max_defense), number(row.fire_res), number(row.water_res), number(row.thunder_res), number(row.ice_res), number(row.dragon_res), hex, 'unknown', 'encodable', 'generated-minimal-confirmed-fields')
      insertSource.run(gameId, `relic:${key}`, 'relicArmor', 'armors', `${saveType}:${saveId}`, sha(hex), 'loadout-v2')
    }

    for (const source of ['relic_weapon_attack_values', 'relic_armor_defense_values', 'relic_armor_resistance_values']) {
      if (!table(db, source)) continue
      for (const [index, row] of db.prepare(`SELECT * FROM ${source}`).all().entries()) insertLookup.run(gameId, source, String(index), JSON.stringify(row), source)
    }

    if (!table(db, 'equipment_lookups')) throw new Error('MH4G 缺少发掘装备枚举表 equipment_lookups')
    const lookupRows = db.prepare('SELECT * FROM equipment_lookups ORDER BY domain,save_type,variant,code').all()
    for (const row of lookupRows) {
      const key = `${text(row.domain)}:${number(row.save_type)}:${text(row.variant)}:${number(row.code)}`
      insertLookup.run(gameId, 'equipment_lookup', key, JSON.stringify(row), text(row.source) || 'equipment_lookups')
    }
  })()

  const sourceRows = gameId === 'mh4g' ? {
    weapons: db.prepare('SELECT save_type,save_id,raw_hex FROM weapons WHERE is_relic=1 ORDER BY save_type,save_id').all(),
    armors: db.prepare('SELECT save_type,save_id,raw_hex FROM armors WHERE is_relic=1 ORDER BY save_type,save_id').all(),
    equipmentLookups: db.prepare('SELECT domain,save_type,variant,code,name_cn,name_en,source FROM equipment_lookups ORDER BY domain,save_type,variant,code').all(),
  } : {}
  db.prepare('INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES(?,?,?,?)').run('loadouts', gameId, sha(JSON.stringify(sourceRows)), builderSha)
  const summary = {
    gameId,
    weapons: number(db.prepare('SELECT count(*) value FROM catalog_loadout_relic_weapon_templates WHERE game_id=?').get(gameId)?.value),
    armors: number(db.prepare('SELECT count(*) value FROM catalog_loadout_relic_armor_templates WHERE game_id=?').get(gameId)?.value),
    lookups: number(db.prepare('SELECT count(*) value FROM catalog_loadout_relic_value_lookups WHERE game_id=?').get(gameId)?.value),
    editorLookups: number(db.prepare("SELECT count(*) value FROM catalog_loadout_relic_value_lookups WHERE game_id=? AND lookup_kind='equipment_lookup'").get(gameId)?.value),
    invalidLegacyRaw: invalidRaw,
  }
  db.close()
  summaries.push(summary)
}

fs.mkdirSync(reportRoot, { recursive: true })
const report = { format: 'mh-save-edit-loadout-catalog-v2', summaries }
fs.writeFileSync(path.join(reportRoot, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`)
const consoleSummary = { format: report.format, summaries: summaries.map(({ invalidLegacyRaw, ...summary }) => ({ ...summary, invalidLegacyRawCount: invalidLegacyRaw.length })) }
console.log(JSON.stringify(consoleSummary, null, 2))
