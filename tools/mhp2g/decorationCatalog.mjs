import assert from 'node:assert/strict'

export function decorationRows(db) {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='skill_schema'").get()?.value, 'mhp2g-skills-v1', 'P2G skill evidence is required')
  return db.prepare('SELECT detail_json FROM p2g_skill_equipment WHERE is_placeholder=0 ORDER BY equipment_key').all()
    .map(r => JSON.parse(r.detail_json)).filter(e => e.kind === 'decoration')
}

function expectedLinks(db, equipment) {
  const links = []
  for (const e of equipment) {
    assert.equal(e.equipmentKey, `item:${e.itemId}`, 'Decoration identity mismatch')
    assert(db.prepare('SELECT 1 FROM catalog_items WHERE item_id=? AND is_placeholder=0').get(e.itemId), 'Missing decoration item')
    assert(e.skills.length && e.recipes.length && e.slots >= 1 && e.slots <= 3, 'Incomplete decoration evidence')
    for (const s of e.skills) assert(db.prepare('SELECT 1 FROM p2g_skills WHERE skill_id=?').get(s.skillId) && Number.isInteger(s.points) && s.points !== 0, 'Invalid skill endpoint')
    e.recipes.forEach((recipe, recipeIndex) => recipe.materials.forEach((material, position) => {
      const source = `creation:${recipe.recipeKey}:${position}`
      const r = db.prepare("SELECT * FROM catalog_item_relations WHERE source_key=? AND usage_kind='decoration' AND source_kind='decoration'").get(source)
      assert(r, `Missing legacy usage: ${source}`)
      assert.equal(r.item_id, material.itemId, `Material mismatch: ${source}`)
      assert.equal(r.quantity, material.quantity, `Quantity mismatch: ${source}`)
      assert.equal(JSON.parse(r.metadata).sourceKey, recipe.recipeKey, 'Recipe identity mismatch')
      assert(db.prepare('SELECT 1 FROM catalog_items WHERE item_id=?').get(material.itemId), 'Missing material')
      links.push({ relation_id: r.id, decoration_item_id: e.itemId, recipe_index: recipeIndex + 1, position })
    }))
  }
  assert.equal(new Set(links.map(r => r.relation_id)).size, links.length, 'Ambiguous legacy usage')
  assert.equal(db.prepare("SELECT count(*) n FROM catalog_item_relations WHERE usage_kind='decoration'").get().n, links.length, 'Unmapped legacy usage')
  return links.sort((a,b) => a.relation_id-b.relation_id)
}

export function appendDecorations(db) {
  const equipment = decorationRows(db), links = expectedLinks(db, equipment)
  db.exec(`CREATE TABLE p2g_decorations (item_id INTEGER PRIMARY KEY REFERENCES catalog_items(item_id), equipment_key TEXT NOT NULL UNIQUE REFERENCES p2g_skill_equipment(equipment_key));
    CREATE TABLE p2g_decoration_materials (relation_id INTEGER PRIMARY KEY REFERENCES catalog_item_relations(id), decoration_item_id INTEGER NOT NULL REFERENCES p2g_decorations(item_id), recipe_index INTEGER NOT NULL, position INTEGER NOT NULL, UNIQUE(decoration_item_id,recipe_index,position));
    CREATE INDEX p2g_decoration_material_target ON p2g_decoration_materials(decoration_item_id);`)
  const insert = db.prepare('INSERT INTO p2g_decorations VALUES (?,?)')
  for (const e of equipment) insert.run(e.itemId,e.equipmentKey)
  const material = db.prepare('INSERT INTO p2g_decoration_materials VALUES (@relation_id,@decoration_item_id,@recipe_index,@position)')
  for (const row of links) material.run(row)
}

export function auditDecorations(db, expected) {
  assert.equal(db.pragma('integrity_check', { simple:true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  const equipment = decorationRows(db), links = expectedLinks(db,equipment)
  assert.deepEqual(db.prepare('SELECT * FROM p2g_decorations ORDER BY item_id').all(),equipment.map(e=>({item_id:e.itemId,equipment_key:e.equipmentKey})).sort((a,b)=>a.item_id-b.item_id))
  assert.deepEqual(db.prepare('SELECT * FROM p2g_decoration_materials ORDER BY relation_id').all(),links)
  const report = {decorations:equipment.length,points:equipment.reduce((n,e)=>n+e.skills.length,0),recipes:equipment.reduce((n,e)=>n+e.recipes.length,0),materials:links.length}
  if(expected) for (const [key,count] of Object.entries(expected)) assert.equal(report[key],count,`Unexpected ${key}`)
  return report
}
