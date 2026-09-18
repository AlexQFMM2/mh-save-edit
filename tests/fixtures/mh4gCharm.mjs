import Database from 'better-sqlite3'
import { MH4G_APPRAISAL_GROUPS, MH4G_CODE_SHA256, MH4G_EXPANDED_SHA256, MH4G_REFERENCE_SOURCE, sha256 } from '../../tools/runtime/mh4gCharmNative.mjs'

// Artificial ranges/weights only. NEVER use this fixture as native evidence.
export function syntheticNative() {
  return {
    format: 'mh4g-charm-native-v1', gameId: 'mh4g', algorithm: 'appraisal-f32-v1',
    source: { path: 'synthetic-test-only', codeSha256: MH4G_CODE_SHA256, expandedSha256: MH4G_EXPANDED_SHA256 },
    evidence: { kind: 'native-static', scope: 'reviewed-appraisal-path', limitations: ['other-acquisition-paths', 'rng-reachability', 'fpscr-runtime-state'] },
    groups: MH4G_APPRAISAL_GROUPS.map((spec, index) => {
      const pools = Object.fromEntries(['A', 'B'].map((position, p) => {
        const rows = Array.from({ length: spec.counts[p] }, (_, i) => [i + 1, p ? -1 : 1, 2])
        const data = Buffer.from(rows.flatMap(([id, min, max]) => [id, 1, min & 255, max]))
        return [position, { address: 0, rows, sha256: sha256(data) }]
      }))
      const slotWeights = Array.from({ length: 21 }, () => [100, 0, 0, 0])
      return { groupIndex: index, sourceItemId: spec.sourceItemId, classes: spec.classes.map(([classId, minScore, maxScore]) => ({ classId, minScore, maxScore })), secondSkillAttemptPercent: spec.attempt, pools, slotWeights, slotAddress: 0, slotSha256: sha256(Buffer.from(slotWeights.flat())) }
    }),
  }
}
export function database() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE charm_classes(save_id INTEGER PRIMARY KEY,name_cn TEXT,name_en TEXT);
    CREATE TABLE charm_skill_ranges(skill_tree_id INTEGER,position INTEGER,charm_source INTEGER,min_points INTEGER,max_points INTEGER,source TEXT);
    CREATE TABLE catalog_skills(game_id TEXT,skill_id INTEGER,is_placeholder INTEGER);
    CREATE TABLE catalog_skill_talisman_ranges(game_id TEXT,range_key TEXT,skill_id INTEGER,talisman_id INTEGER,talisman_name_cn TEXT,talisman_name_en TEXT,position TEXT,slot_count INTEGER,min_points INTEGER,max_points INTEGER,max_slots INTEGER,range_status TEXT,source TEXT,PRIMARY KEY(game_id,range_key));
    CREATE TABLE catalog_build_metadata(domain TEXT,game_id TEXT,source_sha256 TEXT,builder_sha256 TEXT,PRIMARY KEY(domain,game_id));
  `)
  for (let id = 1; id <= 14; id++) db.prepare('INSERT INTO charm_classes VALUES(?,?,?)').run(id, `class${id}`, `class${id}`)
  for (let id = 1; id <= 80; id++) db.prepare('INSERT INTO catalog_skills VALUES(?,?,0)').run('mh4g', id)
  for (let source = 1; source <= 6; source++) {
    db.prepare('INSERT INTO charm_skill_ranges VALUES(?,?,?,?,?,?)').run(source, 1, source, 1, 2, MH4G_REFERENCE_SOURCE)
    if (source < 6) db.prepare('INSERT INTO charm_skill_ranges VALUES(?,?,?,?,?,?)').run(source + 10, 2, source, -1, 2, MH4G_REFERENCE_SOURCE)
  }
  return db
}
