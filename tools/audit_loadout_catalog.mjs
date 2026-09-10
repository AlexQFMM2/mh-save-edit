#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const index = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, index >= 0 ? args[index + 1] : '../research')
const dataRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const results = []

for (const gameId of ['mh3g', 'mh4g', 'mhgu']) {
  const file = path.join(dataRoot, `${gameId}.sqlite`)
  if (!fs.existsSync(file)) throw new Error(`缺少配装数据库：${file}`)
  const db = new Database(file, { readonly: true, fileMustExist: true })
  const count = (name) => db.prepare(`SELECT count(*) value FROM ${name} WHERE game_id=?`).get(gameId).value
  const invalid = (name) => db.prepare(`SELECT count(*) value FROM ${name} WHERE game_id=? AND (length(record_hex)<>56 OR record_hex GLOB '*[^0-9a-f]*' OR encoding<>'encodable')`).get(gameId).value
  const value = {
    gameId,
    weapons: count('catalog_loadout_relic_weapon_templates'),
    armors: count('catalog_loadout_relic_armor_templates'),
    editorLookups: db.prepare("SELECT count(*) value FROM catalog_loadout_relic_value_lookups WHERE game_id=? AND lookup_kind='equipment_lookup'").get(gameId).value,
    invalidWeaponRecords: invalid('catalog_loadout_relic_weapon_templates'),
    invalidArmorRecords: invalid('catalog_loadout_relic_armor_templates'),
    foreignKeys: db.pragma('foreign_key_check').length,
  }
  db.close()
  if (value.invalidWeaponRecords || value.invalidArmorRecords || value.foreignKeys) throw new Error(`${gameId}: ${JSON.stringify(value)}`)
  if (gameId === 'mh4g' && (value.weapons !== 435 || value.armors !== 1250 || value.editorLookups !== 2752)) throw new Error(`MH4G 发掘数据数量错误：${JSON.stringify(value)}`)
  if (gameId !== 'mh4g' && (value.weapons || value.armors || value.editorLookups)) throw new Error(`${gameId} 不应存在发掘数据`)
  results.push(value)
}

console.log(JSON.stringify({ format: 'mh-save-edit-loadout-audit-v2', results }, null, 2))
