// Entirely synthetic weapons, graphs and recipes; no game-derived fixtures.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { createDecorationFixture } from './p2gDecorationCatalog.mjs'
import { buildDecorationCatalog } from '../../tools/build_mhp2g_decoration_catalog.mjs'
import { sha256 } from '../../tools/mhp2g/sources.mjs'

export function createWeaponFixture(dir) {
  const decorations = createDecorationFixture(dir)
  buildDecorationCatalog(decorations)
  const base = path.join(decorations.output, 'mhp2g.sqlite')
  const review = path.join(dir, 'review'), pilot = path.join(dir, 'pilot.sqlite'), localization = path.join(dir, 'localization.json')
  fs.mkdirSync(path.join(review, 'icons'), { recursive: true })
  const rows = [[0, 0], [1, 0], [2, 0], [3, 7], [4, 8], [5, 9], [6, 6], [464, 4]].map(([index, classId]) => weapon('blademaster', index, classId))
  rows.push(...[[0, 5], [1, 5], [2, 10], [3, 10], [4, 1]].map(([index, classId]) => weapon('ranged', index, classId)))
  const bm = index => `weapon_blademaster:${index}`
  const ranged = index => `weapon_ranged:${index}`
  rows.find(w => w.record_key === bm(2)).affinity = -10
  rows.find(w => w.record_key === bm(4)).notesRaw = [1, 2, 3]
  rows.find(w => w.record_key === bm(5)).shelling = { typeJa: '通常', level: 2 }
  for (const w of rows.filter(w => w.class_id === 1 || w.class_id === 5)) {
    w.ammo = [{ ammo_index: 0, ammo_code: 'syntheticA', capacity: 6, is_available: 0 }, { ammo_index: 1, ammo_code: 'syntheticB', capacity: 2, is_available: 1 }]
    w.rapidFire = w.class_id === 5 ? [{ index: 0, ammoIndex: 1, damageMultiplier: 0.5, shots: 3, recoilRaw: 2 }] : []
  }
  for (const w of rows.filter(w => w.class_id === 10)) {
    w.baseChargeCount = w.native_index === 2 ? 2 : 4
    w.loadUpChargeCount = Math.min(4, w.baseChargeCount + 1)
    w.chargeSlots = [0, 1, 2, 3].map(slot => ({ slot, type_code: 'rapid', level: slot + 1 }))
  }
  const material = quantity => [{ position: 0, item_id: 2, quantity }]
  const recipes = [1, 4, 5, 6].map(i => ({ recipe_key: `test:${i}`, target_equipment_key: bm(i), special_target_id: null, materials: material(i) }))
  recipes.push({ recipe_key: 'alternative', target_equipment_key: bm(1), special_target_id: null, materials: [{ position: 0, item_id: 3, quantity: 9 }] })
  recipes.push(...[1, 2, 3, 4].map(i => ({ recipe_key: `ranged:${i}`, target_equipment_key: ranged(i), special_target_id: null, materials: material(i) })))
  recipes.push({ recipe_key: 'shard', target_equipment_key: null, special_target_id: 777, materials: material(1) })
  const upgrades = [2, 3].map(i => ({ upgrade_key: `test:${i}`, equipment_key: bm(i), materials: material(i * 2) }))
  const edges = [[1, 2, 0], [2, 3, 0], [3, 2, 0], [1, 6, 1]].map(([source, target, slot]) => ({ sourceKey: bm(source), targetKey: bm(target), slot, materialUpgradeKey: `test:${target}`, materials: material(target * 2), cost: 100 }))
  // The last edge targets a valid independent upgrade-material row.
  upgrades.push({ upgrade_key: 'test:6', equipment_key: bm(6), materials: material(12) })
  const derived = { schema: 'mhp2g-weapon-native-review-v1', weapons: rows }
  const eligibility = { reachable: rows.filter(w => !w.is_dummy && w.native_index !== 464).map(w => w.record_key), quarantined: [{ equipmentKey: bm(464) }] }
  const specials = { upgrades: edges, hornPatterns: [{ patternIndex: 0, effectIndex: 0, notesChronological: [1, 1], patternNewestFirst: [1, 1, 129, 0], wikiLabel: '合成テスト効果' }], shards: [{ recipeKey: 'shard', pseudoTargetId: 777, firstMaterialId: 2, cost: 1000, outputs: [bm(1), bm(2), bm(6)].map((equipmentKey, i) => ({ equipmentKey, rngModulo100Range: [[0, 4], [5, 29], [30, 99]][i] })) }] }
  const png = Buffer.from('synthetic-icon-bytes'), pngHash = crypto.createHash('sha256').update(png).digest('hex')
  fs.writeFileSync(path.join(review, 'icons', `${pngHash}.png`), png)
  const icons = { schema: 'mhp2g-weapon-icons-v1', icons: [{ iconKey: 'test', pngSha256: pngHash, path: `catalog/icons/${pngHash}.png` }], weapons: rows.filter(w => !w.is_dummy).map(w => ({ equipmentKey: w.record_key, classId: w.class_id, rarityRaw: w.rarity_raw, rowSha256: w.row_sha256, iconKey: 'test' })) }
  const translations = { schema: 'mhp2g-catalog-localization-v1', units: {}, bindings: {} }
  for (const w of rows) {
    translations.bindings[w.record_key] = { name: w.record_key }
    translations.units[w.record_key] = { japanese: w.nameJa, chinese: w.native_index === 3 ? null : `合成武器${w.record_key}`, status: 'synthetic' }
  }
  const source = new Database(pilot)
  source.exec('CREATE TABLE records(record_key TEXT PRIMARY KEY,row_sha256 TEXT); CREATE TABLE creation_recipes(recipe_key TEXT,target_equipment_key TEXT,special_target_id INTEGER); CREATE TABLE creation_materials(recipe_key TEXT,position INTEGER,item_id INTEGER,quantity INTEGER); CREATE TABLE upgrade_records(upgrade_key TEXT,equipment_key TEXT); CREATE TABLE upgrade_materials(upgrade_key TEXT,position INTEGER,item_id INTEGER,quantity INTEGER); CREATE TABLE weapon_dual_attributes(equipment_key TEXT,position INTEGER,type_code TEXT,value_raw INTEGER);')
  for (const w of rows) source.prepare('INSERT INTO records VALUES (?,?)').run(w.record_key, w.row_sha256)
  for (const r of recipes) {
    source.prepare('INSERT INTO creation_recipes VALUES (?,?,?)').run(r.recipe_key, r.target_equipment_key, r.special_target_id)
    for (const m of r.materials) source.prepare('INSERT INTO creation_materials VALUES (?,?,?,?)').run(r.recipe_key, m.position, m.item_id, m.quantity)
  }
  for (const r of upgrades) {
    source.prepare('INSERT INTO upgrade_records VALUES (?,?)').run(r.upgrade_key, r.equipment_key)
    for (const m of r.materials) source.prepare('INSERT INTO upgrade_materials VALUES (?,?,?,?)').run(r.upgrade_key, m.position, m.item_id, m.quantity)
  }
  source.prepare('INSERT INTO weapon_dual_attributes VALUES (?,?,?,?)').run(bm(6), 0, 'ice', 12)
  source.prepare('INSERT INTO weapon_dual_attributes VALUES (?,?,?,?)').run(bm(6), 1, 'poison', 8)
  source.close()
  const db = new Database(base)
  // Replace the older fixture's unrelated synthetic weapon relation before
  // freezing this baseline, so every weapon usage has evidence in this fixture.
  db.exec("DELETE FROM catalog_item_relation_targets WHERE relation_id IN (SELECT id FROM catalog_item_relations WHERE usage_kind='weapon'); DELETE FROM catalog_item_relations WHERE usage_kind='weapon'")
  for (const [kind, collection, keyField, targetField] of [['creation', recipes, 'recipe_key', 'target_equipment_key'], ['upgrade', upgrades, 'upgrade_key', 'equipment_key']]) {
    for (const r of collection) if (r[targetField]) for (const m of r.materials) db.prepare("INSERT INTO catalog_item_relations(source_key,item_id,source_kind,usage_kind,target_name,quantity,metadata,pending_target) VALUES(?,?,'weapon','weapon',?,?,?,?)").run(`${kind}:${r[keyField]}:${m.position}`, m.item_id, 'Synthetic', m.quantity, JSON.stringify({ sourceKey: r[keyField] }), JSON.stringify({ kind: 'weapon', name: 'Synthetic' }))
  }
  db.close()
  const snapshot = { derived, eligibility, specials, icons, translations }
  const save = () => {
    const files = { 'derived-weapons.json': derived, 'acquisition-reachability.json': eligibility, 'specials-audit.json': specials, 'icons/manifest.json': icons }
    for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(review, name), JSON.stringify(data))
    fs.writeFileSync(localization, JSON.stringify(translations))
    const fingerprint = file => ({ bytes: fs.statSync(file).size, sha256: sha256(file) })
    fs.writeFileSync(path.join(review, 'manifest.json'), JSON.stringify({ schema: 'mhp2g-weapon-native-review-manifest-v1', inputs: { 'test/pilot-r9/mhp2g-pilot.sqlite': fingerprint(pilot), 'test/localization-v4/localization.json': fingerprint(localization) }, outputs: Object.fromEntries(Object.keys(files).map(name => [name, fingerprint(path.join(review, name))])) }))
  }
  save()
  return { base, baseSha256: sha256(base), review, pilot, localization, output: path.join(dir, 'weapons'), snapshot, save, expected: { weapons: 10, types: 11, edges: 4, crossTypeEdges: 3, productionRecipes: 9, upgradeRecipes: 3, shardRecipes: 1, shardOutputs: 3, materials: 13, legacyUsages: 12 } }
}

function weapon(family, index, classId) {
  const key = `weapon_${family}:${index}`
  return { record_key: key, equipment_key: key, family, native_index: index, is_dummy: Number(index === 0), class_id: classId, row_sha256: crypto.createHash('sha256').update(key).digest('hex'), nameJa: `テスト武器${family}${index}`, rarity_raw: 1, rarity: 2, price_raw: 200, normalCraftCost: 100, attack_raw: 100, attackDisplay: 480, affinity: 10, defense_raw: 0, slots: 1, element_type_raw: 0, element_value_raw: 0, status_type_raw: 0, status_value_raw: 0, reload_raw: 2, recoil_charge_raw: 2, ammo_coating_mask_raw: 0, ...(family === 'blademaster' ? { sharpness: { base: [30, 30, 30, 50, 10, 0, 0], plus: [30, 30, 30, 50, 10, 50, 0] } } : {}) }
}
