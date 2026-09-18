#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { mh4gTalismanRows, readStoredMh4gNative } from './runtime/mh4gCharmNative.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const researchIndex = args.indexOf('--research-root')
const researchRoot = path.resolve(projectRoot, researchIndex >= 0 ? args[researchIndex + 1] : '../research')
const dataRoot = path.join(researchRoot, 'generated/mh-save-edit/catalog/data')
const specs = {
  mh3g: { dex: 'mh3u/dex/mh3g-dex', skills: 126, activations: 238, components: 19 },
  mh4g: { dex: 'mh4g/dex/mh4g-dex', skills: 145, activations: 278, components: 55 },
  mhgu: { dex: 'mhgu/dex/mhxx-dex', skills: 206, activations: 327, components: 166 },
}
const requiredDexFiles = ['ID_SklTree_Name.csv', 'DB_Skl.csv', 'ID_Skl_Name.csv', 'ID_Skl_Des.csv', 'DB_CompSkl.csv']

const clean = value => String(value ?? '').trim()
const integer = (value, fallback = null) => {
  const parsed = Number.parseInt(clean(value), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
const normalize = value => clean(value).normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]+/gu, '')
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const fileSha256 = file => sha256(fs.readFileSync(file))

function csv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rows = []
  let row = [], field = '', quoted = false
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

function verifySnapshot(snapshotRoot) {
  const manifestFile = path.join(snapshotRoot, 'source-manifest.json')
  if (!fs.existsSync(manifestFile)) throw new Error(`缺少 Dex 来源清单：${manifestFile}`)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  const records = new Map((manifest.files ?? []).map(record => [record.path.replaceAll('\\', '/'), record]))
  const hashes = {}
  for (const name of requiredDexFiles) {
    const relative = `direct_sql/${name}`
    const file = path.join(snapshotRoot, relative)
    if (!fs.existsSync(file)) throw new Error(`缺少技能 Dex 表：${file}`)
    const actual = fileSha256(file)
    const expected = records.get(relative)?.sha256
    if (expected && expected.toLowerCase() !== actual) throw new Error(`${relative} 与来源清单 SHA-256 不一致`)
    hashes[relative] = actual
  }
  hashes['source-manifest.json'] = fileSha256(manifestFile)
  return hashes
}

