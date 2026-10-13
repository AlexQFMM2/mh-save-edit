import assert from 'node:assert/strict'

export function appendArmors(db, evidence) {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='weapon_schema'").get()?.value, 'mhp2g-weapons-v1', 'Complete weapon base required')
  const { armors, eligibility } = evidence
  const eligible = new Set(eligibility.normal), all = new Map(armors.map(a => [a.equipmentKey, a]))
  assert.equal(eligible.size, eligibility.normal.length)
  const excluded = new Set(eligibility.excluded.map(e => e.equipmentKey))
  assert.equal(eligible.size + excluded.size, all.size)
  for (const k of all.keys()) assert(eligible.has(k) !== excluded.has(k), `Unclassified armor: ${k}`)
  const icons = new Map(evidence.icons.icons.map(i => [i.iconKey, i]))
  const bindings = new Map(evidence.icons.armors.map(a => [a.equipmentKey, a]))
  const skillNames = new Map(db.prepare('SELECT skill_id,detail_json FROM p2g_skills').all().map(r => [r.skill_id, JSON.parse(r.detail_json)]))
  db.exec(`
    CREATE TABLE p2g_armors(armor_key TEXT PRIMARY KEY, part TEXT NOT NULL, native_index INTEGER NOT NULL, legacy_alias TEXT NOT NULL, detail_json TEXT NOT NULL CHECK(json_valid(detail_json)), UNIQUE(part,native_index));
    CREATE TABLE p2g_armor_sets(set_key TEXT PRIMARY KEY, sort_order INTEGER NOT NULL, detail_json TEXT NOT NULL CHECK(json_valid(detail_json)));
    CREATE TABLE p2g_armor_members(set_key TEXT NOT NULL REFERENCES p2g_armor_sets(set_key), combat TEXT NOT NULL CHECK(combat IN ('blademaster','gunner')), part TEXT NOT NULL, armor_key TEXT NOT NULL REFERENCES p2g_armors(armor_key), PRIMARY KEY(set_key,combat,part));
    CREATE INDEX p2g_armor_members_armor ON p2g_armor_members(armor_key);
    CREATE TABLE p2g_armor_recipes(recipe_key TEXT PRIMARY KEY, armor_key TEXT NOT NULL REFERENCES p2g_armors(armor_key), cost INTEGER NOT NULL CHECK(cost>=0));
    CREATE TABLE p2g_armor_materials(recipe_key TEXT NOT NULL REFERENCES p2g_armor_recipes(recipe_key), position INTEGER NOT NULL, item_id INTEGER NOT NULL REFERENCES catalog_items(item_id), quantity INTEGER NOT NULL CHECK(quantity>0), PRIMARY KEY(recipe_key,position));
    CREATE INDEX p2g_armor_materials_item ON p2g_armor_materials(item_id);
    CREATE TABLE p2g_armor_legacy_usages(relation_id INTEGER PRIMARY KEY REFERENCES catalog_item_relations(id), recipe_key TEXT NOT NULL, position INTEGER NOT NULL, FOREIGN KEY(recipe_key,position) REFERENCES p2g_armor_materials(recipe_key,position));
  `)
  for (const a of armors.filter(a => eligible.has(a.equipmentKey))) {
    assert(a.nameCn && a.nameJp && ['official', 'reviewed'].includes(a.nameSource), `Incomplete name: ${a.equipmentKey}`)
    const icon = bindings.get(a.equipmentKey)
    assert(icon && icon.rowSha256 === a.rowSha256 && icon.part === a.part && icon.rarityRaw + 1 === a.rarity, 'Armor icon identity mismatch')
    const recipes = evidence.recipes.filter(r => r.target_equipment_key === a.equipmentKey)
    const reward = eligibility.rewards.find(r => r.equipmentKey === a.equipmentKey)
    assert(recipes.length || reward, 'Missing armor acquisition evidence')
    const skills = evidence.points.filter(p => p.owner_key === a.equipmentKey).map(p => {
      const s = skillNames.get(p.skill_id)
      assert(s, 'Missing armor skill endpoint')
      return { skillId: p.skill_id, points: p.points, nameCn: s.nameCn, nameEn: '', nameJp: s.nameJp, activeSkillNameCn: null, activeSkillNameEn: null }
    })
    const detail = {
      gameId: 'mhp2g', armorKey: a.equipmentKey, nativeIndex: a.index, part: a.part,
      nameCn: a.nameCn, nameJp: a.nameJp, nameEn: '', nameSource: a.nameSource,
      nativeRowSha256: a.rowSha256, combat: a.combat, gender: a.gender, rarity: a.rarity, slots: a.slots,
      baseDefense: a.baseDefense, maxDefense: a.maxDefense, maxBeforeFinalUnlock: a.maxBeforeFinalUnlock,
      fireRes: a.fireRes, waterRes: a.waterRes, thunderRes: a.thunderRes, iceRes: a.iceRes, dragonRes: a.dragonRes,
      price: recipes.length ? Math.floor(a.priceRaw / 2) : null, iconPath: icons.get(icon.iconKey).path, skills,
      acquisition: reward?.descriptionCn ?? '使用制作配方生产', isPlaceholder: false,
    }
    db.prepare('INSERT INTO p2g_armors VALUES (?,?,?,?,?)').run(a.equipmentKey, a.part, a.index, a.legacyName, JSON.stringify(detail))
  }
  for (const r of evidence.recipes) {
    assert(eligible.has(r.target_equipment_key), 'Recipe targets excluded armor')
    assert(r.materials.length, 'Empty armor recipe')
    db.prepare('INSERT INTO p2g_armor_recipes VALUES (?,?,?)').run(r.recipe_key, r.target_equipment_key, Math.floor(all.get(r.target_equipment_key).priceRaw / 2))
    for (const m of r.materials) {
      assert(db.prepare('SELECT 1 FROM catalog_items WHERE item_id=? AND is_placeholder=0').get(m.item_id), 'Missing armor material endpoint')
      db.prepare('INSERT INTO p2g_armor_materials VALUES (?,?,?,?)').run(r.recipe_key, m.position, m.item_id, m.quantity)
      const usage = db.prepare("SELECT * FROM catalog_item_relations WHERE source_key=? AND usage_kind='armor'").get(`creation:${r.recipe_key}:${m.position}`)
      assert(usage && usage.item_id === m.item_id && usage.quantity === m.quantity, 'Legacy armor usage mismatch')
      db.prepare('INSERT INTO p2g_armor_legacy_usages VALUES (?,?,?)').run(usage.id, r.recipe_key, m.position)
    }
  }
  const sourceOrder = set => Math.min(...Object.values(set.rows).flatMap(row => Object.values(row).map(key => all.get(key)?.index ?? Infinity)))
  const orderedSets = [...evidence.sets].sort((a,b) => sourceOrder(a) - sourceOrder(b))
  orderedSets.forEach((set, i) => {
    assert(set.nameCn && set.nameJp && set.sources.length, 'Unreviewed set')
    db.prepare('INSERT INTO p2g_armor_sets VALUES (?,?,?)').run(set.setKey, i, JSON.stringify({ nameCn: set.nameCn, nameJp: set.nameJp, gender: set.gender }))
    for (const [combat, members] of Object.entries(set.rows)) for (const [part, key] of Object.entries(members)) {
      const a = all.get(key)
      assert(eligible.has(key) && a.part === part, 'Set part mismatch')
      assert(a.combat === 'both' || a.combat === combat, 'Set combat mismatch')
      assert(a.gender === 'both' || a.gender === set.gender, 'Set gender mismatch')
      db.prepare('INSERT INTO p2g_armor_members VALUES (?,?,?,?)').run(set.setKey, combat, part, key)
    }
  })
}

