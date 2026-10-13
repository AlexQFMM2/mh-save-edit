import assert from 'node:assert/strict'
import { weaponTypes, weaponAttributes } from './weaponDefinitions.mjs'

const same = (actual, expected, message) => assert.deepEqual(actual, expected, message)
const unique = (rows, key, label) => assert.equal(new Set(rows.map(key)).size, rows.length, `Duplicate ${label}`)

export function appendWeapons(db, evidence) {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='decoration_schema'").get()?.value, 'mhp2g-decorations-v1', 'Latest complete decoration database is required')
  const { derived, eligibility, specials, icons, translations } = evidence
  unique(derived.weapons, w => w.record_key, 'weapon identity')
  unique(eligibility.reachable, key => key, 'eligible identity')
  const all = new Map(derived.weapons.map(w => [w.record_key, w]))
  const eligible = new Set(eligibility.reachable)
  const excluded = new Set(eligibility.quarantined.map(q => q.equipmentKey))
  for (const w of all.values()) {
    assert(Number.isSafeInteger(w.native_index) && w.native_index >= 0, 'Invalid native index')
    assert.equal(w.record_key, `weapon_${w.family}:${w.native_index}`, 'Native identity mismatch')
    assert.equal(w.record_key, w.equipment_key)
    assert.match(w.row_sha256, /^[a-f0-9]{64}$/)
    assert.equal(Number(eligible.has(w.record_key)) + Number(excluded.has(w.record_key)) + Number(Boolean(w.is_dummy)), 1, 'Incomplete or overlapping catalog boundary')
  }
  for (const key of eligible) assert(all.has(key), `Missing eligible weapon: ${key}`)
  const iconMap = new Map(icons.icons.map(i => [i.iconKey, i]))
  unique(icons.weapons, w => w.equipmentKey, 'icon mapping')
  const iconBindings = new Map(icons.weapons.map(w => [w.equipmentKey, w]))
  for (const w of all.values()) {
    if (w.is_dummy) continue
    const binding = iconBindings.get(w.record_key)
    assert(binding && binding.classId === w.class_id && binding.rarityRaw === w.rarity_raw && binding.rowSha256 === w.row_sha256 && iconMap.has(binding.iconKey), `Icon identity mismatch: ${w.record_key}`)
  }
  unique(specials.upgrades, e => `${e.sourceKey}:${e.slot}`, 'upgrade edge')
  const upgradeRows = new Map(evidence.upgrades.map(r => [r.equipment_key, r]))
  for (const edge of specials.upgrades) {
    assert(Number.isInteger(edge.slot) && edge.slot >= 0, 'Invalid branch order')
    assert(eligible.has(edge.sourceKey) && eligible.has(edge.targetKey), 'Upgrade outside normal catalog')
    const target = upgradeRows.get(edge.targetKey)
    assert(target && target.upgrade_key === edge.materialUpgradeKey, 'Upgrade must use target materials')
    same(target.materials, edge.materials, 'Upgrade material evidence mismatch')
    assert.equal(edge.cost, all.get(edge.targetKey).normalCraftCost, 'Upgrade cost mismatch')
  }
  db.exec(`
    CREATE TABLE p2g_weapon_types(type_id INTEGER PRIMARY KEY, detail_json TEXT NOT NULL CHECK(json_valid(detail_json)));
    CREATE TABLE p2g_weapons(weapon_key TEXT PRIMARY KEY, native_table TEXT NOT NULL, native_index INTEGER NOT NULL, type_id INTEGER NOT NULL REFERENCES p2g_weapon_types(type_id), detail_json TEXT NOT NULL CHECK(json_valid(detail_json)), UNIQUE(native_table,native_index));
    CREATE INDEX p2g_weapons_type ON p2g_weapons(type_id,native_table,native_index);
    CREATE TABLE p2g_weapon_edges(parent_weapon_key TEXT NOT NULL REFERENCES p2g_weapons(weapon_key), child_weapon_key TEXT NOT NULL REFERENCES p2g_weapons(weapon_key), branch_order INTEGER NOT NULL, PRIMARY KEY(parent_weapon_key,branch_order));
    CREATE INDEX p2g_weapon_edges_child ON p2g_weapon_edges(child_weapon_key);
    CREATE TABLE p2g_weapon_recipes(recipe_key TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('production','upgrade','shard')), cost INTEGER NOT NULL CHECK(cost>=0));
    CREATE TABLE p2g_weapon_materials(recipe_key TEXT NOT NULL REFERENCES p2g_weapon_recipes(recipe_key), position INTEGER NOT NULL, item_id INTEGER NOT NULL REFERENCES catalog_items(item_id), quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(recipe_key,position));
    CREATE INDEX p2g_weapon_materials_item ON p2g_weapon_materials(item_id);
    CREATE TABLE p2g_weapon_outputs(recipe_key TEXT NOT NULL REFERENCES p2g_weapon_recipes(recipe_key), position INTEGER NOT NULL, weapon_key TEXT NOT NULL REFERENCES p2g_weapons(weapon_key), rng_min INTEGER, rng_max INTEGER, PRIMARY KEY(recipe_key,position), CHECK((rng_min IS NULL AND rng_max IS NULL) OR (rng_min BETWEEN 0 AND 99 AND rng_max BETWEEN rng_min AND 99)));
    CREATE INDEX p2g_weapon_outputs_weapon ON p2g_weapon_outputs(weapon_key);
    CREATE TABLE p2g_weapon_legacy_usages(relation_id INTEGER PRIMARY KEY REFERENCES catalog_item_relations(id), recipe_key TEXT NOT NULL, position INTEGER NOT NULL, FOREIGN KEY(recipe_key,position) REFERENCES p2g_weapon_materials(recipe_key,position));
  `)
  for (const type of weaponTypes) db.prepare('INSERT INTO p2g_weapon_types VALUES (?,?)').run(type.typeId, JSON.stringify(type))
  const outgoing = new Set(specials.upgrades.map(e => e.sourceKey))
  const direct = new Set(evidence.recipes.filter(r => r.target_equipment_key).map(r => r.target_equipment_key))
  const dual = new Map()
  for (const d of evidence.dual) dual.set(d.equipment_key, [...(dual.get(d.equipment_key) ?? []), d])
  for (const key of [...eligible].sort()) {
    const w = all.get(key), type = weaponTypes.find(t => t.nativeClassId === w.class_id)
    assert(type && w.nameJa?.trim(), `Missing class or name: ${key}`)
    const nameUnit = translations.units[translations.bindings[key]?.name]
    assert(nameUnit && nameUnit.japanese === w.nameJa, `Name identity mismatch: ${key}`)
    const raw = Object.fromEntries(Object.entries(w).filter(([k]) => k.endsWith('_raw')))
    raw.affinity = w.affinity
    const detail = {
      gameId: 'mhp2g', weaponKey: key, nativeTable: `weapon_${w.family}`, nativeIndex: w.native_index,
      typeId: type.typeId, typeNameCn: type.nameCn, typeNameEn: type.nameEn, kind: type.kind,
      nameCn: nameUnit.chinese ?? w.nameJa, nameJp: w.nameJa, nameEn: '', nameSource: nameUnit.status,
      nativeRowSha256: w.row_sha256, raw, rarity: w.rarity, displayAttack: w.attackDisplay,
      trueRawAttack: w.attack_raw, affinity: w.affinity, defense: w.defense_raw, slots: w.slots,
      attributes: weaponAttributes(w, dual.get(key) ?? []),
      sharpness: w.sharpness ? { base: w.sharpness.base, handicraft: w.sharpness.plus } : null,
      isDirectlyProducible: direct.has(key), isFinalForm: !outgoing.has(key),
      iconPath: iconMap.get(iconBindings.get(key).iconKey).path, special: specialFor(w, specials),
    }
    db.prepare('INSERT INTO p2g_weapons VALUES (?,?,?,?,?)').run(key, detail.nativeTable, w.native_index, type.typeId, JSON.stringify(detail))
  }
  for (const edge of specials.upgrades) db.prepare('INSERT INTO p2g_weapon_edges VALUES (?,?,?)').run(edge.sourceKey, edge.targetKey, edge.slot)
  const addRecipe = (key, kind, cost, materials, outputs, legacyPrefix) => {
    assert(materials.length && outputs.length, `Empty recipe: ${key}`)
    db.prepare('INSERT INTO p2g_weapon_recipes VALUES (?,?,?)').run(key, kind, cost)
    for (const m of materials) {
      assert(db.prepare('SELECT 1 FROM catalog_items WHERE item_id=? AND is_placeholder=0').get(m.item_id), 'Missing material endpoint')
      db.prepare('INSERT INTO p2g_weapon_materials VALUES (?,?,?,?)').run(key, m.position, m.item_id, m.quantity)
      if (legacyPrefix) {
        const relation = db.prepare("SELECT * FROM catalog_item_relations WHERE source_key=? AND usage_kind='weapon' AND source_kind='weapon'").get(`${legacyPrefix}:${m.position}`)
        assert(relation && relation.item_id === m.item_id && relation.quantity === m.quantity, `Legacy usage mismatch: ${key}:${m.position}`)
        db.prepare('INSERT INTO p2g_weapon_legacy_usages VALUES (?,?,?)').run(relation.id, key, m.position)
      }
    }
    outputs.forEach((o, position) => db.prepare('INSERT INTO p2g_weapon_outputs VALUES (?,?,?,?,?)').run(key, position, o.weaponKey, o.range?.[0] ?? null, o.range?.[1] ?? null))
  }
  for (const recipe of evidence.recipes) {
    if (recipe.target_equipment_key) {
      if (!eligible.has(recipe.target_equipment_key)) continue
      addRecipe(`production:${recipe.recipe_key}`, 'production', all.get(recipe.target_equipment_key).normalCraftCost, recipe.materials, [{ weaponKey: recipe.target_equipment_key }], `creation:${recipe.recipe_key}`)
    } else {
      const shard = specials.shards.filter(s => s.recipeKey === recipe.recipe_key)
      assert.equal(shard.length, 1, 'Unmapped shard recipe')
      const s = shard[0]
      assert.equal(s.pseudoTargetId, recipe.special_target_id)
      assert.equal(s.firstMaterialId, recipe.materials[0]?.item_id)
      assert.equal(s.cost, 1000)
      same(s.outputs.map(o => o.rngModulo100Range), [[0, 4], [5, 29], [30, 99]], 'Shard intervals mismatch')
      addRecipe(`shard:${recipe.recipe_key}`, 'shard', s.cost, recipe.materials, s.outputs.map(o => ({ weaponKey: o.equipmentKey, range: o.rngModulo100Range })))
    }
  }
  for (const recipe of evidence.upgrades) {
    if (!recipe.materials.length || !eligible.has(recipe.equipment_key)) continue
    addRecipe(`upgrade:${recipe.upgrade_key}`, 'upgrade', all.get(recipe.equipment_key).normalCraftCost, recipe.materials, [{ weaponKey: recipe.equipment_key }], `upgrade:${recipe.upgrade_key}`)
  }
  return { excluded: [...all.values()].filter(w => !eligible.has(w.record_key)).map(w => ({ weaponKey: w.record_key, status: w.is_dummy ? 'native-placeholder' : 'quarantined-unconfirmed-acquisition' })) }
}

