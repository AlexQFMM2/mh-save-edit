import assert from 'node:assert/strict'
import crypto from 'node:crypto'

export const normalizeSkillSearch = value => String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '')
export const tableFingerprint = (db, name) => crypto.createHash('sha256').update(JSON.stringify(db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all().map(row => JSON.stringify(row)).sort())).digest('hex')
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const text = value => typeof value === 'string' && value.trim().length > 0

export function appendSkills(db, evidence) {
  assert.equal(evidence.schema, 'mhp2g-skill-evidence-v1')
  assert(text(evidence.sourceUrl) && Array.isArray(evidence.skills) && evidence.skills.length)
  const ids = new Set(), activations = new Map(), equipmentKeys = new Set()
  for (const skill of evidence.skills) {
    assert(integer(skill.skillId, 1, 65535) && !ids.has(skill.skillId), 'Invalid or duplicate skill identity'); ids.add(skill.skillId)
    assert(text(skill.nameCn) && text(skill.nameJp) && text(skill.nameSource))
    assert(Array.isArray(skill.activations) && (skill.activations.length || skill.specialRule), 'Missing skill rule')
    if (skill.specialRule) assert(text(skill.specialRule.descriptionCn) && text(skill.specialRule.descriptionJp))
    for (const activation of skill.activations) {
      assert(integer(activation.nativeTextOrdinal, 1, 65535) && activation.activationKey === `mhp2g:a${activation.nativeTextOrdinal}` && !activations.has(activation.activationKey), 'Invalid activation identity')
      assert(integer(activation.threshold, -100, 100) && activation.threshold !== 0, 'Invalid activation threshold')
      assert(activation.direction === (activation.threshold > 0 ? 'positive' : 'negative'))
      assert(text(activation.nameCn) && text(activation.nameJp) && text(activation.descriptionCn) && text(activation.descriptionJp) && text(activation.sourceKey))
      assert(!(evidence.excludedNativeTextOrdinals ?? []).includes(activation.nativeTextOrdinal), 'Excluded text promoted to activation')
      activations.set(activation.activationKey, { ...activation, skillId: skill.skillId })
    }
  }
  for (const activation of activations.values()) for (const component of activation.components) {
    const endpoint = activations.get(component.activationKey)
    assert(endpoint && endpoint.skillId === component.skillId && endpoint.nameCn === component.nameCn, 'Dangling component')
    assert(endpoint.activationKey !== activation.activationKey, 'Self component')
  }
  const visiting = new Set(), visited = new Set()
  const visit = key => { assert(!visiting.has(key), 'Composite cycle'); if (visited.has(key)) return; visiting.add(key); for(const c of activations.get(key).components) visit(c.activationKey); visiting.delete(key); visited.add(key) }
  for (const key of activations.keys()) visit(key)
  const itemIds = new Set(db.prepare('SELECT item_id FROM catalog_items').all().map(row => row.item_id))
  for (const equipment of evidence.equipment) {
    assert(/^(?:item:\d+|armor_(?:head|chest|arms|waist|legs):\d+)$/.test(equipment.equipmentKey) && !equipmentKeys.has(equipment.equipmentKey), 'Invalid equipment identity'); equipmentKeys.add(equipment.equipmentKey)
    assert(text(equipment.nameCn) && text(equipment.nameJp) && integer(equipment.slots, 0, 3))
    assert(['armor', 'decoration'].includes(equipment.kind))
    assert(equipment.kind === 'decoration' ? equipment.equipmentKey === `item:${equipment.itemId}` && itemIds.has(equipment.itemId) : equipment.equipmentKey.startsWith('armor_') && equipment.itemId === null)
    for (const point of equipment.skills) assert(ids.has(point.skillId) && integer(point.points, -128, 127), 'Dangling skill points')
    for (const recipe of equipment.recipes) {
      assert(equipment.kind === 'decoration' && text(recipe.recipeKey) && recipe.materials.length, 'Invalid recipe')
      for (const material of recipe.materials) assert(itemIds.has(material.itemId) && integer(material.quantity, 1, 65535), 'Dangling recipe material')
    }
  }
  db.exec(`CREATE TABLE p2g_skills(skill_id INTEGER PRIMARY KEY, detail_json TEXT NOT NULL);
    CREATE TABLE p2g_skill_equipment(equipment_key TEXT PRIMARY KEY, kind TEXT NOT NULL, is_placeholder INTEGER NOT NULL, detail_json TEXT NOT NULL);
    CREATE TABLE p2g_skill_points(equipment_key TEXT REFERENCES p2g_skill_equipment(equipment_key), position INTEGER, skill_id INTEGER REFERENCES p2g_skills(skill_id), points INTEGER NOT NULL, PRIMARY KEY(equipment_key,position));
    CREATE INDEX p2g_skill_points_skill ON p2g_skill_points(skill_id);
    CREATE TABLE p2g_skill_search(id INTEGER PRIMARY KEY,skill_id INTEGER REFERENCES p2g_skills(skill_id),kind TEXT NOT NULL,label TEXT NOT NULL,normalized_text TEXT NOT NULL);
    CREATE INDEX p2g_skill_search_skill ON p2g_skill_search(skill_id);`)
  const addSearch = db.prepare('INSERT INTO p2g_skill_search(skill_id,kind,label,normalized_text) VALUES(?,?,?,?)')
  const search = (id,kind,label,terms) => addSearch.run(id,kind,label,normalizeSkillSearch(terms.join(' ')))
  for (const skill of evidence.skills) {
    db.prepare('INSERT INTO p2g_skills VALUES(?,?)').run(skill.skillId, JSON.stringify({...skill,sourceUrl:evidence.sourceUrl}))
    search(skill.skillId,'name',skill.nameCn,[skill.nameCn,skill.nameJp,skill.skillId])
    if (skill.specialRule) search(skill.skillId,'effect',skill.nameCn,[skill.specialRule.descriptionCn,skill.specialRule.descriptionJp])
    for (const a of skill.activations) {
      search(skill.skillId,'activation',a.nameCn,[a.nameCn,a.nameJp])
      search(skill.skillId,'effect',a.nameCn,[a.descriptionCn,a.descriptionJp])
      for (const c of a.components) search(skill.skillId,'component',c.nameCn,[c.nameCn,c.nameJp])
    }
  }
  for (const e of evidence.equipment) {
    db.prepare('INSERT INTO p2g_skill_equipment VALUES(?,?,?,?)').run(e.equipmentKey,e.kind,Number(e.isPlaceholder),JSON.stringify(e))
    e.skills.forEach((s,position) => {
      db.prepare('INSERT INTO p2g_skill_points VALUES(?,?,?,?)').run(e.equipmentKey,position,s.skillId,s.points)
      if (!e.isPlaceholder) search(s.skillId,e.kind,e.nameCn,[e.nameCn,e.nameJp])
    })
  }
}

export function auditSkillCatalog(db, expected = {}) {
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok'); assert.deepEqual(db.pragma('foreign_key_check'),[])
  const skills=db.prepare('SELECT detail_json FROM p2g_skills').all().map(r=>JSON.parse(r.detail_json))
  const equipment=db.prepare('SELECT detail_json FROM p2g_skill_equipment').all().map(r=>JSON.parse(r.detail_json))
  const report={skills:skills.length,activations:skills.reduce((n,s)=>n+s.activations.length,0),special:skills.filter(s=>s.specialRule).length,composites:skills.flatMap(s=>s.activations).filter(a=>a.components.length).length,equipment:equipment.length,decorations:equipment.filter(e=>e.kind==='decoration').length,recipes:equipment.reduce((n,e)=>n+e.recipes.length,0),materials:equipment.reduce((n,e)=>n+e.recipes.reduce((m,r)=>m+r.materials.length,0),0),points:db.prepare('SELECT count(*) n FROM p2g_skill_points').get().n}
  for(const [key,value] of Object.entries(expected)) assert.equal(report[key],value,`Count mismatch: ${key}`)
  assert.equal(report.points,equipment.reduce((n,e)=>n+e.skills.length,0))
  return report
}
