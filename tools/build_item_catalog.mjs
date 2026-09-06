#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'

const root = path.resolve(import.meta.dirname, '..')
const specs = {
  mh3g: { db: 'data/mh3g.sqlite', dex: '/tmp/mh3g-dex-direct-sql', table: 'items', names: ['name_en', 'name_cn'] },
  mh4g: { db: 'data/mh4g.sqlite', dex: '/tmp/mh4g-dex-direct-sql', table: 'items', names: ['name_en', 'name_cn'] },
  mhgu: { db: 'data/mhgu.sqlite', dex: '/tmp/mhxx-dex-direct-sql', table: 'cn__items', names: ['english', 'name'] },
}

function csv(file) {
  const input = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(field); field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1
      row.push(field); if (row.some((value) => value !== '')) rows.push(row)
      row = []; field = ''
    } else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const headers = rows.shift() ?? []
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const integer = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
const hexInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 16)
  return Number.isFinite(parsed) ? parsed : null
}
const clean = (value) => String(value ?? '').trim()
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const namedLookup = (rows, idColumn, namePattern) => new Map(rows.map((row) => {
  const nameColumn = Object.keys(row).find((key) => namePattern.test(key))
  return [integer(row[idColumn]), clean(nameColumn ? row[nameColumn] : '')]
}).filter(([id, name]) => id != null && name && name !== '---'))

