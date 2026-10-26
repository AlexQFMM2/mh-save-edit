import { readFileSync } from 'node:fs'
import { p3SkillFixture } from './p3SkillCatalog'

/** Synthetic armor variants, routes and acquisition states, unrelated to game records. */
export function p3ArmorFixture(file = ':memory:') {
  const db = p3SkillFixture(file)
  db.exec(readFileSync('tools/mhp3/armor_schema.sql', 'utf8'))
  db.prepare('INSERT INTO meta VALUES(?,?)').run('armor_schema', 'mhp3-armors-v1')
  db.prepare('INSERT INTO meta VALUES(?,?)').run('armor_data_version', 'synthetic-v1')
  const source = JSON.parse((db.prepare('SELECT detail_json FROM p3_skill_armors LIMIT 1').get() as { detail_json: string }).detail_json)
  for (const id of [1, 2, 3, 4, 5, 6]) {
    const existing = db.prepare('SELECT detail_json FROM p3_skill_armors WHERE armor_key=?').get(`mhp3:armor:4:${id}`) as { detail_json: string } | undefined
    const a = { ...(existing ? JSON.parse(existing.detail_json) : source), armorKey: `mhp3:armor:4:${id}`, nativeId: id,
      nameCn: '合成防具', aliases: ['合成旧称'], gender: id % 2 ? 'male' : 'female', combat: id === 3 ? 'gunner' : 'both',
      baseDefense: 10, maxDefense: 30, fireRes: -2, waterRes: 1, thunderRes: -3, iceRes: 4, dragonRes: -5, price: id > 4 ? null : 321,
      acquisitionStatus: id === 5 ? 'unknown' : id === 6 ? 'special' : 'obtainable', acquisition: id === 5 ? '取得尚未确认' : id === 6 ? '合成专用品' : '合成制作证据', acquisitionSource: 'synthetic', nameSource: 'project', nativeRowSha256: 'synthetic', isPlaceholder: false }
    db.prepare('INSERT OR REPLACE INTO p3_skill_armors VALUES(?,?)').run(a.armorKey, JSON.stringify(a))
    if (!existing) for (const s of a.skills) db.prepare('INSERT INTO p3_armor_skill_points VALUES(?,?,?,?)').run(a.armorKey, s.skillId, s.points, s.kind)
    const set = { nameCn: `合成套装${id}`, nameJp: 'テスト組', gender: a.gender, standalone: true }
    db.prepare('INSERT INTO p3_armor_sets VALUES(?,?,?)').run(`test:${id}`, id, JSON.stringify(set))
    db.prepare('INSERT INTO p3_armor_members VALUES(?,?,?,?)').run(`test:${id}`, a.combat, 'head', a.armorKey)
  }
  const itemIds = (db.prepare('SELECT item_id FROM catalog_items WHERE is_placeholder=0 AND decoration_json IS NULL ORDER BY item_id LIMIT 2').all() as { item_id: number }[]).map(r => r.item_id)
  for (const [index, itemId] of itemIds.entries()) {
    db.prepare('INSERT INTO p3_armor_recipes VALUES(?,?,?,?)').run(`recipe:${index}`, 'mhp3:armor:4:1', index, 321)
    db.prepare('INSERT INTO p3_armor_materials VALUES(?,?,?,?)').run(`recipe:${index}`, 0, itemId, index+2)
  }
  return db
}