function specialFor(w, evidence) {
  if (w.notesRaw) return {
    kind: 'huntingHorn', notes: w.notesRaw,
    songs: evidence.hornPatterns.filter(s => s.notesChronological.every(n => w.notesRaw.includes(n)))
      .map(s => ({ patternIndex: s.patternIndex, effectIndex: s.effectIndex, notes: s.notesChronological, nativePatternNewestFirst: s.patternNewestFirst, effectNameJp: s.wikiLabel, duration: null, repeatEffect: null, skillDuration: null })),
  }
  if (w.shelling) return { kind: 'gunlance', shelling: w.shelling }
  if (w.ammo) return {
    kind: 'bowgun', weaponKind: w.class_id === 5 ? 'light' : 'heavy', reloadRaw: w.reload_raw, recoilRaw: w.recoil_charge_raw,
    ammo: w.ammo.map(a => ({ ammoIndex: a.ammo_index, code: a.ammo_code, available: Boolean(a.is_available), capacityTemplate: a.capacity, loadQuantity: a.is_available ? a.capacity : null })),
    rapidFire: w.rapidFire.map(p => ({ profileIndex: p.index, ammoIndex: p.ammoIndex, shots: p.shots, damageMultiplier: p.damageMultiplier, recoilRaw: p.recoilRaw })),
  }
  if (w.chargeSlots) return {
    kind: 'bow', baseChargeCount: w.baseChargeCount, loadUpChargeCount: w.loadUpChargeCount,
    charges: w.chargeSlots.map(s => ({ level: s.slot + 1, typeCode: s.type_code, shotLevel: s.level, available: s.slot < w.loadUpChargeCount, requiresLoadUp: s.slot >= w.baseChargeCount && s.slot < w.loadUpChargeCount })),
    coatingMaskRaw: w.ammo_coating_mask_raw,
  }
  return { kind: 'standardMelee' }
}

