#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const root = path.resolve(import.meta.dirname, '..')
const specs = {
  mh3g: { db: 'data/mh3g.sqlite', dex: '/tmp/mh3g-dex-direct-sql', visible: 196 },
  mh4g: { db: 'data/mh4g.sqlite', dex: '/tmp/mh4g-dex-direct-sql', visible: 289 },
  mhgu: { db: 'data/mhgu.sqlite', dex: '/tmp/mhxx-dex-direct-sql', visible: 242 },
}

function csv(file) {
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
const clean = (value) => String(value ?? '').trim()
const normalize = (value) => clean(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9\p{L}]/gu, '')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

function distance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_decorations (
      game_id TEXT NOT NULL, save_id INTEGER NOT NULL, dex_id INTEGER,
      item_save_id INTEGER, item_dex_id INTEGER, name_cn TEXT NOT NULL, name_en TEXT NOT NULL,
      slots INTEGER NOT NULL, price INTEGER, icon_path TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0,
      mapping_status TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_skills (
      game_id TEXT NOT NULL, skill_id INTEGER NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY (game_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_decoration_skills (
      game_id TEXT NOT NULL, decoration_save_id INTEGER NOT NULL, skill_id INTEGER NOT NULL,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, points INTEGER NOT NULL,
      active_skill_name_cn TEXT, active_skill_name_en TEXT, source TEXT NOT NULL,
      PRIMARY KEY (game_id, decoration_save_id, skill_id),
      FOREIGN KEY (game_id, decoration_save_id) REFERENCES catalog_decorations(game_id, save_id),
      FOREIGN KEY (game_id, skill_id) REFERENCES catalog_skills(game_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_decoration_materials (
      row_id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, decoration_save_id INTEGER NOT NULL,
      recipe_index INTEGER NOT NULL, item_save_id INTEGER NOT NULL, item_dex_id INTEGER,
      quantity INTEGER NOT NULL, source TEXT NOT NULL,
      FOREIGN KEY (game_id, decoration_save_id) REFERENCES catalog_decorations(game_id, save_id),
      FOREIGN KEY (game_id, item_save_id) REFERENCES catalog_items(game_id, save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_decoration_dex_sources (
      game_id TEXT NOT NULL, decoration_save_id INTEGER NOT NULL, dex_id INTEGER NOT NULL, item_dex_id INTEGER NOT NULL,
      source TEXT NOT NULL, PRIMARY KEY (game_id, decoration_save_id, dex_id),
      FOREIGN KEY (game_id, decoration_save_id) REFERENCES catalog_decorations(game_id, save_id)
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_decoration_name ON catalog_decorations(game_id, name_cn, name_en);
    CREATE INDEX IF NOT EXISTS idx_catalog_decoration_skill ON catalog_decoration_skills(game_id, skill_id, points, decoration_save_id);
    CREATE INDEX IF NOT EXISTS idx_catalog_decoration_material ON catalog_decoration_materials(game_id, decoration_save_id, recipe_index);
  `)
}

function dexData(spec) {
  const items = csv(path.join(spec.dex, 'ID_Itm_Name.csv'))
  const itemNames = new Map(items.map((row) => [integer(row.Itm_ID), {
    cn: clean(row.Itm_Name_1), en: clean(row.Itm_Name_0), jp: clean(row.Itm_Name_3 || row.Itm_Name_2),
  }]))
  const jewelRows = csv(path.join(spec.dex, 'DB_Jew.csv'))
  const groups = new Map()
  for (const row of jewelRows) {
    const itemDexId = integer(row.Itm_ID)
    if (itemDexId == null) continue
    const group = groups.get(itemDexId) ?? { itemDexId, rows: [], name: itemNames.get(itemDexId) ?? { cn: '', en: '', jp: '' } }
    group.rows.push(row)
    groups.set(itemDexId, group)
  }
  const materialRows = csv(path.join(spec.dex, 'DB_ItmtoJew.csv'))
  const materialsByJew = new Map()
  for (const row of materialRows) {
    const jewId = integer(row.Jew_ID)
    if (jewId == null) continue
    materialsByJew.set(jewId, [...(materialsByJew.get(jewId) ?? []), row])
  }
  return { groups: [...groups.values()], materialsByJew }
}

function sourceSkills(db, gameId) {
  if (gameId === 'mhgu') {
    return {
      skills: db.prepare('SELECT id, name name_cn, english name_en, source FROM cn__skills').all(),
      active: db.prepare('SELECT skill_id, points, name name_cn, english name_en FROM cn__active_skills').all(),
      points: db.prepare('SELECT decoration_id decoration_key, skill_id, points FROM cn__decoration_skill_points').all(),
    }
  }
  const pointKey = gameId === 'mh3g' ? 'decoration_dex_id' : 'decoration_id'
  return {
    skills: db.prepare("SELECT id, name_cn, name_en, 'existing-content-db' source FROM skill_trees").all(),
    active: db.prepare('SELECT skill_tree_id skill_id, points, name_cn, name_en FROM active_skills').all(),
    points: db.prepare(`SELECT ${pointKey} decoration_key, skill_tree_id skill_id, points FROM decoration_skill_points`).all(),
  }
}

function authorities(db, gameId) {
  if (gameId === 'mh3g') {
    return db.prepare('SELECT save_id, name_cn, name_en, source FROM save_decorations ORDER BY save_id').all()
  }
  if (gameId === 'mh4g') {
    return db.prepare('SELECT save_id, item_save_id, name_cn, name_en, slots, source FROM decorations ORDER BY save_id').all()
  }
  return db.prepare('SELECT id save_id, id item_save_id, name name_cn, english name_en, slot_cost slots, source FROM cn__decorations ORDER BY id').all()
}

function matchGroups(db, gameId, authorityRows, groups) {
  const catalogItems = db.prepare('SELECT save_id, dex_id, name_cn, name_en, icon_path, is_placeholder FROM catalog_items WHERE game_id = ?').all(gameId)
  const itemByDex = new Map(catalogItems.map((row) => [row.dex_id, row]))
  const itemBySave = new Map(catalogItems.map((row) => [row.save_id, row]))
  const groupByItemDex = new Map(groups.map((group) => [group.itemDexId, group]))
  const old3g = gameId === 'mh3g' ? db.prepare('SELECT * FROM decorations ORDER BY dex_id').all() : []
  const old3gBySave = new Map()
  for (const row of old3g) if (row.save_id != null && !old3gBySave.has(row.save_id)) old3gBySave.set(row.save_id, row)
  const old3gByName = new Map()
  for (const row of old3g) {
    const key = normalize(row.name_en || row.name_cn)
    if (key && !old3gByName.has(key)) old3gByName.set(key, row)
  }
  const used = new Set()
  const result = []

  for (const authority of authorityRows) {
    const placeholder = authority.save_id === 0 || /dummy|^none$|^无$|^－－/.test(`${authority.name_cn} ${authority.name_en}`.toLowerCase())
    let group
    if (!placeholder && gameId === 'mhgu') group = groupByItemDex.get(itemBySave.get(authority.item_save_id)?.dex_id)
    if (!placeholder && gameId === 'mh3g') {
      const legacy = old3gBySave.get(authority.save_id) ?? old3gByName.get(normalize(authority.name_en || authority.name_cn))
      group = groupByItemDex.get(legacy?.item_dex_id)
    }
    if (!placeholder && !group) {
      const wanted = normalize(authority.name_en || authority.name_cn)
      const candidates = groups.filter((candidate) => !used.has(candidate.itemDexId))
      const exact = candidates.filter((candidate) => normalize(candidate.name.en || candidate.name.cn) === wanted)
      group = exact[0]
      if (!group && wanted) {
        const ranked = candidates.map((candidate) => ({ candidate, score: distance(wanted, normalize(candidate.name.en || candidate.name.cn)) })).sort((left, right) => left.score - right.score || left.candidate.itemDexId - right.candidate.itemDexId)
        if (ranked[0] && ranked[0].score <= 3 && ranked[0].score < (ranked[1]?.score ?? Number.POSITIVE_INFINITY)) group = ranked[0].candidate
      }
    }
    if (group) used.add(group.itemDexId)
    const item = gameId === 'mh4g' || gameId === 'mhgu'
      ? itemByDex.get(group?.itemDexId) ?? itemBySave.get(authority.item_save_id)
      : itemByDex.get(group?.itemDexId)
    result.push({ authority, group, item, placeholder })
  }
  return result
}

function buildGame(gameId, spec) {
  const databasePath = path.join(root, spec.db)
  const manifestPath = path.join(root, 'data/manifests', `${gameId}-decorations.json`)
  const sourceFiles = ['DB_Jew.csv', 'DB_ItmtoJew.csv', 'ID_Itm_Name.csv']
  const sourceHashes = Object.fromEntries(sourceFiles.map((file) => [file, sha256(fs.readFileSync(path.join(spec.dex, file)))]))
  const sourceSha = sha256(JSON.stringify(sourceHashes))
  const builderSha = sha256(fs.readFileSync(import.meta.filename))
  if (fs.existsSync(manifestPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (previous.sourceSha256 === sourceSha && previous.builderSha256 === builderSha && previous.databaseSha256 === sha256(fs.readFileSync(databasePath))) {
        console.log(`${gameId}: decoration catalog already current`)
        return
      }
    } catch { /* Rebuild an incomplete or invalid manifest. */ }
  }
  const db = new Database(databasePath)
  db.pragma('foreign_keys = ON')
  createSchema(db)
  const dex = dexData(spec)
  const authorityRows = authorities(db, gameId)
  const matched = matchGroups(db, gameId, authorityRows, dex.groups)
  const source = sourceSkills(db, gameId)
  const activeBySkill = new Map()
  for (const row of source.active) activeBySkill.set(row.skill_id, [...(activeBySkill.get(row.skill_id) ?? []), row])
  const pointsByKey = new Map()
  for (const row of source.points) pointsByKey.set(row.decoration_key, [...(pointsByKey.get(row.decoration_key) ?? []), row])
  const skillById = new Map(source.skills.map((row) => [row.id, row]))

  const insertDecoration = db.prepare(`INSERT INTO catalog_decorations
    (game_id,save_id,dex_id,item_save_id,item_dex_id,name_cn,name_en,slots,price,icon_path,is_placeholder,mapping_status,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insertSkill = db.prepare('INSERT OR IGNORE INTO catalog_skills(game_id,skill_id,name_cn,name_en,source) VALUES(?,?,?,?,?)')
  const insertDecorationSkill = db.prepare(`INSERT OR REPLACE INTO catalog_decoration_skills
    (game_id,decoration_save_id,skill_id,name_cn,name_en,points,active_skill_name_cn,active_skill_name_en,source)
    VALUES (?,?,?,?,?,?,?,?,?)`)
  const insertMaterial = db.prepare(`INSERT INTO catalog_decoration_materials
    (game_id,decoration_save_id,recipe_index,item_save_id,item_dex_id,quantity,source) VALUES(?,?,?,?,?,?,?)`)
  const insertDexSource = db.prepare('INSERT INTO catalog_decoration_dex_sources(game_id,decoration_save_id,dex_id,item_dex_id,source) VALUES(?,?,?,?,?)')
  const itemByDex = new Map(db.prepare('SELECT save_id, dex_id FROM catalog_items WHERE game_id = ?').all(gameId).map((row) => [row.dex_id, row]))
  let unresolvedMaterialRows = 0

  db.transaction(() => {
    db.prepare('DELETE FROM catalog_decoration_materials WHERE game_id = ?').run(gameId)
    db.prepare('DELETE FROM catalog_decoration_dex_sources WHERE game_id = ?').run(gameId)
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'catalog_decoration_materials'").run()
    db.prepare('DELETE FROM catalog_decoration_skills WHERE game_id = ?').run(gameId)
    db.prepare('DELETE FROM catalog_decorations WHERE game_id = ?').run(gameId)
    for (const skill of source.skills) insertSkill.run(gameId, skill.id, clean(skill.name_cn), clean(skill.name_en), clean(skill.source) || 'existing-content-db')

    for (const entry of matched) {
      const { authority, group, item, placeholder } = entry
      const representative = group?.rows[0]
      const dexId = integer(representative?.Jew_ID)
      const itemSaveId = integer(item?.save_id ?? authority.item_save_id)
      const itemDexId = integer(group?.itemDexId ?? item?.dex_id)
      const mappingStatus = placeholder ? 'placeholder' : group && item ? 'confirmed-save-dex-item' : 'unmapped'
      insertDecoration.run(
        gameId, authority.save_id, dexId, itemSaveId, itemDexId,
        clean(group?.name.cn || item?.name_cn || authority.name_cn), clean(group?.name.en || item?.name_en || authority.name_en),
        integer(authority.slots ?? representative?.Slot, 0), integer(representative?.Price), clean(item?.icon_path) || null,
        placeholder ? 1 : 0, mappingStatus, `${clean(authority.source) || 'content-db'}+dex-jew`,
      )
      for (const jewel of group?.rows ?? []) {
        insertDexSource.run(gameId, authority.save_id, integer(jewel.Jew_ID), group.itemDexId, `DB_Jew.csv:Jew_ID=${jewel.Jew_ID}`)
      }

      const pointKey = gameId === 'mh3g' ? integer(representative?.Jew_ID) : authority.save_id
      const skillPoints = gameId === 'mhgu'
        ? pointsByKey.get(authority.save_id) ?? []
        : gameId === 'mh4g'
          ? pointsByKey.get(authority.save_id) ?? []
          : pointsByKey.get(pointKey) ?? []
      for (const point of skillPoints) {
        const skill = skillById.get(point.skill_id)
        if (!skill || integer(point.skill_id, -1) < 0 || integer(point.points, 0) === 0) continue
        const active = activeBySkill.get(point.skill_id) ?? []
        insertDecorationSkill.run(
          gameId, authority.save_id, point.skill_id, clean(skill.name_cn), clean(skill.name_en), point.points,
          active.map((value) => `${clean(value.name_cn)} (${value.points > 0 ? '+' : ''}${value.points})`).filter(Boolean).join(' / ') || null,
          active.map((value) => `${clean(value.name_en)} (${value.points > 0 ? '+' : ''}${value.points})`).filter(Boolean).join(' / ') || null,
          'existing-content-db',
        )
      }

      const seenRecipes = new Set()
      let recipeIndex = 0
      for (const jewel of group?.rows ?? []) {
        const materialRows = dex.materialsByJew.get(integer(jewel.Jew_ID)) ?? []
        const recipeKey = materialRows.map((row) => `${row.Itm_ID}:${row.Qty}`).sort().join('|')
        if (!recipeKey || seenRecipes.has(recipeKey)) continue
        seenRecipes.add(recipeKey)
        recipeIndex += 1
        for (const material of materialRows) {
          const materialDexId = integer(material.Itm_ID)
          const materialItem = itemByDex.get(materialDexId)
          if (!materialItem) { unresolvedMaterialRows += 1; continue }
          insertMaterial.run(gameId, authority.save_id, recipeIndex, materialItem.save_id, materialDexId, integer(material.Qty, 0), `DB_ItmtoJew.csv:Jew_ID=${jewel.Jew_ID}`)
        }
      }
    }
  })()

  const stats = db.prepare(`SELECT count(*) total, sum(is_placeholder = 0) visible,
    sum(is_placeholder = 0 AND mapping_status != 'confirmed-save-dex-item') unmapped,
    sum(is_placeholder = 0 AND icon_path IS NULL) missing_icons FROM catalog_decorations WHERE game_id = ?`).get(gameId)
  const missingMaterials = db.prepare(`SELECT count(*) count FROM catalog_decoration_materials m
    LEFT JOIN catalog_items i ON i.game_id=m.game_id AND i.save_id=m.item_save_id
    WHERE m.game_id=? AND i.save_id IS NULL`).get(gameId).count
  if (stats.visible !== spec.visible || stats.unmapped !== 0 || stats.missing_icons !== 0 || missingMaterials !== 0 || unresolvedMaterialRows !== 0) {
    throw new Error(`${gameId} decoration audit failed: ${JSON.stringify({ ...stats, missingMaterials, unresolvedMaterialRows })}`)
  }
  const relationStats = {
    skills: db.prepare('SELECT count(*) count FROM catalog_decoration_skills WHERE game_id = ?').get(gameId).count,
    materials: db.prepare('SELECT count(*) count FROM catalog_decoration_materials WHERE game_id = ?').get(gameId).count,
    dexSources: db.prepare('SELECT count(*) count FROM catalog_decoration_dex_sources WHERE game_id = ?').get(gameId).count,
  }
  db.close()
  const manifest = {
    format: 'mh-save-edit-decoration-catalog-v1', gameId, database: path.basename(databasePath),
    databaseSha256: sha256(fs.readFileSync(databasePath)), expectedVisible: spec.visible, stats,
    sourceSha256: sourceSha, sourceFiles: sourceHashes, builderSha256: builderSha, relationStats,
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  fs.writeFileSync(path.join(root, 'data/manifests', `${gameId}-decorations-audit.json`), `${JSON.stringify({ gameId, checks: { expectedVisible: stats.visible === spec.visible, allVisibleMapped: stats.unmapped === 0, allVisibleHaveIcons: stats.missing_icons === 0, materialForeignKeys: missingMaterials === 0, allSourceMaterialsMapped: unresolvedMaterialRows === 0 }, stats: { ...stats, ...relationStats, missingMaterials, unresolvedMaterialRows } }, null, 2)}\n`)
  console.log(`${gameId}: ${stats.visible} visible decorations, ${stats.total} total`)
}

for (const [gameId, spec] of Object.entries(specs)) buildGame(gameId, spec)