function placeholder(row) {
  const text = `${row.name_cn} ${row.name_en}`.toLowerCase()
  return /dummy|unused|未使用|没有道具|no item|^[-－—\s]+$/.test(text) || row.dex_id == null
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS catalog_items (
      game_id TEXT NOT NULL, save_id INTEGER NOT NULL, dex_id INTEGER,
      name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL DEFAULT '',
      rarity INTEGER, max_stack INTEGER, sell_price INTEGER, buy_price INTEGER,
      hex_id TEXT, icon_path TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0,
      mapping_status TEXT NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY (game_id, save_id)
    );
    CREATE TABLE IF NOT EXISTS catalog_item_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, item_save_id INTEGER NOT NULL,
      source_kind TEXT NOT NULL, usage_kind TEXT, target_id INTEGER, target_name TEXT NOT NULL,
      quantity INTEGER, probability REAL, rank INTEGER, metadata TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL,
      FOREIGN KEY (game_id, item_save_id) REFERENCES catalog_items(game_id, save_id)
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_item_name ON catalog_items(game_id, name_cn, name_en);
    CREATE INDEX IF NOT EXISTS idx_catalog_relation_item ON catalog_item_relations(game_id, item_save_id, source_kind, usage_kind);
  `)
}

function buildGame(gameId, spec) {
  const db = new Database(path.join(root, spec.db))
  const dexItems = csv(path.join(spec.dex, 'DB_Itm.csv'))
  const dexNames = new Map(csv(path.join(spec.dex, 'ID_Itm_Name.csv')).map((row) => [integer(row.Itm_ID), row]))
  const attrs = new Map(dexItems.map((row) => [hexInteger(row.Hex), row]))
  const sourceDigest = sha256(fs.readdirSync(spec.dex).filter((file) => file.endsWith('.csv')).sort().map((file) => `${file}\0${fs.readFileSync(path.join(spec.dex, file))}`).join('\0'))
  const iconManifestPath = path.join(root, 'data/manifests', `${gameId}-icons.json`)
  const buildKey = sha256(`${sourceDigest}:${sha256(fs.readFileSync(iconManifestPath))}:catalog-v3`)
  createSchema(db)
  const oldItems = db.prepare(`SELECT * FROM ${spec.table} ORDER BY ${spec.table === 'cn__items' ? 'id' : 'save_id'}`).all()
  const existingBuildKey = db.prepare("SELECT value FROM meta WHERE key = 'catalog_build_key'").get()?.value
  const existingCount = db.prepare('SELECT count(*) count FROM catalog_items WHERE game_id = ?').get(gameId)?.count
  if (existingBuildKey === buildKey && existingCount === oldItems.length) {
    db.close()
    console.log(`${gameId}: catalog unchanged`)
    return
  }
  db.prepare('DELETE FROM catalog_item_relations WHERE game_id = ?').run(gameId)
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'catalog_item_relations'").run()

  const insertItem = db.prepare(`INSERT INTO catalog_items
    (game_id,save_id,dex_id,name_cn,name_en,name_jp,rarity,max_stack,sell_price,buy_price,hex_id,icon_path,is_placeholder,mapping_status,source)
    VALUES (@game_id,@save_id,@dex_id,@name_cn,@name_en,@name_jp,@rarity,@max_stack,@sell_price,@buy_price,@hex_id,@icon_path,@is_placeholder,@mapping_status,@source)
    ON CONFLICT(game_id,save_id) DO UPDATE SET dex_id=excluded.dex_id,name_cn=excluded.name_cn,name_en=excluded.name_en,
      name_jp=excluded.name_jp,rarity=excluded.rarity,max_stack=excluded.max_stack,sell_price=excluded.sell_price,
      buy_price=excluded.buy_price,hex_id=excluded.hex_id,icon_path=excluded.icon_path,is_placeholder=excluded.is_placeholder,
      mapping_status=excluded.mapping_status,source=excluded.source`)
  const manifest = JSON.parse(fs.readFileSync(iconManifestPath, 'utf8'))
  const iconMap = manifest.icons ?? {}
  const optionalLookup = (file, idColumn, pattern) => fs.existsSync(path.join(spec.dex, file)) ? namedLookup(csv(path.join(spec.dex, file)), idColumn, pattern) : new Map()
  const monsterGetTypes = optionalLookup('ID_Mon_GetItmType.csv', 'Mon_GetItmType_ID', /_1$/)
  const locationNames = optionalLookup('ID_Loc_Name.csv', 'Loc_ID', /_1$/)
  const locationAreas = optionalLookup('ID_Loc_Ara.csv', 'Loc_Ara_ID', /_1$/)
  const locationGetTypes = optionalLookup('ID_Loc_GetType.csv', 'Loc_GetType_ID', /_1$/)
  const questNames = optionalLookup('ID_Qst_Name.csv', 'Qst_ID', /_1$/)
  const questLevels = optionalLookup('ID_Qst_Lv.csv', 'Qst_Lv_ID', /_1$/)
  const questRows = fs.existsSync(path.join(spec.dex, 'DB_Qst.csv')) ? new Map(csv(path.join(spec.dex, 'DB_Qst.csv')).map((row) => [integer(row.Qst_ID), row])) : new Map()
  const questDisplayRows = fs.existsSync(path.join(spec.dex, 'DB_Qst_Display.csv')) ? new Map(csv(path.join(spec.dex, 'DB_Qst_Display.csv')).map((row) => [integer(row.Qst_ID), row])) : new Map()
  const rankNames = optionalLookup('ID_Rank.csv', 'Rank_ID', /_1$/)
  const saveToDex = new Map()
  const transaction = db.transaction(() => {
    for (const item of oldItems) {
      const saveId = integer(item.save_id ?? item.id, 0)
      const nameEn = clean(item.name_en ?? item.english)
      const nameCn = clean(item.name_cn ?? item.name)
      const dexAttr = attrs.get(saveId)
      const dexId = dexAttr ? integer(dexAttr.Itm_ID) : null
      const dexName = dexId == null ? undefined : dexNames.get(dexId)
      const row = {
        game_id: gameId, save_id: saveId, dex_id: dexId,
        name_cn: nameCn || clean(dexName?.Itm_Name_1) || nameEn,
        name_en: nameEn || clean(dexName?.Itm_Name_0) || nameCn,
        name_jp: clean(dexName?.Itm_Name_2), rarity: integer(dexAttr?.Rare), max_stack: integer(dexAttr?.Max),
        sell_price: integer(dexAttr?.Sell), buy_price: integer(dexAttr?.Buy), hex_id: clean(dexAttr?.Hex),
        icon_path: dexId == null ? null : iconMap[`Itm_${String(dexId).padStart(4, '0')}`] ?? null,
        is_placeholder: placeholder({ name_cn: nameCn, name_en: nameEn, dex_id: dexId }) ? 1 : 0,
        mapping_status: dexId == null ? 'unmapped' : 'confirmed_hex_name',
        source: `${item.source ?? 'save-array'}+dex:${sourceDigest.slice(0, 12)}`,
      }
      insertItem.run(row)
      if (dexId != null) saveToDex.set(dexId, saveId)
    }
  })
  transaction()

  const relationSpecs = [
    ['DB_ItmtoCbo.csv', 'ItmC_ID', 'combination', null, 'Cbo_ID', '调合配方'],
    ['DB_ItmtoMon.csv', 'Itm_ID', 'monster', null, 'Mon_ID', '怪物获取'],
    ['DB_ItmtoLoc.csv', 'Itm_ID', 'location', null, 'Loc_ID', '采集点'],
    ['DB_ItmtoQst.csv', 'Itm_ID', 'quest', null, 'Qst_ID', '任务奖励'],
    ['DB_ItmtoVet.csv', 'ItmOut_ID', 'exchange', null, 'Vet_ID', '交换'],
    ['DB_ItmtoWpn.csv', 'Itm_ID', 'weapon', 'weapon', 'Wpn_ID', '武器用途'],
    ['DB_ItmtoAmr.csv', 'Itm_ID', 'armor', 'armor', 'Amr_ID', '防具用途'],
    ['DB_ItmtoJew.csv', 'Itm_ID', 'decoration', 'decoration', 'Jew_ID', '装饰珠用途'],
    ['DB_ItmtoPeliWpn.csv', 'Itm_ID', 'palico-weapon', 'palico-weapon', 'PeliWpn_ID', '猫武器用途'],
    ['DB_ItmtoPeliAmr.csv', 'Itm_ID', 'palico-armor', 'palico-armor', 'PeliAmr_ID', '猫防具用途'],
    ['DB_ItmtoISKinsect.csv', 'Itm_ID', 'kinsect', 'kinsect', 'ISKinsect_ID', '猎虫用途'],
  ]
  const targetNameFiles = {
    monster: ['ID_Mon_Name.csv', 'Mon_ID'], location: ['ID_Loc_Name.csv', 'Loc_ID'], quest: ['ID_Qst_Name.csv', 'Qst_ID'],
    weapon: ['ID_Wpn_Name.csv', 'Wpn_ID'], armor: ['ID_Amr_Name.csv', 'Amr_ID'], 'palico-weapon': ['ID_PeliWpn_Name.csv', 'PeliWpn_ID'],
    'palico-armor': ['ID_PeliAmr_Name.csv', 'PeliAmr_ID'], kinsect: ['ID_ISKinsect_Name.csv', 'ISKinsect_ID'],
  }
  const targetNames = new Map()
  for (const [kind, [file, idColumn]] of Object.entries(targetNameFiles)) {
    const targetPath = path.join(spec.dex, file)
    if (!fs.existsSync(targetPath)) continue
    const names = csv(targetPath).map((row) => {
      const nameColumn = Object.keys(row).find((key) => /_Name_1$/.test(key))
      return [integer(row[idColumn]), clean(nameColumn ? row[nameColumn] : '')]
    })
    targetNames.set(kind, new Map(names))
  }
  const jewelNames = new Map(csv(path.join(spec.dex, 'DB_Jew.csv')).map((row) => {
    const item = dexNames.get(integer(row.Itm_ID))
    return [integer(row.Jew_ID), clean(item?.Itm_Name_1) || clean(item?.Itm_Name_0)]
  }).filter(([id, name]) => id != null && name))
  targetNames.set('decoration', jewelNames)
  for (const [kind, table] of [['weapon', 'weapons'], ['armor', 'armors']]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name)
    if (!columns.includes('dex_id')) continue
    const localNames = new Map(db.prepare(`SELECT dex_id, name_cn, name_en FROM ${table} WHERE dex_id IS NOT NULL`).all().map((row) => [row.dex_id, clean(row.name_cn) || clean(row.name_en)]).filter(([, name]) => name))
    targetNames.set(kind, new Map([...localNames, ...(targetNames.get(kind) ?? [])]))
  }
  const decorationSaveIds = new Map()
  if (db.prepare("SELECT count(*) count FROM sqlite_master WHERE type='table' AND name='catalog_decoration_dex_sources'").get().count) {
    for (const row of db.prepare('SELECT dex_id, decoration_save_id FROM catalog_decoration_dex_sources WHERE game_id = ?').all(gameId)) decorationSaveIds.set(row.dex_id, row.decoration_save_id)
  }
  if (questDisplayRows.size) targetNames.set('quest', new Map([...questDisplayRows].map(([id, row]) => [id, clean(row.Qst_Name)]).filter(([, name]) => Boolean(name))))
  const insertRelation = db.prepare(`INSERT INTO catalog_item_relations
    (game_id,item_save_id,source_kind,usage_kind,target_id,target_name,quantity,probability,rank,metadata,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  const relationTransaction = db.transaction(() => {
    for (const [file, itemColumn, sourceKind, usageKind, targetColumn, label] of relationSpecs) {
      const filePath = path.join(spec.dex, file)
      if (!fs.existsSync(filePath)) continue
      for (const row of csv(filePath)) {
        const dexId = integer(row[itemColumn])
        const saveId = saveToDex.get(dexId)
        if (saveId == null) continue
        const targetId = integer(row[targetColumn])
        const quantity = integer(row.Qty)
        const probability = row.Pct === '' || row.Pct == null ? null : Number.parseFloat(row.Pct) * (Number.parseFloat(row.Pct) <= 1 ? 100 : 1)
        const namedTarget = targetNames.get(sourceKind)?.get(targetId)
        const itemName = (dexItemId) => clean(dexNames.get(integer(dexItemId))?.Itm_Name_1) || clean(dexNames.get(integer(dexItemId))?.Itm_Name_0) || `道具 #${dexItemId}`
        const fallbackTarget = sourceKind === 'quest' ? `任务名称待补 · ID ${targetId ?? ''}` : `${label} #${targetId ?? ''}`
        const displayTarget = sourceKind === 'combination' ? `${itemName(row.ItmA_ID)} + ${itemName(row.ItmB_ID)}` : sourceKind === 'exchange' ? `交付 ${itemName(row.ItmIn_ID)}` : namedTarget || fallbackTarget
        const metadata = { ...row }
        if (sourceKind === 'decoration' && decorationSaveIds.has(targetId)) metadata.Target_Save_ID = String(decorationSaveIds.get(targetId))
        const rankId = integer(row.Rank_ID)
        if (rankNames.has(rankId)) metadata.Rank_Name = rankNames.get(rankId)
        if (sourceKind === 'monster' && monsterGetTypes.has(integer(row.Mon_GetItmType_ID))) metadata.Mon_GetItmType_Name = monsterGetTypes.get(integer(row.Mon_GetItmType_ID))
        if (sourceKind === 'location') {
          if (locationNames.has(integer(row.Loc_ID))) metadata.Loc_Name = locationNames.get(integer(row.Loc_ID))
          if (locationAreas.has(integer(row.Loc_Ara_ID))) metadata.Loc_Ara_Name = locationAreas.get(integer(row.Loc_Ara_ID))
          if (locationGetTypes.has(integer(row.Loc_GetType_ID))) metadata.Loc_GetType_Name = locationGetTypes.get(integer(row.Loc_GetType_ID))
        }
        if (sourceKind === 'quest') {
          if (questNames.has(integer(row.Qst_ID))) metadata.Qst_Name = questNames.get(integer(row.Qst_ID))
          const displayQuest = questDisplayRows.get(integer(row.Qst_ID))
          if (displayQuest) {
            if (clean(displayQuest.Qst_Name)) metadata.Qst_Name = clean(displayQuest.Qst_Name)
            if (clean(displayQuest.Qst_Lv)) metadata.Qst_Lv_Name = clean(displayQuest.Qst_Lv)
            if (clean(displayQuest.Loc_Name)) metadata.Qst_Loc_Name = clean(displayQuest.Loc_Name)
          }
          const quest = questRows.get(integer(row.Qst_ID))
          if (quest) {
            if (questLevels.has(integer(quest.Qst_Lv_ID))) metadata.Qst_Lv_Name = questLevels.get(integer(quest.Qst_Lv_ID))
            if (locationNames.has(integer(quest.Loc_ID))) metadata.Qst_Loc_Name = locationNames.get(integer(quest.Loc_ID))
          }
        }
        if (sourceKind === 'exchange') metadata.Exchange_Source_Name = '山菜爷'
        insertRelation.run(gameId, saveId, sourceKind, usageKind, targetId, displayTarget, quantity, Number.isFinite(probability) ? probability : null, rankId, JSON.stringify(metadata), `${file}:${sourceDigest.slice(0, 12)}`)
        if (sourceKind === 'combination') {
          for (const ingredient of [row.ItmA_ID, row.ItmB_ID]) {
            const ingredientSaveId = saveToDex.get(integer(ingredient))
            if (ingredientSaveId != null) insertRelation.run(gameId, ingredientSaveId, 'combination', null, dexId, `可调合：${itemName(row.ItmC_ID)}`, quantity, null, null, JSON.stringify({ ...metadata, direction: 'ingredient' }), `${file}:${sourceDigest.slice(0, 12)}`)
          }
        }
        if (sourceKind === 'exchange') {
          const inputSaveId = saveToDex.get(integer(row.ItmIn_ID))
          if (inputSaveId != null) insertRelation.run(gameId, inputSaveId, 'exchange', null, dexId, `可交换：${itemName(row.ItmOut_ID)}`, quantity, Number.isFinite(probability) ? probability : null, null, JSON.stringify({ ...metadata, direction: 'input' }), `${file}:${sourceDigest.slice(0, 12)}`)
        }
      }
    }
  })
  relationTransaction()
  db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('catalog_item_count', ?)").run(String(oldItems.length))
  db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('catalog_build_key', ?)").run(buildKey)
  const stats = db.prepare(`SELECT count(*) total, sum(is_placeholder) placeholders,
    sum(dex_id IS NOT NULL) mapped, sum(icon_path IS NOT NULL) icons,
    sum(CASE WHEN dex_id IS NOT NULL AND is_placeholder = 0 AND icon_path IS NULL THEN 1 ELSE 0 END) missing_icons
    FROM catalog_items WHERE game_id = ?`).get(gameId)
  const relationCounts = db.prepare('SELECT source_kind, count(*) count FROM catalog_item_relations WHERE game_id = ? GROUP BY source_kind ORDER BY source_kind').all(gameId)
  db.exec('VACUUM')
  db.close()
  const databasePath = path.join(root, spec.db)
  fs.writeFileSync(path.join(root, 'data/manifests', `${gameId}-catalog.json`), JSON.stringify({
    format: 'mh-save-edit-item-catalog-v1', gameId, database: path.basename(databasePath),
    databaseSha256: sha256(fs.readFileSync(databasePath)), sourceSha256: sourceDigest,
    authoritativeItemCount: oldItems.length, stats, relationCounts,
    iconStatus: stats.missing_icons === 0 ? 'complete' : 'incomplete',
  }, null, 2) + '\n')
  fs.writeFileSync(path.join(root, 'data/manifests', `${gameId}-catalog-audit.json`), JSON.stringify({
    format: 'mh-save-edit-item-catalog-audit-v1', gameId,
    unmappedSaveIds: dbRows(databasePath, 'SELECT save_id FROM catalog_items WHERE game_id = ? AND dex_id IS NULL ORDER BY save_id', gameId).map((row) => row.save_id),
    missingIconSaveIds: dbRows(databasePath, 'SELECT save_id FROM catalog_items WHERE game_id = ? AND dex_id IS NOT NULL AND is_placeholder = 0 AND icon_path IS NULL ORDER BY save_id', gameId).map((row) => row.save_id),
    note: 'Unmapped save-array slots remain available through the debug placeholder filter. No semantic labels are inferred.',
  }, null, 2) + '\n')
  console.log(`${gameId}: ${oldItems.length} items, ${saveToDex.size} Dex mappings`)
}

function dbRows(databasePath, query, ...params) {
  const database = new Database(databasePath, { readonly: true })
  try { return database.prepare(query).all(...params) } finally { database.close() }
}

for (const [gameId, spec] of Object.entries(specs)) buildGame(gameId, spec)