export function auditWeapons(db, expected = {}) {
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  same(db.pragma('foreign_key_check'), [])
  const count = sql => db.prepare(sql).get().n
  const weapons = db.prepare('SELECT detail_json FROM p2g_weapons ORDER BY weapon_key').all().map(r => JSON.parse(r.detail_json))
  const byKey = new Map(weapons.map(w => [w.weaponKey, w]))
  const edges = db.prepare('SELECT * FROM p2g_weapon_edges').all()
  const outgoing = new Set(edges.map(e => e.parent_weapon_key))
  const reachable = new Set(db.prepare("SELECT o.weapon_key FROM p2g_weapon_outputs o JOIN p2g_weapon_recipes r USING(recipe_key) WHERE r.kind IN ('production','shard')").all().map(r => r.weapon_key))
  const children = new Map()
  for (const edge of edges) children.set(edge.parent_weapon_key, [...(children.get(edge.parent_weapon_key) ?? []), edge.child_weapon_key])
  const pending = [...reachable]
  while (pending.length) for (const child of children.get(pending.pop()) ?? []) {
    if (!reachable.has(child)) { reachable.add(child); pending.push(child) }
  }
  assert.equal(reachable.size, weapons.length, 'Weapon has no verified acquisition path')
  for (const w of weapons) {
    assert.equal(w.weaponKey, `${w.nativeTable}:${w.nativeIndex}`)
    assert(!Object.hasOwn(w, 'saveId') && !Object.hasOwn(w, 'saveType') && !Object.hasOwn(w, 'dexId'), 'Catalog identity must not fabricate save/Dex fields')
    assert.equal(w.affinity, w.raw.affinity, 'Raw affinity changed')
    assert.equal(w.isFinalForm, !outgoing.has(w.weaponKey), 'Final form must use complete graph')
    assert.equal(w.isDirectlyProducible, Boolean(db.prepare("SELECT 1 FROM p2g_weapon_outputs o JOIN p2g_weapon_recipes r USING(recipe_key) WHERE o.weapon_key=? AND r.kind='production'").get(w.weaponKey)))
  }
  const report = {
    weapons: weapons.length, types: count('SELECT count(*) n FROM p2g_weapon_types'), edges: edges.length,
    crossTypeEdges: edges.filter(e => byKey.get(e.parent_weapon_key).typeId !== byKey.get(e.child_weapon_key).typeId).length,
    productionRecipes: count("SELECT count(*) n FROM p2g_weapon_recipes WHERE kind='production'"),
    upgradeRecipes: count("SELECT count(*) n FROM p2g_weapon_recipes WHERE kind='upgrade'"),
    shardRecipes: count("SELECT count(*) n FROM p2g_weapon_recipes WHERE kind='shard'"),
    shardOutputs: count("SELECT count(*) n FROM p2g_weapon_outputs o JOIN p2g_weapon_recipes r USING(recipe_key) WHERE r.kind='shard'"),
    materials: count('SELECT count(*) n FROM p2g_weapon_materials'), legacyUsages: count('SELECT count(*) n FROM p2g_weapon_legacy_usages'),
  }
  for (const [key, value] of Object.entries(expected)) assert.equal(report[key], value, `Unexpected ${key}`)
  assert.equal(count(`SELECT count(*) n FROM p2g_weapon_legacy_usages l JOIN p2g_weapon_materials m USING(recipe_key,position) JOIN catalog_item_relations r ON r.id=l.relation_id WHERE r.item_id<>m.item_id OR r.quantity<>m.quantity`), 0, 'Legacy usage material mismatch')
  assert.equal(count(`SELECT count(*) n FROM catalog_item_relations r LEFT JOIN p2g_weapon_legacy_usages u ON u.relation_id=r.id WHERE r.usage_kind='weapon' AND u.relation_id IS NULL`), 0, 'Unmapped legacy weapon usage')
  return report
}