export function auditArmors(db, expected = {}) {
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  const count = sql => db.prepare(sql).get().n
  const report = Object.fromEntries(['armors','sets','recipes','materials','legacy_usages'].map(k => [k, count(`SELECT count(*) n FROM p2g_${k === 'armors' ? k : `armor_${k}`}`)]))
  report.rewardArmors = count('SELECT count(*) n FROM p2g_armors a WHERE NOT EXISTS (SELECT 1 FROM p2g_armor_recipes r WHERE r.armor_key=a.armor_key)')
  report.alternativeArmors = count('SELECT count(*) n FROM (SELECT armor_key FROM p2g_armor_recipes GROUP BY armor_key HAVING count(*)>1)')
  assert.equal(count('SELECT count(*) n FROM p2g_armors a WHERE NOT EXISTS (SELECT 1 FROM p2g_armor_members m WHERE m.armor_key=a.armor_key)'), 0, 'Armor missing from sets')
  assert.equal(count("SELECT count(*) n FROM catalog_item_relations r LEFT JOIN p2g_armor_legacy_usages u ON r.id=u.relation_id WHERE r.usage_kind='armor' AND u.relation_id IS NULL"), 0, 'Unmapped armor usage')
  for (const r of db.prepare('SELECT armor_key,part,native_index,detail_json FROM p2g_armors').all()) {
    const a = JSON.parse(r.detail_json)
    assert.equal(r.armor_key, `armor_${r.part}:${r.native_index}`)
    assert.equal(a.armorKey, r.armor_key)
    for (const k of ['dexId','saveId','saveType']) assert(!Object.hasOwn(a, k), 'Fabricated armor identity')
    assert(a.maxDefense >= a.baseDefense && a.maxDefense >= a.maxBeforeFinalUnlock)
  }
  for (const [k,v] of Object.entries(expected)) assert.equal(report[k], v, `Unexpected ${k}`)
  return report
}
