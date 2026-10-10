#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { extractItems } from './mhp2g/items.mjs'
import { extractRelations } from './mhp2g/relations.mjs'
import { readItemIcons } from './mhp2g/iconSnapshot.mjs'
import { R9_SHA256, SCHEMA_VERSION, verifySource, sha256 } from './mhp2g/sources.mjs'
import { readLocalization, localizeItems, displayText } from './mhp2g/localization.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export function buildCatalog({ source, output, expectedSha256 = R9_SHA256, icons, localization }) {
  if (fs.existsSync(output)) throw new Error('Output already exists; refusing to overwrite')
  verifySource(source, expectedSha256)
  const input = new Database(source, { readonly: true, fileMustExist: true })
  let temporary, db
  try {
    if (input.pragma('integrity_check', { simple: true }) !== 'ok' || input.pragma('foreign_key_check').length) throw new Error('Invalid source database')
    const localized = localization ? readLocalization(localization, expectedSha256) : null
    const items = extractItems(input), itemLocalization = localized ? localizeItems(items, localized) : null
    const equipmentNames = new Map(localized ? Object.entries(localized.bindings).filter(([, binding]) => ['weapon','armor'].includes(binding.kind)).map(([key, binding]) => [key, displayText(localized.units[binding.name])]) : [])
    const { relations, excluded } = extractRelations(input, { itemNames: new Map(items.map(row => [row.item_id, row.name_cn])), equipmentNames })
    const iconSnapshot = icons ? readItemIcons(input, items, icons) : null
    if (iconSnapshot) for (const item of items) item.icon_path = iconSnapshot.byItemId.get(item.item_id) ?? null
    fs.mkdirSync(path.dirname(output), { recursive: true })
    temporary = fs.mkdtempSync(path.join(path.dirname(output), '.mhp2g-build-'))
    const file = path.join(temporary, 'mhp2g.sqlite')
    db = new Database(file)
    db.pragma('foreign_keys = ON')
    db.exec(`
      CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE catalog_items(
        game_id TEXT NOT NULL CHECK(game_id='mhp2g'),item_id INTEGER PRIMARY KEY,
        save_id INTEGER CHECK(save_id IS NULL),dex_id INTEGER CHECK(dex_id IS NULL),
        name_cn TEXT NOT NULL,name_en TEXT NOT NULL,name_jp TEXT NOT NULL,description TEXT NOT NULL,
        rarity INTEGER,max_stack INTEGER,buy_price INTEGER,sell_price INTEGER,icon_path TEXT,
        is_placeholder INTEGER NOT NULL,mapping_status TEXT NOT NULL,source TEXT NOT NULL);
      CREATE TABLE catalog_item_relations(
        id INTEGER PRIMARY KEY,source_key TEXT UNIQUE NOT NULL,item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),
        source_kind TEXT NOT NULL,usage_kind TEXT,target_name TEXT NOT NULL,quantity INTEGER,probability REAL CHECK(probability BETWEEN 0 AND 100),
        metadata TEXT NOT NULL CHECK(json_valid(metadata)),pending_target TEXT CHECK(pending_target IS NULL OR json_valid(pending_target)));
      CREATE TABLE catalog_item_relation_targets(
        relation_id INTEGER NOT NULL REFERENCES catalog_item_relations(id),position INTEGER NOT NULL,
        item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),PRIMARY KEY(relation_id,position));
      CREATE INDEX catalog_item_names ON catalog_items(name_cn,name_jp);
      CREATE INDEX catalog_item_relation_items ON catalog_item_relations(item_id,source_kind,usage_kind);
      CREATE TABLE catalog_build_metadata(domain TEXT PRIMARY KEY,game_id TEXT NOT NULL,source_sha256 TEXT NOT NULL,builder_sha256 TEXT NOT NULL);
    `)
    if (localized) db.exec(`CREATE TABLE catalog_item_localization(
      item_id INTEGER PRIMARY KEY REFERENCES catalog_items(item_id),original_name TEXT NOT NULL,
      name_source TEXT NOT NULL,name_status TEXT NOT NULL,description_jp TEXT NOT NULL,
      description_source TEXT NOT NULL,description_status TEXT NOT NULL)`)
    const toolFiles = ['tools/build_mhp2g_catalog.mjs','tools/mhp2g/items.mjs','tools/mhp2g/relations.mjs','tools/mhp2g/sources.mjs','tools/mhp2g/iconSnapshot.mjs','tools/mhp2g/localization.mjs']
    const tools = Object.fromEntries(toolFiles.map(name => [name, sha256(path.join(root, name))]))
    db.transaction(() => {
      db.prepare('INSERT INTO meta VALUES(?,?)').run('catalog_schema', SCHEMA_VERSION)
      db.prepare('INSERT INTO meta VALUES(?,?)').run('catalog_capabilities', 'items')
      db.prepare('INSERT INTO catalog_build_metadata VALUES(?,?,?,?)').run('items', 'mhp2g', expectedSha256, JSON.stringify(tools))
      const insertItem = db.prepare(`INSERT INTO catalog_items VALUES('mhp2g',@item_id,@save_id,@dex_id,@name_cn,@name_en,@name_jp,@description,@rarity,@max_stack,@buy_price,@sell_price,@icon_path,@is_placeholder,@mapping_status,@source)`)
      items.forEach(row => insertItem.run(row))
      if (itemLocalization) {
        db.prepare('INSERT INTO meta VALUES(?,?)').run('localization_sha256', sha256(localization))
        const insert = db.prepare('INSERT INTO catalog_item_localization VALUES(@item_id,@original_name,@name_source,@name_status,@description_jp,@description_source,@description_status)')
        itemLocalization.forEach(row => insert.run(row))
      }
      const insertRelation = db.prepare('INSERT INTO catalog_item_relations VALUES(?,?,?,?,?,?,?,?,?,?)')
      const insertTarget = db.prepare('INSERT INTO catalog_item_relation_targets VALUES(?,?,?)')
      relations.forEach((r, index) => {
        insertRelation.run(index + 1, r.key, r.itemId, r.kind, r.usage, r.name, r.quantity, r.probability, JSON.stringify(r.metadata), r.pending ? JSON.stringify(r.pending) : null)
        r.relatedItemIds.forEach((id, position) => insertTarget.run(index + 1, position, id))
      })
    })()
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw new Error('Invalid output database')
    const counts = db.prepare('SELECT source_kind,count(*) AS count FROM catalog_item_relations GROUP BY source_kind ORDER BY source_kind').all()
    db.exec('VACUUM'); db.close(); db = null
    const manifest = { schema: SCHEMA_VERSION, sourceSha256: expectedSha256, databaseSha256: sha256(file), items: items.length, relationCounts: counts, tools }
    if (localized) {
      fs.mkdirSync(path.join(temporary, 'localization'))
      fs.copyFileSync(localization, path.join(temporary, 'localization/localization.json'))
      fs.copyFileSync(path.join(path.dirname(localization), 'manifest.json'), path.join(temporary, 'localization/manifest.json'))
      manifest.localizationSha256 = sha256(localization)
      manifest.localizationCounts = localized.counts
    }
    if (iconSnapshot) {
      fs.mkdirSync(path.join(temporary, 'icons'))
      for (const [name, png] of iconSnapshot.files) fs.writeFileSync(path.join(temporary, 'icons', name), png)
      fs.copyFileSync(icons, path.join(temporary, 'item-icons.json'))
      manifest.iconSnapshotSha256 = iconSnapshot.sha256
      manifest.itemsWithIcons = iconSnapshot.byItemId.size
      manifest.iconFiles = iconSnapshot.files.size
    }
    fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    fs.writeFileSync(path.join(temporary, 'audit.json'), JSON.stringify({ status: 'passed', ...manifest, excluded, limits: ['save-id-unverified','rarity-display-unverified',...(!iconSnapshot ? ['icons-unmapped'] : []),'wiki-runtime-conditions-unverified'] }, null, 2) + '\n')
    // Serialize cooperating builders and publish the completed directory in one rename.
    const lock = `${output}.lock`
    fs.mkdirSync(lock)
    try {
      if (fs.existsSync(output)) throw new Error('Output already exists; refusing to overwrite')
      fs.renameSync(temporary, output)
    } finally { fs.rmdirSync(lock) }
    return manifest
  } finally {
    db?.close(); input.close()
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true })
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const source = option('--source') ?? path.resolve(root, '../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite')
  const output = option('--output')
  if (!output) throw new Error('Usage: node tools/build_mhp2g_catalog.mjs --output NEW_DIRECTORY [--source R9_SQLITE]')
  console.log(JSON.stringify(buildCatalog({ source, output: path.resolve(output), icons: option('--icons'), localization: option('--localization') }), null, 2))
}