function addColumn(db, table, definition) {
  const name = definition.trim().split(/\s+/)[0]
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().some(column => column.name === name)
  if (!existing) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

function ensureSchema(db) {
  addColumn(db, 'catalog_skills', 'dex_id INTEGER')
  addColumn(db, 'catalog_skills', "name_jp TEXT NOT NULL DEFAULT ''")
  addColumn(db, 'catalog_skills', 'description_cn TEXT')
  addColumn(db, 'catalog_skills', 'description_en TEXT')
  addColumn(db, 'catalog_skills', 'description_jp TEXT')
  addColumn(db, 'catalog_skills', 'is_placeholder INTEGER NOT NULL DEFAULT 0')
  addColumn(db, 'catalog_skills', "mapping_status TEXT NOT NULL DEFAULT 'legacy'")
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_skill_activations (
      game_id TEXT NOT NULL, activation_key TEXT NOT NULL, skill_id INTEGER NOT NULL,
      dex_activation_id INTEGER NOT NULL, threshold INTEGER NOT NULL, direction TEXT NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL,
      description_cn TEXT NOT NULL, description_en TEXT NOT NULL, description_jp TEXT NOT NULL,
      special_marker TEXT, source TEXT NOT NULL,
      PRIMARY KEY (game_id, activation_key),
      UNIQUE (game_id, dex_activation_id),
      FOREIGN KEY (game_id, skill_id) REFERENCES catalog_skills(game_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_skill_components (
      game_id TEXT NOT NULL, composite_activation_key TEXT NOT NULL, component_activation_key TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (game_id, composite_activation_key, component_activation_key),
      FOREIGN KEY (game_id, composite_activation_key) REFERENCES catalog_skill_activations(game_id, activation_key),
      FOREIGN KEY (game_id, component_activation_key) REFERENCES catalog_skill_activations(game_id, activation_key)
    );
    CREATE TABLE IF NOT EXISTS catalog_skill_talisman_ranges (
      game_id TEXT NOT NULL, range_key TEXT NOT NULL, skill_id INTEGER NOT NULL,
      talisman_id INTEGER NOT NULL, talisman_name_cn TEXT NOT NULL, talisman_name_en TEXT NOT NULL,
      position TEXT NOT NULL CHECK(position IN ('A','B')), slot_count INTEGER,
      min_points INTEGER NOT NULL, max_points INTEGER NOT NULL, max_slots INTEGER,
      range_status TEXT NOT NULL CHECK(range_status IN ('exact','rule','unknown')), source TEXT NOT NULL,
      PRIMARY KEY (game_id, range_key),
      FOREIGN KEY (game_id, skill_id) REFERENCES catalog_skills(game_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_build_metadata (
      domain TEXT NOT NULL, game_id TEXT NOT NULL, source_sha256 TEXT NOT NULL,
      builder_sha256 TEXT NOT NULL, PRIMARY KEY(domain,game_id)
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_skills_names ON catalog_skills(game_id, name_cn, name_en, name_jp);
    CREATE INDEX IF NOT EXISTS idx_catalog_skill_activation_tree ON catalog_skill_activations(game_id, skill_id, threshold);
    CREATE INDEX IF NOT EXISTS idx_catalog_skill_talisman_tree ON catalog_skill_talisman_ranges(game_id, skill_id, talisman_id, position);
  `)
}

function skillRows(db, gameId) {
  return db.prepare('SELECT skill_id,name_cn,name_en FROM catalog_skills WHERE game_id=? ORDER BY skill_id').all(gameId)
}

function buildCrosswalk(gameId, catalogRows, dexTrees) {
  const byName = new Map()
  for (const row of catalogRows) for (const name of [row.name_cn, row.name_en]) {
    const key = normalize(name)
    if (!key) continue
    const values = byName.get(key) ?? new Set()
    values.add(row.skill_id)
    byName.set(key, values)
  }
  const result = new Map()
  for (const row of dexTrees) {
    const dexId = integer(row.SklTree_ID)
    if (dexId == null || dexId < 0) continue
    const matches = new Set()
    for (const name of [row.SklTree_Name_1, row.SklTree_Name_0, row.SklTree_Name_3]) for (const value of byName.get(normalize(name)) ?? []) matches.add(value)
    if (matches.size !== 1) throw new Error(`${gameId}: Dex 技能系 ${dexId} ${row.SklTree_Name_1} 映射${matches.size ? '不唯一' : '缺失'}`)
    result.set(dexId, [...matches][0])
  }
  return result
}

function contiguousRanges(values) {
  const sorted = [...new Set(values)].sort((left, right) => left - right)
  const ranges = []
  for (const value of sorted) {
    const last = ranges.at(-1)
    if (last && value === last[1] + 1) last[1] = value
    else ranges.push([value, value])
  }
  return ranges
}

function talismanRows(db, gameId, skills) {
  const valid = new Set(skills.map(row => row.skill_id))
  const rows = []
  if (gameId === 'mh3g') {
    const classes = new Map(db.prepare('SELECT save_id,name_cn,name_en,source FROM charm_classes WHERE save_id>0').all().map(row => [row.save_id, row]))
    const groups = new Map()
    for (const row of db.prepare('SELECT class_id,slots,skill1_id,skill1_points,skill2_id,skill2_points FROM charm_combinations').iterate()) {
      for (const [position, skillId, points] of [['A', row.skill1_id, row.skill1_points], ['B', row.skill2_id, row.skill2_points]]) {
        if (!valid.has(skillId) || points === 0 || !classes.has(row.class_id)) continue
        const key = `${row.class_id}:${position}:${skillId}:${row.slots}`
        const group = groups.get(key) ?? { classId: row.class_id, position, skillId, slots: row.slots, points: [] }
        group.points.push(points); groups.set(key, group)
      }
    }
    for (const group of groups.values()) for (const [min, max] of contiguousRanges(group.points)) {
      const talisman = classes.get(group.classId)
      rows.push({ key: `${group.classId}:${group.position}:${group.skillId}:s${group.slots}:${min}:${max}`, skillId: group.skillId, talismanId: group.classId, nameCn: talisman.name_cn, nameEn: talisman.name_en, position: group.position, slotCount: group.slots, min, max, maxSlots: group.slots, status: 'exact', source: `${talisman.source}+charm_combinations` })
    }
  } else if (gameId === 'mh4g') {
    rows.push(...mh4gTalismanRows(db, skills))
  } else {
    const talismans = new Map(db.prepare('SELECT id,name,english,source,max_slots FROM cn__talismans WHERE id>0').all().map(row => [row.id, row]))
    for (const limit of db.prepare('SELECT * FROM cn__talisman_skill_limits WHERE talisman_id>0 AND skill_id>0').all()) {
      const talisman = talismans.get(limit.talisman_id)
      if (!talisman || !valid.has(limit.skill_id)) continue
      for (const [position, min, max] of [['A', limit.skill1_min, limit.skill1_max], ['B', limit.skill2_min, limit.skill2_max]]) {
        if (min === 0 && max === 0) continue
        rows.push({ key: `${limit.talisman_id}:${position}:${limit.skill_id}:${min}:${max}`, skillId: limit.skill_id, talismanId: limit.talisman_id, nameCn: talisman.name, nameEn: talisman.english, position, slotCount: null, min, max, maxSlots: talisman.max_slots, status: 'rule', source: limit.source })
      }
    }
  }
  return rows.sort((a, b) => a.skillId - b.skillId || a.talismanId - b.talismanId || a.position.localeCompare(b.position) || a.min - b.min || a.max - b.max || (a.slotCount ?? -1) - (b.slotCount ?? -1))
}

function buildGame(gameId, spec) {
  const snapshotRoot = path.join(researchRoot, spec.dex)
  const sourceHashes = verifySnapshot(snapshotRoot)
  const directSql = path.join(snapshotRoot, 'direct_sql')
  const dbFile = path.join(dataRoot, `${gameId}.sqlite`)
  if (!fs.existsSync(dbFile)) throw new Error(`缺少基础图鉴数据库：${dbFile}`)
  const db = new Database(dbFile)
  db.pragma('foreign_keys=ON')
  ensureSchema(db)
  if (gameId === 'mh4g') {
    sourceHashes.charmNative = sha256(JSON.stringify(readStoredMh4gNative(db)))
    sourceHashes.charmReference = sha256(JSON.stringify(db.prepare('SELECT * FROM charm_skill_ranges ORDER BY position,charm_source,skill_tree_id,min_points').all()))
  }
  const sourceSha256 = sha256(JSON.stringify(sourceHashes))
  const builderSha256 = sha256(fileSha256(import.meta.filename) + fileSha256(path.join(import.meta.dirname, 'runtime/mh4gCharmNative.mjs')))
  const previous = db.prepare("SELECT source_sha256,builder_sha256 FROM catalog_build_metadata WHERE domain='skills' AND game_id=?").get(gameId)
  if (previous?.source_sha256 === sourceSha256 && previous?.builder_sha256 === builderSha256) {
    const stats = skillStats(db, gameId)
    db.close()
    return { gameId, stats, sourceHashes, databaseSha256: fileSha256(dbFile), skipped: true }
  }
  const trees = csv(path.join(directSql, 'ID_SklTree_Name.csv')).filter(row => integer(row.SklTree_ID, -1) >= 0)
  const dexSkills = csv(path.join(directSql, 'DB_Skl.csv')).filter(row => integer(row.Skl_ID, -1) >= 0)
  const names = new Map(csv(path.join(directSql, 'ID_Skl_Name.csv')).map(row => [integer(row.Skl_ID), row]))
  const descriptions = new Map(csv(path.join(directSql, 'ID_Skl_Des.csv')).map(row => [integer(row.Skl_ID), row]))
  const componentRows = csv(path.join(directSql, 'DB_CompSkl.csv'))
  const existing = skillRows(db, gameId)
  const crosswalk = buildCrosswalk(gameId, existing, trees)
  const treeByDex = new Map(trees.map(row => [integer(row.SklTree_ID), row]))
  const activationByDex = new Map()
  const activations = dexSkills.map(row => {
    const dexActivationId = integer(row.Skl_ID)
    const dexTreeId = integer(row.SklTree_ID)
    const skillId = crosswalk.get(dexTreeId)
    if (skillId == null) throw new Error(`${gameId}: 发动技能 ${dexActivationId} 的技能系 ${dexTreeId} 未映射`)
    const threshold = integer(row.Pt, 0)
    const special = dexTreeId === 1 || (gameId === 'mhgu' && (dexTreeId === 204 || dexTreeId === 205))
    const direction = special ? 'special' : threshold < 0 ? 'negative' : 'positive'
    const value = { key: `dex:${dexActivationId}`, dexActivationId, dexTreeId, skillId, threshold, direction, name: names.get(dexActivationId) ?? {}, description: descriptions.get(dexActivationId) ?? {}, specialMarker: special ? clean(treeByDex.get(dexTreeId)?.SklTree_Name_0) : null }
    activationByDex.set(dexActivationId, value)
    return value
  })
  const components = componentRows.map((row, index) => {
    const componentId = integer(row.Skl_ID)
    const compositeId = integer(row.CompSkl_ID)
    const component = activationByDex.get(componentId)
    const composite = activationByDex.get(compositeId)
    if (!component || !composite) throw new Error(`${gameId}: 复合技能第 ${index + 1} 行端点未映射`)
    return { composite: composite.key, component: component.key, source: `DB_CompSkl.csv:${index + 2}` }
  })
  const treeRows = new Map(trees.map(row => [crosswalk.get(integer(row.SklTree_ID)), row]))
  const talismans = talismanRows(db, gameId, existing)
  const updateSkill = db.prepare(`UPDATE catalog_skills SET dex_id=?,name_cn=?,name_en=?,name_jp=?,description_cn=NULL,description_en=NULL,description_jp=NULL,is_placeholder=?,mapping_status=?,source=? WHERE game_id=? AND skill_id=?`)
  const insertActivation = db.prepare(`INSERT INTO catalog_skill_activations(game_id,activation_key,skill_id,dex_activation_id,threshold,direction,name_cn,name_en,name_jp,description_cn,description_en,description_jp,special_marker,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insertComponent = db.prepare('INSERT INTO catalog_skill_components(game_id,composite_activation_key,component_activation_key,source) VALUES(?,?,?,?)')
  const insertRange = db.prepare(`INSERT INTO catalog_skill_talisman_ranges(game_id,range_key,skill_id,talisman_id,talisman_name_cn,talisman_name_en,position,slot_count,min_points,max_points,max_slots,range_status,source) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  db.transaction(() => {
    db.prepare('DELETE FROM catalog_skill_components WHERE game_id=?').run(gameId)
    db.prepare('DELETE FROM catalog_skill_talisman_ranges WHERE game_id=?').run(gameId)
    db.prepare('DELETE FROM catalog_skill_activations WHERE game_id=?').run(gameId)
    for (const skill of existing) {
      const tree = treeRows.get(skill.skill_id)
      const dexId = tree ? integer(tree.SklTree_ID) : null
      const placeholder = skill.skill_id === 0 || /^(?:无|none|---)$/i.test(clean(skill.name_cn || skill.name_en))
      updateSkill.run(dexId, clean(tree?.SklTree_Name_1 || skill.name_cn), clean(tree?.SklTree_Name_0 || skill.name_en), clean(tree?.SklTree_Name_3), placeholder ? 1 : 0, tree ? 'confirmed-dex-crosswalk' : 'save-local', `${clean(skill.source)}${tree ? '+ID_SklTree_Name.csv' : ''}`, gameId, skill.skill_id)
    }
    for (const row of activations) insertActivation.run(gameId, row.key, row.skillId, row.dexActivationId, row.threshold, row.direction, clean(row.name.Skl_Name_1), clean(row.name.Skl_Name_0), clean(row.name.Skl_Name_3), clean(row.description.Skl_Des_1), clean(row.description.Skl_Des_0), clean(row.description.Skl_Des_3), row.specialMarker, `DB_Skl.csv:Skl_ID=${row.dexActivationId}+ID_Skl_Name.csv+ID_Skl_Des.csv`)
    for (const row of components) insertComponent.run(gameId, row.composite, row.component, row.source)
    for (const row of talismans) insertRange.run(gameId, row.key, row.skillId, row.talismanId, row.nameCn, row.nameEn, row.position, row.slotCount, row.min, row.max, row.maxSlots, row.status, row.source)
    db.prepare("INSERT OR REPLACE INTO catalog_build_metadata(domain,game_id,source_sha256,builder_sha256) VALUES('skills',?,?,?)").run(gameId, sourceSha256, builderSha256)
  })()
  const stats = skillStats(db, gameId)
  const invalidRanges = db.prepare("SELECT count(*) count FROM catalog_skill_talisman_ranges WHERE game_id=? AND (min_points>max_points OR (min_points=0 AND max_points=0) OR position NOT IN ('A','B'))").get(gameId).count
  const foreignKeys = db.pragma('foreign_key_check')
  if (stats.skills !== spec.skills || stats.activations !== spec.activations || stats.components !== spec.components || !stats.talismanRanges || invalidRanges || foreignKeys.length) throw new Error(`${gameId}: 技能审计失败 ${JSON.stringify({ stats, expected: spec, invalidRanges, foreignKeys })}`)
  db.exec('VACUUM')
  db.close()
  return { gameId, stats, sourceHashes, databaseSha256: fileSha256(dbFile) }
}

function skillStats(db, gameId) {
  return {
    skills: db.prepare('SELECT count(*) count FROM catalog_skills WHERE game_id=?').get(gameId).count,
    activations: db.prepare('SELECT count(*) count FROM catalog_skill_activations WHERE game_id=?').get(gameId).count,
    positive: db.prepare("SELECT count(*) count FROM catalog_skill_activations WHERE game_id=? AND direction='positive'").get(gameId).count,
    negative: db.prepare("SELECT count(*) count FROM catalog_skill_activations WHERE game_id=? AND direction='negative'").get(gameId).count,
    special: db.prepare("SELECT count(*) count FROM catalog_skill_activations WHERE game_id=? AND direction='special'").get(gameId).count,
    components: db.prepare('SELECT count(*) count FROM catalog_skill_components WHERE game_id=?').get(gameId).count,
    talismanRanges: db.prepare('SELECT count(*) count FROM catalog_skill_talisman_ranges WHERE game_id=?').get(gameId).count,
    armorRelations: db.prepare('SELECT count(*) count FROM catalog_armor_skills WHERE game_id=?').get(gameId).count,
    decorationRelations: db.prepare('SELECT count(*) count FROM catalog_decoration_skills WHERE game_id=?').get(gameId).count,
  }
}

fs.mkdirSync(path.join(dataRoot, 'manifests'), { recursive: true })
const games = Object.entries(specs).map(([gameId, spec]) => buildGame(gameId, spec))
const report = { format: 'mh-save-edit-skill-catalog-build-v1', builderSha256: fileSha256(import.meta.filename), games }
fs.writeFileSync(path.join(dataRoot, 'manifests/skill-catalog-build.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
