#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const index = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, index >= 0 ? args[index + 1] : '../research')
const dataRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const expected = { mh3g: [126, 238, 19], mh4g: [145, 278, 55], mhgu: [206, 327, 166] }
const results = []
for (const [gameId, [skills, activations, components]] of Object.entries(expected)) {
  const file = path.join(dataRoot, `${gameId}.sqlite`)
  if (!fs.existsSync(file)) throw new Error(`缺少技能图鉴数据库：${file}`)
  const db = new Database(file, { readonly: true, fileMustExist: true })
  const value = {
    skills: db.prepare('SELECT count(*) count FROM catalog_skills WHERE game_id=?').get(gameId).count,
    activations: db.prepare('SELECT count(*) count FROM catalog_skill_activations WHERE game_id=?').get(gameId).count,
    components: db.prepare('SELECT count(*) count FROM catalog_skill_components WHERE game_id=?').get(gameId).count,
    talismanRanges: db.prepare('SELECT count(*) count FROM catalog_skill_talisman_ranges WHERE game_id=?').get(gameId).count,
    invalidRanges: db.prepare("SELECT count(*) count FROM catalog_skill_talisman_ranges WHERE game_id=? AND (min_points>max_points OR (min_points=0 AND max_points=0) OR position NOT IN ('A','B'))").get(gameId).count,
    missingActivationText: db.prepare("SELECT count(*) count FROM catalog_skill_activations WHERE game_id=? AND (name_cn='' OR name_en='' OR name_jp='' OR description_cn='' OR description_en='' OR description_jp='')").get(gameId).count,
  }
  if (value.skills !== skills || value.activations !== activations || value.components !== components || !value.talismanRanges || value.invalidRanges || value.missingActivationText) throw new Error(`${gameId}: ${JSON.stringify(value)}`)
  const foreignKeys = db.pragma('foreign_key_check')
  if (foreignKeys.length) throw new Error(`${gameId}: foreign_key_check 失败`)
  db.close(); results.push({ gameId, ...value })
}
console.log(JSON.stringify({ format: 'mh-save-edit-skill-catalog-audit-v1', results }, null, 2))
