import assert from 'node:assert/strict'
import { normalizeSkillSearch } from './skillCatalog.mjs'

const points = values => values.map(s => [s.skillId, s.points]).sort((a, b) => a[0] - b[0])
const json = value => JSON.stringify(value)

// This overlay changes display text only. Cross-game naming decisions and their
// native evidence belong to the private review, never to a fuzzy name matcher.
export function applyDecorationNameReview(db, review) {
  assert.equal(review.schema, 'mhp2g-decoration-name-review-v1')
  const equipment = db.prepare("SELECT equipment_key,detail_json FROM p2g_skill_equipment WHERE kind='decoration' AND is_placeholder=0 ORDER BY equipment_key").all()
  const entries = new Map(review.entries.map(e => [e.equipmentKey, e]))
  assert.equal(entries.size, review.entries.length, 'Duplicate name review identity')
  assert.deepEqual([...entries.keys()].sort(), equipment.map(e => e.equipment_key).sort(), 'Review must cover every decoration')
  assert.equal(new Set(review.entries.map(e => e.chinese)).size, entries.size, 'Ambiguous decoration display names')
  const changes = [], searchIds = new Set(), relationIds = new Set()
  for (const row of equipment) {
    const current = JSON.parse(row.detail_json), e = entries.get(row.equipment_key)
    assert.equal(e.equipmentKey, `item:${e.itemId}`, 'Invalid item identity')
    assert.equal(current.itemId, e.itemId, 'Stale item identity')
    assert.equal(current.nameJp, e.japanese, 'Stale Japanese name')
    assert.equal(current.nameCn, e.previousChinese, 'Stale Chinese name')
    assert.equal(current.slots, e.slots, 'Changed slots')
    assert.deepEqual(points(current.skills), points(e.skills), 'Changed signed skill points')
    const item = db.prepare('SELECT name_cn,name_jp FROM catalog_items WHERE item_id=?').get(e.itemId)
    assert.deepEqual(item, { name_cn: e.previousChinese, name_jp: e.japanese }, 'Catalog/equipment name mismatch')
    assert(typeof e.chinese === 'string' && e.chinese.trim() === e.chinese && e.chinese.length && !/[\n~]/.test(e.chinese), 'Invalid display name')
    assert(typeof e.basis === 'string' && e.basis.trim(), 'Missing review basis')
    if (e.chinese === e.previousChinese) continue
    const old = db.prepare('SELECT original_name FROM catalog_item_localization WHERE item_id=?').get(e.itemId)
    assert(old, 'Missing localization identity')
    const aliases = [...new Set([...(current.nameAliases ?? []), e.previousChinese, old.original_name].filter(n => n && n !== e.chinese))]
    const searches = current.skills.flatMap(s => {
      const rows = db.prepare("SELECT id FROM p2g_skill_search WHERE kind='decoration' AND skill_id=? AND label=?").all(s.skillId, current.nameCn)
      assert.equal(rows.length, 1, 'Missing or ambiguous decoration search identity')
      return rows.map(r => r.id)
    })
    for (const id of searches) { assert(!searchIds.has(id), 'Shared decoration search identity'); searchIds.add(id) }
    const relations = db.prepare('SELECT r.* FROM p2g_decoration_materials d JOIN catalog_item_relations r ON r.id=d.relation_id WHERE d.decoration_item_id=? ORDER BY r.id').all(e.itemId)
    assert.equal(relations.length, current.recipes.reduce((n, r) => n + r.materials.length, 0), 'Missing recipe links')
    for (const r of relations) {
      assert.equal(r.target_name, e.previousChinese, 'Stale material usage label')
      if (r.pending_target) assert.deepEqual(JSON.parse(r.pending_target), { kind: 'decoration', name: e.previousChinese }, 'Unexpected usage target')
      relationIds.add(r.id)
    }
    changes.push({ e, current, aliases, searches, relations })
  }
  const changedItems = new Set(changes.map(c => c.e.itemId)), changedKeys = new Set(changes.map(c => c.e.equipmentKey))
  // Strip only explicitly allowed fields, then compare every table before and
  // after. This also protects unrelated rows within the five affected tables.
  const protectedState = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({ name }) => [name,
    db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => {
      if (name === 'catalog_items' && changedItems.has(row.item_id)) delete row.name_cn
      if (name === 'catalog_item_localization' && changedItems.has(row.item_id)) { delete row.name_source; delete row.name_status }
      if (name === 'p2g_skill_equipment' && changedKeys.has(row.equipment_key)) {
        const detail = JSON.parse(row.detail_json)
        delete detail.nameCn; delete detail.nameSource; delete detail.nameAliases
        row.detail_json = json(detail)
      }
      if (name === 'p2g_skill_search' && searchIds.has(row.id)) { delete row.label; delete row.normalized_text }
      if (name === 'catalog_item_relations' && relationIds.has(row.id)) { delete row.target_name; delete row.pending_target }
      return json(row)
    }).sort()])
  return db.transaction(() => {
    const before = protectedState()
    for (const { e, current, aliases, searches, relations } of changes) {
      const source = e.decision === 'matched' ? '项目译名（按技能及孔数采用 GU 用词）' : '项目译名（孔数区分，保留 P2G 用词）'
      db.prepare('UPDATE catalog_items SET name_cn=? WHERE item_id=?').run(e.chinese, e.itemId)
      db.prepare("UPDATE catalog_item_localization SET name_source=?,name_status='reviewed' WHERE item_id=?").run(source, e.itemId)
      db.prepare('UPDATE p2g_skill_equipment SET detail_json=? WHERE equipment_key=?').run(json({ ...current, nameCn: e.chinese, nameSource: source, nameAliases: aliases }), e.equipmentKey)
      for (const id of searches) db.prepare('UPDATE p2g_skill_search SET label=?,normalized_text=? WHERE id=?').run(e.chinese, normalizeSkillSearch([e.chinese, e.japanese, ...aliases].join(' ')), id)
      for (const r of relations) db.prepare('UPDATE catalog_item_relations SET target_name=?,pending_target=? WHERE id=?').run(e.chinese, r.pending_target ? json({ kind: 'decoration', name: e.chinese }) : null, r.id)
    }
    assert.deepEqual(protectedState(), before, 'Name review changed protected catalog data')
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
    assert.deepEqual(db.pragma('foreign_key_check'), [])
    return { reviewed: equipment.length, changed: changes.length, searchRows: searchIds.size, materialLabels: relationIds.size, protectedTables: before.length }
  })()
}
