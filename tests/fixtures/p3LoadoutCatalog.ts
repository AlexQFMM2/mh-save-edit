import { readFileSync } from 'node:fs'
import { p3WeaponFixture } from './p3WeaponCatalog'

/** Built on the synthetic item/skill/armor/weapon fixtures; only the native
 * charm generation tables are added here. */
export function p3LoadoutFixture(file = ':memory:') {
  const db = p3WeaponFixture(file)
  db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run('data_version', 'synthetic-catalog-v1')
  const pools: [string, string, 'A' | 'B', number, number, number][] = [
    ['mystery1', '谜之护符', 'A', 3, 1, 8],
    ['shining1', '光之护符', 'A', 3, 1, 5],
    ['shining2', '光之护符', 'B', 2, -3, 3],
    ['ancient1', '古老护符', 'A', 3, 1, 7],
    ['ancient2', '古老护符', 'B', 2, -10, 10],
  ]
  pools.forEach(([pool, label, position, skillId, min, max], index) => {
    const key = `mhp3:pool:${pool}:${index}`
    db.prepare('INSERT INTO p3_skill_charm_sources VALUES(?,?,?)').run(key, skillId, JSON.stringify({ sourceKey: key, sourceKind: 'random-pool', label, position, minPoints: min, maxPoints: max, slots: null, skillId, nameJp: '', note: '合成候选范围' }))
  })
  db.exec(readFileSync('tools/mhp3/charm_schema.sql', 'utf8'))
  db.prepare('INSERT INTO meta VALUES(?,?)').run('charm_generation_schema', 'mhp3-charm-generation-v1')
  db.prepare('INSERT INTO meta VALUES(?,?)').run('charm_generation_data_version', 'synthetic-charm-v1')
  for (const [source, itemId, label, skill1, skill2, threshold] of [
    ['mystery', 808, 'なぞのお守り', 'mystery1', null, 100],
    ['shining', 809, '光るお守り', 'shining1', 'shining2', 35],
    ['ancient', 810, '古びたお守り', 'ancient1', 'ancient2', 25],
  ] as const) {
    db.prepare('INSERT INTO p3_charm_generation_sources VALUES(?,?,?,?,?,?,?,?)').run(source, itemId, label, skill1, skill2, threshold, source, 'synthetic 0x09dbb23c')
    for (let rank = 0; rank <= 20; rank += 1) {
      const cumulative = [10, 35, 60, 100]
      for (let slot = 0; slot <= 3; slot += 1) {
        const previous = slot === 0 ? 0 : cumulative[slot - 1]
        db.prepare('INSERT INTO p3_charm_slot_tables VALUES(?,?,?,?,?)').run(source, rank, slot, cumulative[slot], cumulative[slot] - previous)
      }
    }
  }
  const grades: [string, number, number, number, string, string][] = [
    ['mystery', 0, 0, 7, '兵士护石', '兵士の護石'], ['mystery', 1, 8, 26, '斗士护石', '闘士の護石'],
    ['shining', 2, 0, 7, '骑士护石', '騎士の護石'], ['shining', 3, 8, 26, '城塞护石', '城塞の護石'],
    ['ancient', 4, 0, 7, '女王护石', '女王の護石'], ['ancient', 5, 8, 12, '王之护石', '王の護石'], ['ancient', 6, 13, 26, '龙之护石', '龍の護石'],
  ]
  for (const row of grades) db.prepare('INSERT INTO p3_charm_grade_rules VALUES(?,?,?,?,?,?)').run(...row)
  return db
}
